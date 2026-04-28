/**
 * background.js — Manifest V3 service worker
 *
 * Handles three API targets:
 *   1. NEPSE pipeline  (localhost:8000) — Facebook post ingestion
 *   2. TomDum API      (localhost:4000) — Business seeding
 *   3. TomDum reviews  (localhost:4000) — External review import + AI insights
 */

const NEPSE_API        = "http://localhost:8000/ingest-facebook";
const TOMDUM_API_LOCAL = "http://localhost:4000";
const TOMDUM_API_LIVE  = "https://tomdum.com/api";

function getApiBase() {
  return new Promise((resolve) => {
    chrome.storage.local.get("tomdumApiUrl", ({ tomdumApiUrl }) => {
      resolve(tomdumApiUrl || TOMDUM_API_LOCAL);
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // ── TomDum: fetch categories ───────────────────────────────────
  if (message.action === "FETCH_CATEGORIES") {
    getApiBase().then((base) =>
      fetch(`${base}/categories`)
        .then((r) => r.json())
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );
    return true;
  }

  // ── TomDum: fetch areas ────────────────────────────────────────
  if (message.action === "FETCH_AREAS") {
    getApiBase().then((base) =>
      fetch(`${base}/areas`)
        .then((r) => r.json())
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );
    return true;
  }

  // ── TomDum: seed a business ────────────────────────────────────
  if (message.action === "SEED_BUSINESS") {
    const { token, business } = message;

    getApiBase().then((base) =>
      fetch(`${base}/admin/businesses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(business),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = typeof body.error === "string"
              ? body.error
              : JSON.stringify(body.error) || `HTTP ${res.status}`;
            throw new Error(msg);
          }
          return res.json();
        })
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );

    return true;
  }

  // ── TomDum: save scraped reviews ───────────────────────────────
  if (message.action === "SEED_REVIEWS") {
    const { businessId, token, source, reviews } = message;

    getApiBase().then((base) =>
      fetch(`${base}/admin/businesses/${businessId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ source, reviews }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );

    return true;
  }

  // ── TomDum: trigger AI insights generation ─────────────────────
  // Fire-and-forget — GENERATE_INSIGHTS only works on local (Ollama not on live).
  if (message.action === "GENERATE_INSIGHTS") {
    const { businessId, token } = message;

    getApiBase().then((base) =>
      fetch(`${base}/admin/businesses/${businessId}/generate-insights`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          sendResponse({ success: res.ok, data: body });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );

    return true;
  }

  // ── TomDum: login with email + password ───────────────────────
  if (message.action === "LOGIN") {
    const { identifier, password } = message;
    getApiBase().then((base) =>
      fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
          sendResponse({ success: true, data: body }); // { token, user }
        })
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );
    return true;
  }

  // ── TomDum: create new category ───────────────────────────────
  if (message.action === "CREATE_CATEGORY") {
    const { token, name, icon, parentId } = message;
    getApiBase().then((base) =>
      fetch(`${base}/admin/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name, icon, parentId: parentId || undefined }),
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
          sendResponse({ success: true, data: body });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );
    return true;
  }

  // ── TomDum: create new area ────────────────────────────────────
  if (message.action === "CREATE_AREA") {
    const { token, name, city, lat, lng } = message;
    getApiBase().then((base) =>
      fetch(`${base}/admin/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name, city, lat: lat ?? undefined, lng: lng ?? undefined }),
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
          sendResponse({ success: true, data: body });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }))
    );
    return true;
  }

  // ── NEPSE Facebook post ingestion ──────────────────────────────
  if (message.action === "SEND_TO_NEPSE_API") {
    const { posts, groupName } = message;

    fetch(NEPSE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: groupName, posts }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true;
  }
});
