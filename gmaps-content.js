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
    label.textContent = "Scanning…";
    btn.classList.add("td-loading");

    // Extract hours + description + photos from Overview (current tab)
    const detail = extractFromDetailPanel();
    const photos = extractPhotos();

    // Click Reviews tab → scrape → click About tab → scrape
    const reviews    = await extractReviews();
    const attributes = await extractAboutAttributes();

    // Restore Overview tab so the user's panel looks normal
    await clickTabAndWait("Overview", 800);

    label.textContent = "Seed";
    btn.classList.remove("td-loading");

    const enriched = { ...biz, ...detail, attributes, photos, _reviews: reviews, _sourceBtn: btn };
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

  document.getElementById(PANEL_ID)?.remove();
  if (tdObserver) { tdObserver.disconnect(); tdObserver = null; }

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

  injectStyles();
  injectIntoAllCards();

  tdObserver = new MutationObserver(injectIntoAllCards);
  tdObserver.observe(document.body, { childList: true, subtree: true });
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
