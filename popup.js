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

function initGmapsMode() {
  document.getElementById("gmapsMode").style.display = "block";
}

// ─────────────────────────────────────────────
// Entry point — detect mode based on current tab
// ─────────────────────────────────────────────

(async () => {
  initApiToggle();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (isFacebookGroup(tab?.url)) {
    initFacebookMode();
  } else if (isGoogleMapsPlace(tab?.url)) {
    await initGmapsMode(tab);
  } else {
    document.getElementById("neutralMode").style.display = "block";
  }
})();
