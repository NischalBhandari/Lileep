// Shared state and utilities for the Google Maps TomDum seeder.
// Loaded first so all subsequent content scripts can access these globals.

const PANEL_ID = "tomdum-seed-panel";
let tdCategories  = [];
let tdAreas       = [];
let tdSavedToken  = null;
let tdSavedUser   = null;
let tdPanelBiz    = null;
let tdObserver    = null;

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
