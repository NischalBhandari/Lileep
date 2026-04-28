// Data extraction functions for Google Maps business cards and detail panels.
// Depends on: gmaps-state.js (sleep, clickTabAndWait)

// ─────────────────────────────────────────────
// 1. Extract basic data from a search-result card
// ─────────────────────────────────────────────

function extractFromCard(article) {
  const name = article.querySelector(".qBF1Pd")?.textContent?.trim() ?? null;

  const firstRow = article.querySelector(".W4Efsd .W4Efsd");
  let googleCategory = null, address = null;
  if (firstRow) {
    const parts = (firstRow.textContent ?? "").split("·").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) googleCategory = parts[0];
    if (parts.length > 1) address = parts[parts.length - 1];
  }

  const phone = article.querySelector(".UsdlK")?.textContent?.trim() ?? null;

  const websiteEl = article.querySelector("a.lcr4fd[href]");
  let website = websiteEl?.getAttribute("href") ?? null;
  if (website && (website.startsWith("/aclk") || website.includes("google.com/aclk"))) {
    website = null;
  }

  let lat = null, lng = null;
  const placeLink = article.querySelector("a.hfpxzc[href]");
  if (placeLink) {
    const m = (placeLink.getAttribute("href") ?? "").match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
  }

  return { name, googleCategory, address, phone, website, lat, lng };
}

// ─────────────────────────────────────────────
// 2. Extract hours + description from the OVERVIEW tab
//    (synchronous — Overview is the default open tab)
// ─────────────────────────────────────────────

function extractFromDetailPanel() {
  const panel = document.querySelector('[role="main"]');
  if (!panel) return {};

  // Description — try several known class/attribute patterns
  let description = null;
  for (const sel of [".PYvSYb", ".WgFkxc", '[data-attrid*="description"] span', ".HlvSq"]) {
    const text = panel.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 10) { description = text; break; }
  }

  // Hours — full schedule in aria-label on the [data-item-id="oh"] button
  let hours = null;
  const hoursBtn = panel.querySelector('[data-item-id="oh"]');
  if (hoursBtn) {
    const label = hoursBtn.getAttribute("aria-label") ?? "";
    hours = parseHoursLabel(label);
    console.log("[TomDum] Raw hours label:", label);
  }

  return { description, hours };
}

function parseHoursLabel(label) {
  const DAY = {
    monday: "mon", tuesday: "tue", wednesday: "wed",
    thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  };
  const result = {};
  for (const entry of label.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(":");
    if (colon === -1) continue;
    const dayKey  = DAY[entry.slice(0, colon).trim().toLowerCase()];
    const timeRaw = entry.slice(colon + 1).trim();
    if (!dayKey) continue;
    if (/closed/i.test(timeRaw)) { result[dayKey] = "closed"; continue; }
    const m = timeRaw.match(/(\d{1,2}:\d{2})\s*(AM|PM)\s*[–\-]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i);
    if (m) result[dayKey] = `${to24h(m[1], m[2])}-${to24h(m[3], m[4])}`;
    else   result[dayKey] = timeRaw;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function to24h(time, period) {
  let [h, m] = time.split(":").map(Number);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// 3. Scrape photo URLs from the overview panel
//    Google serves them from lh3.googleusercontent.com — no auth needed,
//    load directly in <img src="..."> on your frontend.
// ─────────────────────────────────────────────

function extractPhotos() {
  // Google Maps photo carousel: div.fp2VUc > ... > button.K4UgGe > img.DaSXdd
  // Each button is a photo CATEGORY (All, Exterior, By owner, Street View).
  // img.DaSXdd is the representative thumbnail for that category.
  //
  // URL formats seen:
  //   lh3.googleusercontent.com/gps-cs-s/<id>=w397-h298-k-no   ← business photos
  //   streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=…  ← street view (skip)

  const seen   = new Set();
  const photos = [];

  document.querySelectorAll("img.DaSXdd").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;

    // Skip Street View thumbnails — not actual business photos
    if (src.includes("streetviewpixels-pa.googleapis.com")) return;
    if (!src.includes("lh3.googleusercontent.com")) return;

    // Normalise size: strip existing size params, request 800×600
    const base = src.replace(/=w\d+.*$/, "");
    if (seen.has(base)) return;
    seen.add(base);

    photos.push(base + "=w800-h600-k-no");
  });

  console.log(`[TomDum] ${photos.length} category photos found`);
  return photos;
}

// ─────────────────────────────────────────────
// 4. Scrape Google reviews — clicks the Reviews tab first
// ─────────────────────────────────────────────

async function extractReviews() {
  const clicked = await clickTabAndWait("Reviews", 2500);
  if (!clicked) {
    console.warn("[TomDum] Could not click Reviews tab — no reviews scraped");
    return [];
  }

  const reviews = [];

  // Try both known review-card selectors
  const reviewEls = [
    ...document.querySelectorAll("[data-review-id]"),
    ...document.querySelectorAll("[data-reviewid]"),
    ...document.querySelectorAll(".jftiEf"),   // common review card class
    ...document.querySelectorAll(".GHT2ce"),   // alternate review card class
  ];
  // Deduplicate by element reference
  const seen = new Set();
  const uniqueEls = reviewEls.filter((el) => { if (seen.has(el)) return false; seen.add(el); return true; });

  console.log(`[TomDum] Found ${uniqueEls.length} review card elements`);

  uniqueEls.forEach((el) => {
    const externalId =
      el.getAttribute("data-review-id") ||
      el.getAttribute("data-reviewid") ||
      undefined;

    const authorName =
      el.querySelector(".d4r55")?.textContent?.trim() ||
      el.querySelector(".X43Kjb")?.textContent?.trim() ||
      el.querySelector("[class*='author']")?.textContent?.trim() ||
      null;

    let rating = null;
    const ratingEl = el.querySelector('[aria-label*="star"]') || el.querySelector('[aria-label*="Star"]');
    if (ratingEl) {
      const m = (ratingEl.getAttribute("aria-label") ?? "").match(/(\d+(?:\.\d+)?)/);
      if (m) rating = parseFloat(m[1]);
    }

    // Try multiple text selectors — Google's classes change with deploys
    const text =
      el.querySelector(".wiI7pd span")?.textContent?.trim() ||
      el.querySelector(".MyEned span")?.textContent?.trim() ||
      el.querySelector(".Jtu6Td")?.textContent?.trim() ||
      null;

    console.log("[TomDum] Review:", { externalId, authorName, rating, text: text?.slice(0, 60) });

    if (authorName || text) {
      reviews.push({ externalId, authorName, rating, text });
    }
  });

  console.log(`[TomDum] ${reviews.length} reviews scraped`);
  return reviews;
}

// ─────────────────────────────────────────────
// 5. Scrape About tab structured attributes
//    e.g. { accessibility: ["Wheelchair-accessible entrance"], payments: ["NFC"] }
// ─────────────────────────────────────────────

async function extractAboutAttributes() {
  const clicked = await clickTabAndWait("About", 2500);
  if (!clicked) {
    console.warn("[TomDum] Could not click About tab — no attributes scraped");
    return null;
  }

  // The About content lives inside the role="region" div labelled "About <name>"
  const region = document.querySelector('[role="region"][aria-label^="About "]');
  if (!region) {
    console.warn("[TomDum] About region not found after tab click");
    return null;
  }

  const attributes = {};

  // Structure (from actual DOM):
  //   div.iP2t7d
  //     h2.iL3Qke  ← section heading ("Accessibility", "Payments", …)
  //     ul.ZQ6we
  //       li.hpLkke
  //         div.iNvpkb
  //           span[aria-label="Has wheelchair-accessible entrance"]
  //             ← text content: "Wheelchair-accessible entrance"

  region.querySelectorAll(".iP2t7d").forEach((section) => {
    const heading = section.querySelector("h2.iL3Qke, h2.fontTitleSmall")?.textContent?.trim();
    if (!heading) return;

    const key = normalizeAttributeKey(heading);
    const items = [];

    // Use text content of the span (cleaner than aria-label which adds "Has …" / "Accepts …")
    section.querySelectorAll("ul.ZQ6we li span[aria-label]").forEach((span) => {
      const text = span.textContent?.trim();
      if (text) items.push(text);
    });

    if (items.length > 0) attributes[key] = items;
  });

  console.log("[TomDum] About attributes:", attributes);
  return Object.keys(attributes).length > 0 ? attributes : null;
}

function normalizeAttributeKey(text) {
  return text.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
