/**
 * gmaps-content.js — Entry point injected on https://www.google.com/maps/*
 *
 * Injects a "🌱 Seed" button into every business card on Google Maps
 * search results. Clicking it auto-navigates the detail panel tabs to
 * scrape reviews + about attributes before opening the seed panel.
 *
 * Seed flow:
 *   1. POST /admin/businesses              → creates business, returns { id, slug }
 *   2. POST /admin/businesses/:id/reviews  → saves scraped Google reviews
 *   3. POST /admin/businesses/:id/generate-insights → async AI analysis (fire & forget)
 *
 * Load order (manifest.json):
 *   gmaps-state.js      — shared globals + sleep + clickTabAndWait
 *   gmaps-extractors.js — DOM scraping functions
 *   gmaps-ui.js         — styles, dropdown, panel, preview overlay
 *   gmaps-content.js    — seed button injection + init (this file)
 */

// ─────────────────────────────────────────────
// Inject Seed button into one article card
// ─────────────────────────────────────────────

function injectSeedButton(article) {
  if (article.querySelector(".td-seed-inline")) return;

  const biz = extractFromCard(article);
  if (!biz.name) return;

  const actionRow = article.querySelector(".Rwjeuc");
  if (!actionRow) return;

  const wrapper = document.createElement("div");
  wrapper.className = "etWJQ jym1ob kdfrQc WY7ZIb";

  const btn = document.createElement("button");
  btn.className = "td-seed-inline";
  btn.setAttribute("aria-label", `Seed ${biz.name} to TomDum`);
  btn.innerHTML = `
    <span class="DVeyrd">
      <div class="OyjIsf zemfqc"></div>
      <span class="td-seed-icon">🌱</span>
    </span>
    <div class="td-seed-label R8c4Qb fontLabelMedium">Seed</div>
  `;

  biz._sourceBtn = btn;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const label = btn.querySelector(".td-seed-label");
    label.textContent = "Opening…";
    btn.classList.add("td-loading");

    // Open the detail panel — phone/website/hours only exist there, not in the list card
    const placeLink = article.querySelector("a.hfpxzc");
    if (placeLink) {
      // Use MouseEvent so Google Maps' jsaction handlers fire correctly
      placeLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      // Poll until the detail panel shows a heading (max 6 s)
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) {
        await sleep(300);
        const heading = document.querySelector('[role="main"] h1, [role="main"] .fontHeadlineLarge');
        if (heading?.textContent?.trim()) break;
      }
    }

    label.textContent = "Scanning…";

    // Extract phone, website, address, description, hours from the now-open detail panel
    const detail = extractFromDetailPanel();
    const photos = extractPhotos();

    // Click Reviews tab → scrape → click About tab → scrape
    const reviews    = await extractReviews();
    const attributes = await extractAboutAttributes();

    // Restore Overview tab so the user's panel looks normal
    await clickTabAndWait("Overview", 800);

    label.textContent = "Seed";
    btn.classList.remove("td-loading");

    // Merge: detail panel values win over card values, but only if non-null
    const enriched = {
      ...biz,
      ...Object.fromEntries(Object.entries(detail).filter(([, v]) => v != null)),
      attributes, photos, _reviews: reviews, _sourceBtn: btn,
    };
    openPanel(enriched);
  });

  wrapper.appendChild(btn);
  actionRow.appendChild(wrapper);
  console.log("[TomDum] Seed button injected:", biz.name);
}

// ─────────────────────────────────────────────
// Scan all visible cards
// ─────────────────────────────────────────────

function injectIntoAllCards() {
  document.querySelectorAll("div[role='article'].Nv2PK").forEach(injectSeedButton);
}

// ─────────────────────────────────────────────
// Init — fetch categories/areas and start observing
// ─────────────────────────────────────────────

async function init() {
  console.log("[TomDum] Init:", window.location.href);

  // Don't tear down the manual panel or observer while auto-seed is running
  if (!tdAutoRunning) {
    document.getElementById(PANEL_ID)?.remove();
    if (tdObserver) { tdObserver.disconnect(); tdObserver = null; }
  }

  function bgFetch(action) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action }, (res) => {
        resolve(res?.success ? res.data : []);
      });
    });
  }

  const [catRes, areaRes, stored] = await Promise.all([
    bgFetch("FETCH_CATEGORIES"),
    bgFetch("FETCH_AREAS"),
    chrome.storage.local.get(["tomdumToken", "tomdumUser"]),
  ]);

  tdCategories = catRes;
  tdAreas      = areaRes;
  tdSavedToken = stored.tomdumToken ?? null;
  tdSavedUser  = stored.tomdumUser  ?? null;

  if (tdCategories.length === 0) {
    console.warn("[TomDum] API not reachable on :4000 — is it running?");
  }

  if (!tdAutoRunning) {
    injectStyles();
    injectIntoAllCards();
    tdObserver = new MutationObserver(injectIntoAllCards);
    tdObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    // Re-inject into any newly loaded cards without disrupting the run
    injectIntoAllCards();
  }
}

// ─────────────────────────────────────────────
// SPA navigation detection
// ─────────────────────────────────────────────

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    init();
  }
}, 500);

init();

// ═════════════════════════════════════════════
// AUTO-SEED — message listener + core loop
// ═════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "AUTO_SEED_START") {
    if (tdAutoRunning) { sendResponse({ ok: false, error: "Already running" }); return true; }
    tdAutoStats   = { done: 0, skipped: 0, errors: 0 };
    tdAutoRunning = true;
    autoSeedAll(message.config).catch((err) => {
      console.error("[TomDum Auto] Fatal:", err);
      tdAutoRunning = false;
      updateAutoPanel("Fatal error: " + err.message, "error");
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "AUTO_SEED_STOP") {
    tdAutoRunning = false;
    updateAutoPanel("Stopped by user.", "warn");
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "AUTO_SEED_STATUS") {
    sendResponse({ running: tdAutoRunning, ...tdAutoStats });
    return true;
  }
});

// ── Main loop ─────────────────────────────────────────────────────────────────
// Uses a name-based Set for deduplication because navigation causes Google Maps
// to re-render card DOM elements, losing any dataset attributes we set.

async function autoSeedAll(config) {
  injectAutoPanel();
  const reviewNote = config.skipReviews ? " (reviews skipped)" : " (with reviews)";
  updateAutoPanel(`Starting — limit: ${config.limit}${reviewNote}`, "info");

  const processedNames = new Set();
  let scrollAttempts   = 0;
  const total = () => tdAutoStats.done + tdAutoStats.skipped + tdAutoStats.errors;

  while (tdAutoRunning && total() < config.limit) {
    // Re-query cards every iteration — DOM changes after each navigation
    const nextCard = [...document.querySelectorAll("div[role='article'].Nv2PK")]
      .find((c) => {
        const name = c.querySelector(".qBF1Pd")?.textContent?.trim();
        return name && !processedNames.has(name);
      });

    if (!nextCard) {
      const gotMore = await scrollFeedPanel();
      scrollAttempts = gotMore ? 0 : scrollAttempts + 1;
      if (scrollAttempts >= 3) break;
      continue;
    }

    const cardName = nextCard.querySelector(".qBF1Pd")?.textContent?.trim();
    if (cardName) processedNames.add(cardName); // Mark before async work

    try {
      const result = await autoSeedOneCard(nextCard, config);
      if      (result === "seeded")  tdAutoStats.done++;
      else if (result === "skipped") tdAutoStats.skipped++;
      else                           tdAutoStats.errors++;
    } catch (err) {
      tdAutoStats.errors++;
      updateAutoPanel(`Error: ${err.message}`, "error");
    }

    const titleEl = document.querySelector("#td-auto-panel-title");
    if (titleEl) {
      titleEl.textContent =
        `Auto-seed — ${tdAutoStats.done} seeded · ${tdAutoStats.skipped} skipped · ${tdAutoStats.errors} errors`;
    }
  }

  tdAutoRunning = false;
  const { done, skipped, errors } = tdAutoStats;
  updateAutoPanel(`Finished: ${done} seeded · ${skipped} skipped · ${errors} errors`, "success");
}

// ── Process one card — full extraction matching the manual seed flow ───────────

async function autoSeedOneCard(card, config) {
  const biz = extractFromCard(card);
  if (!biz.name) {
    updateAutoPanel("Skipped card: no name extracted", "dim");
    return "skipped";
  }

  updateAutoPanel(`Processing: ${biz.name}…`, "info");

  // ── 1. Click the card to load its full detail panel ───────────────────────
  const cardLink = card.querySelector("a.hfpxzc");
  if (cardLink) {
    cardLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(2200); // Wait for detail panel to load
  }

  // ── 2. Extract from Overview tab (description + hours) ────────────────────
  const detail = extractFromDetailPanel();
  const photos = extractPhotos();
  updateAutoPanel(`  → ${photos.length} photos`, "dim");

  // ── 3. Reviews tab ────────────────────────────────────────────────────────
  let reviews = [];
  if (!config.skipReviews) {
    reviews = await extractReviews();
    updateAutoPanel(`  → ${reviews.length} reviews`, "dim");
  }

  // ── 4. About tab ──────────────────────────────────────────────────────────
  const attributes = await extractAboutAttributes();

  // ── 5. Restore Overview so the user's panel looks normal ──────────────────
  await clickTabAndWait("Overview", 600);

  // ── 6. Navigate back to the search-results list ───────────────────────────
  window.history.back();
  await sleep(2000);

  // ── 7. Resolve area (done after navigation so tdAreas is re-synced) ───────
  const areaId = await resolveArea(biz.lat, biz.lng, biz.address, config.token);
  if (!areaId) {
    updateAutoPanel(`  ⚠ Skipped "${biz.name}" — could not resolve area`, "warn");
    return "skipped";
  }

  // ── 8. Seed the business ──────────────────────────────────────────────────
  const payload = Object.fromEntries(
    Object.entries({
      name:        biz.name,
      // Prefer detail-panel values (stable data-item-id selectors) over card values
      address:     detail.address      || biz.address    || undefined,
      phone:       detail.phone        || biz.phone      || undefined,
      website:     detail.website      || biz.website    || undefined,
      description: detail.description  || undefined,
      hours:       detail.hours        || undefined,
      attributes:  attributes          || undefined,
      photos:      photos.length ? photos : undefined,
      lat:         biz.lat             ?? undefined,
      lng:         biz.lng             ?? undefined,
      categoryId:  config.categoryId,
      areaId,
    }).filter(([, v]) => v !== null && v !== undefined)
  );

  const seedRes = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ action: "SEED_BUSINESS", token: config.token, business: payload }, resolve)
  );

  if (!seedRes?.success) {
    const err = typeof seedRes?.error === "object"
      ? JSON.stringify(seedRes.error)
      : (seedRes?.error ?? "unknown");
    if (/already|unique|duplicate|exist/i.test(err)) {
      updateAutoPanel(`  → "${biz.name}" already exists, skipping`, "dim");
      return "skipped";
    }
    updateAutoPanel(`  ✗ Error seeding "${biz.name}": ${err}`, "error");
    return "error";
  }

  const { id: businessId, slug } = seedRes.data;

  // ── 9. Seed reviews ───────────────────────────────────────────────────────
  if (reviews.length > 0) {
    updateAutoPanel(`  → Importing ${reviews.length} reviews…`, "dim");
    await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { action: "SEED_REVIEWS", businessId, token: config.token, source: "google", reviews },
        resolve
      )
    );
  }

  // Mark the card visually (it may still be in DOM after history.back)
  card.style.outline = "2px solid #2e7d32";
  card.style.opacity = "0.65";
  const seedBtn = card.querySelector(".td-seed-inline");
  if (seedBtn) {
    seedBtn.classList.add("td-seeded");
    const lbl = seedBtn.querySelector(".td-seed-label");
    if (lbl) lbl.textContent = "Seeded ✓";
  }

  const suffix = reviews.length > 0 ? ` · ${reviews.length} reviews` : "";
  updateAutoPanel(`  ✓ ${biz.name} → /b/${slug}${suffix}`, "success");
  return "seeded";
}

// ── Area resolution: GPS → name match → create ────────────────────────────────

async function resolveArea(lat, lng, address, token) {
  // 1. Nearest existing area with GPS within 1 km
  if (lat != null && lng != null) {
    const nearest = findNearestArea(lat, lng, tdAreas, 1000);
    if (nearest) return nearest.id;
  }

  // 2. Parse neighbourhood from address; check existing areas by name
  const name = parseAreaFromAddress(address);
  if (name) {
    const existing = tdAreas.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    // 3. Create new area
    const createRes = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { action: "CREATE_AREA", token, name, city: "Kathmandu", lat, lng },
        resolve
      )
    );
    if (createRes?.success) {
      const area = createRes.data;
      tdAreas.push(area); // Keep local list in sync
      updateAutoPanel(`  + Created area: ${name}`, "info");
      return area.id;
    }
  }

  return null; // Caller will skip this business
}

// ── Scroll search-results feed to load more cards ─────────────────────────────

async function scrollFeedPanel() {
  const feed =
    document.querySelector('[role="feed"]') ||
    document.querySelector("div.m6QErb[aria-label]") ||
    document.querySelector("div.m6QErb");
  if (!feed) return false;

  const before = document.querySelectorAll("div[role='article'].Nv2PK").length;
  feed.scrollBy({ top: 2000, behavior: "smooth" });
  await sleep(2500);
  const after = document.querySelectorAll("div[role='article'].Nv2PK").length;
  return after > before;
}
