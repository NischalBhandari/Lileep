// Data extraction functions for Google Maps business cards and detail panels.
// Depends on: gmaps-state.js (sleep, clickTabAndWait)

// ─────────────────────────────────────────────
// 1. Extract basic data from a search-result card
// ─────────────────────────────────────────────

function extractFromCard(article) {
  // Name — class stable enough in practice
  const name = article.querySelector(".qBF1Pd")?.textContent?.trim() ?? null;

  // Category + address — only nested .W4Efsd divs; exclude the rating row (.AJB7ye)
  let googleCategory = null, address = null;
  const infoRows = [...article.querySelectorAll(".W4Efsd .W4Efsd")]
    .filter(el => !el.closest(".AJB7ye"));

  for (const row of infoRows) {
    const text = row.textContent?.trim() ?? "";
    if (!text) continue;
    const parts = text.split("·").map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    const first = parts[0];
    // Skip rating rows ("4.9 (447)") and hours-status rows ("Closed", "Closes soon", etc.)
    if (/^\d+\.?\d*\s*[\(\d]/.test(first)) continue;
    if (/^(open|closed|closes|opens|\d{1,2}:\d{2})/i.test(first)) continue;

    if (!googleCategory) googleCategory = first;

    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      // Reject if it looks like hours status or a Plus Code (e.g. "P83X+9H7")
      if (!/^(open|closed|closes|opens)/i.test(last) &&
          !/^\d{1,2}:\d{2}\s*(AM|PM)/i.test(last) &&
          !/^[A-Z0-9]{4,5}\+[A-Z0-9]{2,4}$/.test(last)) {
        address = last;
      }
    }

    if (googleCategory && address) break;
  }

  // Phone — stable: prefer tel: link; class-based selector as fallback
  let phone = null;
  const telLink = article.querySelector("a[href^='tel:']");
  if (telLink) {
    phone = telLink.getAttribute("href").replace("tel:", "").trim();
  } else {
    // Class names change — try several known variants and aria-label
    const phoneEl = article.querySelector(".UsdlK, .rogA2c, [aria-label*='phone' i], [aria-label*='call' i]");
    if (phoneEl) {
      phone = phoneEl.getAttribute("aria-label")?.match(/[\+\d][\d\s\-().]{6,}/)?.[0]?.trim()
           ?? phoneEl.textContent?.trim()
           ?? null;
    }
  }

  // Website — stable: skip Google ad redirects; prefer non-google external links
  let website = null;
  const candidates = [
    article.querySelector("a.lcr4fd[href]"),
    article.querySelector("a[data-item-id='authority']"),
    article.querySelector("a[aria-label*='website' i]"),
    ...article.querySelectorAll("a[href^='http']"),
  ].filter(Boolean);
  for (const el of candidates) {
    const href = el.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("/aclk") || href.includes("google.com/aclk") || href.includes("google.com/maps")) continue;
    if (href.includes("google.") || href.includes("goo.gl")) continue;
    website = href;
    break;
  }

  // GPS — encoded in the place link href
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

  // ── Phone ────────────────────────────────────────────────────────────────────
  // Search the whole document — the action buttons (phone, website) are often
  // rendered in a sibling panel container, NOT inside [role="main"].
  let phone = null;
  const phoneEl =
    document.querySelector('[data-item-id^="phone:tel:"]') ??
    document.querySelector('[aria-label^="Phone:"]') ??
    document.querySelector('[data-tooltip="Copy phone number"]');
  if (phoneEl) {
    // Prefer formatted number from aria-label: "Phone: 985-1348288"
    const fromLabel = phoneEl.getAttribute("aria-label")?.match(/Phone[:\s]+(.+)/i)?.[1]?.trim();
    // Fallback: raw digits from data-item-id: "phone:tel:9851348288"
    const fromId = phoneEl.getAttribute("data-item-id")?.replace("phone:tel:", "").trim();
    phone = fromLabel || fromId || null;
  }
  if (!phone) {
    const telLink = document.querySelector("a[href^='tel:']");
    if (telLink) phone = telLink.getAttribute("href").replace("tel:", "").trim();
  }
  console.log("[TomDum] Phone:", phone);

  // ── Website ───────────────────────────────────────────────────────────────────
  let website = null;
  // The website link uses data-item-id="authority" — search the whole document
  const websiteLink =
    document.querySelector("a[data-item-id='authority']") ??
    document.querySelector('[data-tooltip="Open website"]') ??
    document.querySelector('[data-tooltip="Visit website"]');
  if (websiteLink) {
    const href = websiteLink.getAttribute("href") ?? "";
    if (href && !href.startsWith("/aclk") && !href.includes("google.com/aclk")) website = href;
  }
  if (!website) {
    // aria-label="Website: example.com" on a button — extract the URL from the label
    const websiteLabelEl = document.querySelector('[aria-label^="Website:"]');
    if (websiteLabelEl) {
      website = websiteLabelEl.getAttribute("aria-label")?.match(/Website[:\s]+(.+)/i)?.[1]?.trim() ?? null;
    }
  }
  console.log("[TomDum] Website:", website);

  // ── Address — data-item-id="address" with the text in aria-label ──────────
  let address = null;
  const addrBtn = panel.querySelector('[data-item-id="address"]');
  if (addrBtn) {
    const label = addrBtn.getAttribute("aria-label") ?? "";
    address = label.replace(/^address[:\s]*/i, "").trim() || addrBtn.textContent?.trim() || null;
  }

  // ── Description — try stable data-attrid first, then broad text search ────
  let description = null;
  for (const sel of [
    '[data-attrid*="description"] span',
    '[data-attrid*="merchant_description"] span',
    ".PYvSYb", ".WgFkxc", ".HlvSq",
  ]) {
    const text = panel.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 15) { description = text; break; }
  }

  // ── Hours — try old data-item-id="oh" first, then the new inline table ──────
  let hours = null;
  const hoursBtn = panel.querySelector('[data-item-id="oh"]');
  if (hoursBtn) {
    const label = hoursBtn.getAttribute("aria-label") ?? "";
    hours = parseHoursLabel(label);
    console.log("[TomDum] Raw hours label (old):", label);
  } else {
    hours = parseHoursTable(panel);
  }

  return { phone, website, address, description, hours };
}

// Old format: "monday: 9:00 AM – 5:00 PM; tuesday: closed; …"
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

// New format: table.eK4R0e with tr.y0skZc rows — td.ylH6lf = day, td.mxowUb = hours
function parseHoursTable(panel) {
  const DAY = {
    monday: "mon", tuesday: "tue", wednesday: "wed",
    thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  };
  const table = panel.querySelector("table.eK4R0e");
  if (!table) return null;

  const result = {};
  table.querySelectorAll("tr.y0skZc").forEach((row) => {
    const dayText = row.querySelector("td.ylH6lf")?.textContent?.trim().toLowerCase();
    const dayKey  = DAY[dayText];
    if (!dayKey) return;

    const cell  = row.querySelector("td.mxowUb");
    if (!cell) return;
    // aria-label is cleaner than text content (avoids nested whitespace)
    const label = cell.getAttribute("aria-label")?.trim()
               ?? cell.querySelector("li.G8aQO")?.textContent?.trim()
               ?? cell.textContent?.trim();
    if (!label) return;

    if (/closed/i.test(label))        { result[dayKey] = "closed";     return; }
    if (/open 24 hours/i.test(label)) { result[dayKey] = "00:00-24:00"; return; }

    const m = label.match(/(\d{1,2}:\d{2})\s*(AM|PM)\s*[–\-]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i);
    if (m) result[dayKey] = `${to24h(m[1], m[2])}-${to24h(m[3], m[4])}`;
    else   result[dayKey] = label;
  });

  if (Object.keys(result).length > 0) {
    console.log("[TomDum] Hours parsed from table:", result);
    return result;
  }
  return null;
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
