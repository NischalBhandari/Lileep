/**
 * popup.js — Drives the extension popup UI
 *
 * Modes:
 *   facebook — on a Facebook group page → NEPSE scraper
 *   gmaps    — on a Google Maps place page → TomDum business seeder
 *   neutral  — anywhere else
 */

const API_LOCAL = "http://localhost:4000";
const API_LIVE  = "https://tomdum.com/api";

// ─────────────────────────────────────────────
// API toggle
// ─────────────────────────────────────────────

function initApiToggle() {
  const pillLocal = document.getElementById("pillLocal");
  const pillLive  = document.getElementById("pillLive");
  const urlLabel  = document.getElementById("apiUrl");

  function applySelection(url) {
    const isLocal = url === API_LOCAL;
    pillLocal.className = "api-pill" + (isLocal ? " active-local" : "");
    pillLive.className  = "api-pill" + (!isLocal ? " active-live"  : "");
    urlLabel.textContent = url;
  }

  chrome.storage.local.get("tomdumApiUrl", ({ tomdumApiUrl }) => {
    applySelection(tomdumApiUrl || API_LOCAL);
  });

  pillLocal.addEventListener("click", () => {
    chrome.storage.local.set({ tomdumApiUrl: API_LOCAL });
    applySelection(API_LOCAL);
  });

  pillLive.addEventListener("click", () => {
    chrome.storage.local.set({ tomdumApiUrl: API_LIVE });
    applySelection(API_LIVE);
  });
}

// ─────────────────────────────────────────────
// Page detection helpers
// ─────────────────────────────────────────────

function isFacebookGroup(url) {
  return url?.includes("facebook.com/groups/");
}

function isGoogleMapsPlace(url) {
  return url?.includes("google.com/maps/place/");
}

function isGoogleMaps(url) {
  return url?.includes("google.com/maps");
}

// ─────────────────────────────────────────────
// Facebook mode
// ─────────────────────────────────────────────

function initFacebookMode() {
  document.getElementById("fbMode").style.display = "block";

  const scrapeBtn = document.getElementById("scrape");
  const statusEl  = document.getElementById("status");
  const countEl   = document.getElementById("count");
  const previewEl = document.getElementById("preview");

  function setStatus(msg, type = "") {
    statusEl.textContent = msg;
    statusEl.className = type;
  }

  // Listen for POSTS_READY from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== "POSTS_READY") return;
    const posts = message.posts;

    if (!Array.isArray(posts)) {
      setStatus(posts.error || "Extraction failed.", "error");
      scrapeBtn.disabled = false;
      return;
    }

    if (posts.length === 0) {
      setStatus("No posts extracted. Try scrolling manually first.", "error");
      scrapeBtn.disabled = false;
      return;
    }

    countEl.textContent = `${posts.length} post(s) extracted`;
    previewEl.style.display = "block";
    previewEl.textContent = posts[0].text.slice(0, 300) + (posts[0].text.length > 300 ? "…" : "");

    if (document.getElementById("sendToApi").checked) {
      setStatus("Sending to local API…");
      chrome.runtime.sendMessage(
        {
          action: "SEND_TO_NEPSE_API",
          posts,
          groupName: document.getElementById("groupName").value.trim() || "Unknown Group",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setStatus("API error: " + chrome.runtime.lastError.message, "error");
          } else if (response?.success) {
            setStatus(`Done. ${posts.length} posts sent to pipeline.`, "success");
          } else {
            setStatus("API error: " + (response?.error || "unknown"), "error");
          }
          scrapeBtn.disabled = false;
        }
      );
    } else {
      console.log("[Lileep] Extracted posts:", posts);
      setStatus(`Done. ${posts.length} posts extracted (API send disabled).`, "success");
      scrapeBtn.disabled = false;
    }
  });

  scrapeBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    scrapeBtn.disabled = true;
    previewEl.style.display = "none";
    countEl.textContent = "";

    const scroll = document.getElementById("autoScroll").checked;
    setStatus(scroll ? "Scrolling to load posts…" : "Extracting posts…");

    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE", scroll, scrollSteps: 5 });
    } catch (err) {
      setStatus("Could not connect to page. Try refreshing.", "error");
      scrapeBtn.disabled = false;
    }
  });

  setStatus("Ready. Click Scrape to begin.");
}

// ─────────────────────────────────────────────
// Google Maps / TomDum seeder mode
// ─────────────────────────────────────────────

async function initGmapsMode(tab) {
  document.getElementById("gmapsMode").style.display = "block";

  const catSelect = document.getElementById("auto-cat-select");
  const startBtn  = document.getElementById("auto-start-btn");
  const statusEl  = document.getElementById("auto-status");

  // ── Load categories into <select> ─────────────────────────────
  chrome.runtime.sendMessage({ action: "FETCH_CATEGORIES" }, (res) => {
    const cats = res?.success ? res.data : [];
    catSelect.innerHTML = '<option value="">Select a category…</option>';
    cats.forEach((parent) => {
      if ((parent.children ?? []).length > 0) {
        const og = document.createElement("optgroup");
        og.label = parent.name;
        parent.children.forEach((child) => {
          const opt = document.createElement("option");
          opt.value = child.id;
          opt.textContent = child.name;
          og.appendChild(opt);
        });
        catSelect.appendChild(og);
      } else {
        const opt = document.createElement("option");
        opt.value = parent.id;
        opt.textContent = parent.name;
        catSelect.appendChild(opt);
      }
    });
    if (cats.length === 0) catSelect.innerHTML = '<option value="">API not reachable</option>';
  });

  // ── Helpers ───────────────────────────────────────────────────
  let isRunning = false;
  let pollTimer = null;

  function setRunningUI(done, skipped, errors) {
    isRunning = true;
    startBtn.textContent = "■ Stop Auto-seed";
    startBtn.className = "primary stop-btn";
    statusEl.textContent = `Running… ${done} seeded · ${skipped} skipped · ${errors} errors`;
    statusEl.className = "running";
  }

  function setIdleUI(msg = "") {
    isRunning = false;
    startBtn.textContent = "▶ Start Auto-seed";
    startBtn.className = "primary td-btn";
    statusEl.textContent = msg || "Search Google Maps for a category, then start.";
    statusEl.className = msg.startsWith("Done") ? "" : "";
    clearInterval(pollTimer);
  }

  // ── Check if already running (popup reopened mid-run) ─────────
  chrome.tabs.sendMessage(tab.id, { action: "AUTO_SEED_STATUS" }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    if (res.running) setRunningUI(res.done, res.skipped ?? 0, res.errors);
  });

  // ── Poll status while popup is open ───────────────────────────
  pollTimer = setInterval(() => {
    chrome.tabs.sendMessage(tab.id, { action: "AUTO_SEED_STATUS" }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      if (res.running) {
        setRunningUI(res.done, res.skipped ?? 0, res.errors);
      } else if (isRunning) {
        setIdleUI(`Done: ${res.done} seeded · ${res.skipped ?? 0} skipped · ${res.errors} errors`);
      }
    });
  }, 1200);

  window.addEventListener("unload", () => clearInterval(pollTimer));

  // ── Start / stop button ───────────────────────────────────────
  startBtn.addEventListener("click", async () => {
    if (isRunning) {
      chrome.tabs.sendMessage(tab.id, { action: "AUTO_SEED_STOP" });
      setIdleUI("Stopping…");
      return;
    }

    const categoryId = catSelect.value;
    if (!categoryId) {
      statusEl.textContent = "Select a category first.";
      statusEl.className = "error";
      return;
    }

    const limit       = parseInt(document.getElementById("auto-limit").value, 10) || 50;
    const skipReviews = document.getElementById("auto-skip-reviews").checked;
    const { tomdumToken } = await chrome.storage.local.get("tomdumToken");
    if (!tomdumToken) {
      statusEl.textContent = "Log in first — use the blue panel on the page.";
      statusEl.className = "error";
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { action: "AUTO_SEED_START", config: { categoryId, limit, skipReviews, token: tomdumToken } },
      (res) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: refresh Google Maps and try again.";
          statusEl.className = "error";
          return;
        }
        if (res?.ok) {
          setRunningUI(0, 0, 0);
        } else {
          statusEl.textContent = "Error: " + (res?.error ?? "unknown");
          statusEl.className = "error";
        }
      }
    );
  });
}

// ─────────────────────────────────────────────
// Entry point — detect mode based on current tab
// ─────────────────────────────────────────────

(async () => {
  initApiToggle();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (isFacebookGroup(tab?.url)) {
    initFacebookMode();
  } else if (isGoogleMaps(tab?.url)) {
    await initGmapsMode(tab);
  } else {
    document.getElementById("neutralMode").style.display = "block";
  }
})();
