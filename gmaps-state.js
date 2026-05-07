// Shared state and utilities for the Google Maps TomDum seeder.
// Loaded first so all subsequent content scripts can access these globals.

const PANEL_ID = "tomdum-seed-panel";
let tdCategories  = [];
let tdAreas       = [];
let tdSavedToken  = null;
let tdSavedUser   = null;
let tdPanelBiz    = null;
let tdObserver    = null;

// ── Auto-seed state ───────────────────────────────────────────────────────────
let tdAutoRunning = false;
let tdAutoStats   = { done: 0, skipped: 0, errors: 0 };

// ── Geo helpers ───────────────────────────────────────────────────────────────

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R    = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns the nearest area object whose GPS is within thresholdMeters, or null.
function findNearestArea(lat, lng, areas, thresholdMeters = 1000) {
  let nearest = null, minDist = Infinity;
  for (const area of areas) {
    if (area.lat == null || area.lng == null) continue;
    const d = haversineMeters(lat, lng, area.lat, area.lng);
    if (d < minDist) { minDist = d; nearest = area; }
  }
  return minDist <= thresholdMeters ? nearest : null;
}

// Extract a neighbourhood name from a Google Maps address string.
// e.g. "Thamel, Kathmandu 44600, Nepal" → "Thamel"
function parseAreaFromAddress(address) {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (/[A-Z0-9]{4}\+[A-Z0-9]{3,}/.test(part))            continue; // plus code
    if (/kathmandu|nepal|lalitpur|bhaktapur/i.test(part))   continue;
    if (/^\d[\d\s]*$/.test(part))                           continue; // pure number / zip
    if (part.length < 3)                                    continue;
    return part;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find a tab button anywhere in the page by its visible text label and click it.
 * Tries exact match first, then prefix match (handles "Reviews (23)" etc.).
 * Waits `waitMs` for the content to load after the click.
 * Returns true if the tab was found and clicked.
 */
async function clickTabAndWait(tabText, waitMs = 1600) {
  const needle = tabText.toLowerCase();

  // Search the whole document — the detail panel tab bar may not be inside [role="main"]
  const allTabs = [...document.querySelectorAll('[role="tab"]')];

  // 1. Exact match
  let tab = allTabs.find((t) => t.textContent?.trim().toLowerCase() === needle);

  // 2. Starts-with match  (e.g. "Reviews 142" still matches "reviews")
  if (!tab) tab = allTabs.find((t) => t.textContent?.trim().toLowerCase().startsWith(needle));

  // 3. Contains match
  if (!tab) tab = allTabs.find((t) => t.textContent?.trim().toLowerCase().includes(needle));

  // 4. aria-label fallback
  if (!tab) tab = allTabs.find((t) => t.getAttribute("aria-label")?.toLowerCase().includes(needle));

  if (!tab) {
    console.warn(`[TomDum] Tab "${tabText}" not found. All [role="tab"] text:`,
      allTabs.map((t) => `"${t.textContent?.trim()}" aria="${t.getAttribute("aria-label")}"`));
    return false;
  }

  console.log(`[TomDum] Clicking tab: "${tab.textContent?.trim()}" aria="${tab.getAttribute("aria-label")}"`);

  // Google Maps uses jsaction — dispatch a real MouseEvent so it propagates correctly
  tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  tab.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true }));
  tab.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true }));

  await sleep(waitMs);

  // Confirm the tab actually activated
  const selected = tab.getAttribute("aria-selected");
  console.log(`[TomDum] Tab aria-selected after click: "${selected}"`);

  return true;
}
