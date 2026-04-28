// UI components for the TomDum seeder panel injected on Google Maps.
// Depends on: gmaps-state.js (PANEL_ID, tdCategories, tdAreas, tdSaved*, tdPanelBiz)

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("tomdum-styles")) return;
  const style = document.createElement("style");
  style.id = "tomdum-styles";
  style.textContent = `
    .td-seed-inline {
      display: flex; flex-direction: column; align-items: center;
      gap: 2px; padding: 4px 8px; background: none; border: none; cursor: pointer;
    }
    .td-seed-inline .td-seed-icon { font-size: 18px; line-height: 1; }
    .td-seed-inline .td-seed-label {
      font-size: 12px; font-weight: 600; color: #1a73e8; white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .td-seed-inline:hover .td-seed-label { color: #1558b0; }
    .td-seed-inline.td-seeded .td-seed-label { color: #2e7d32 !important; }
    .td-seed-inline.td-loading .td-seed-label { color: #888 !important; }

    #tomdum-seed-panel {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 310px; background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; color: #1c1e21; overflow: hidden; transition: box-shadow 0.2s;
    }
    #tomdum-seed-panel:hover { box-shadow: 0 6px 32px rgba(0,0,0,0.22); }
    #tomdum-seed-panel .td-header {
      background: #1a73e8; color: white; padding: 10px 14px;
      font-weight: 700; font-size: 13px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #tomdum-seed-panel .td-header span { font-weight: 400; font-size: 11px; opacity: 0.85; }
    #tomdum-seed-panel .td-close {
      cursor: pointer; font-size: 16px; opacity: 0.8;
      background: none; border: none; color: white; padding: 0 0 0 8px;
    }
    #tomdum-seed-panel .td-close:hover { opacity: 1; }
    #tomdum-seed-panel .td-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
    #tomdum-seed-panel .td-biz-name {
      font-weight: 700; font-size: 14px; color: #111;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #tomdum-seed-panel .td-meta { font-size: 11px; color: #555; line-height: 1.6; }
    #tomdum-seed-panel .td-meta div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #tomdum-seed-panel .td-meta .td-dim { color: #aaa; }
    #tomdum-seed-panel select {
      width: 100%; padding: 7px 9px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 12px; background: white; outline: none; cursor: pointer;
    }
    #tomdum-seed-panel select:focus { border-color: #1a73e8; }

    /* Searchable dropdown */
    #tomdum-seed-panel .td-search-wrap { position: relative; }
    #tomdum-seed-panel .td-search-input {
      width: 100%; padding: 7px 28px 7px 9px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 12px; background: white; outline: none;
      box-sizing: border-box; cursor: text;
    }
    #tomdum-seed-panel .td-search-input:focus { border-color: #1a73e8; }
    #tomdum-seed-panel .td-search-caret {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #888; pointer-events: none;
    }
    #tomdum-seed-panel .td-search-dropdown {
      position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 99999;
      background: white; border: 1px solid #ccc; border-radius: 6px;
      max-height: 160px; overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12); display: none;
    }
    #tomdum-seed-panel .td-search-dropdown.open { display: block; }
    #tomdum-seed-panel .td-search-item {
      padding: 7px 10px; font-size: 12px; cursor: pointer; color: #1c1e21;
    }
    #tomdum-seed-panel .td-search-item:hover,
    #tomdum-seed-panel .td-search-item.highlighted { background: #e8f0fe; }
    #tomdum-seed-panel .td-search-item.selected { font-weight: 600; color: #1a73e8; }
    #tomdum-seed-panel .td-search-empty {
      padding: 7px 10px; font-size: 11px; color: #aaa; font-style: italic;
    }
    #tomdum-seed-panel .td-label {
      font-size: 10px; font-weight: 600; color: #888;
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px;
    }
    #tomdum-seed-panel .td-seed-btn {
      width: 100%; padding: 9px; background: #1a73e8; color: white;
      border: none; border-radius: 7px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    #tomdum-seed-panel .td-seed-btn:hover:not(:disabled) { background: #1558b0; }
    #tomdum-seed-panel .td-seed-btn:disabled { background: #93b8f5; cursor: not-allowed; }
    #tomdum-seed-panel .td-status { font-size: 11px; text-align: center; min-height: 14px; color: #555; }
    #tomdum-seed-panel .td-status.error   { color: #d32f2f; }
    #tomdum-seed-panel .td-status.success { color: #2e7d32; font-weight: 600; }
    #tomdum-seed-panel .td-divider { border: none; border-top: 1px solid #eee; margin: 0; }
    #tomdum-seed-panel .td-token-row { display: flex; gap: 6px; align-items: center; }
    #tomdum-seed-panel .td-token-row input {
      flex: 1; padding: 5px 8px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 11px; outline: none;
    }
    #tomdum-seed-panel .td-token-row input:focus { border-color: #1a73e8; }
    #tomdum-seed-panel .td-token-row button {
      padding: 5px 10px; background: #f0f0f0; border: 1px solid #ccc;
      border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;
    }
    #tomdum-seed-panel .td-token-row button:hover { background: #e0e0e0; }
    #tomdum-seed-panel .td-login-form { display: flex; flex-direction: column; gap: 6px; }
    #tomdum-seed-panel .td-login-form input {
      width: 100%; padding: 6px 9px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 12px; outline: none;
    }
    #tomdum-seed-panel .td-login-form input:focus { border-color: #1a73e8; }
    #tomdum-seed-panel .td-login-btn {
      width: 100%; padding: 7px; background: #1a73e8; color: white;
      border: none; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer;
    }
    #tomdum-seed-panel .td-login-btn:hover:not(:disabled) { background: #1558b0; }
    #tomdum-seed-panel .td-login-btn:disabled { background: #93b8f5; cursor: not-allowed; }
    #tomdum-seed-panel .td-login-error { font-size: 11px; color: #d32f2f; }
    #tomdum-seed-panel .td-logged-in {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 12px;
    }
    #tomdum-seed-panel .td-logged-in .td-user { color: #2e7d32; font-weight: 600; }
    #tomdum-seed-panel .td-logout-btn {
      padding: 4px 10px; background: #f0f0f0; border: 1px solid #ccc;
      border-radius: 5px; font-size: 11px; cursor: pointer;
    }
    #tomdum-seed-panel .td-logout-btn:hover { background: #e0e0e0; }

    #tomdum-seed-panel .td-add-row {
      display: flex; gap: 5px; margin-top: 5px; align-items: center;
    }
    #tomdum-seed-panel .td-add-row input {
      flex: 1; padding: 5px 8px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 11px; outline: none;
    }
    #tomdum-seed-panel .td-add-row input:focus { border-color: #1a73e8; }
    #tomdum-seed-panel .td-add-row button {
      padding: 5px 10px; background: #1a73e8; color: white;
      border: none; border-radius: 6px; font-size: 11px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    #tomdum-seed-panel .td-add-row button:hover { background: #1558b0; }
    #tomdum-seed-panel .td-add-row button:disabled { background: #93b8f5; cursor: not-allowed; }
    #tomdum-seed-panel .td-add-link {
      font-size: 10px; color: #1a73e8; cursor: pointer;
      margin-left: 4px; text-decoration: underline;
    }
    #tomdum-seed-panel .td-add-link:hover { color: #1558b0; }

    #tomdum-seed-panel .td-preview-btn {
      width: 100%; padding: 7px; background: #f8f9fa; color: #444;
      border: 1px solid #ddd; border-radius: 7px; font-size: 12px; font-weight: 500;
      cursor: pointer; transition: background 0.15s;
    }
    #tomdum-seed-panel .td-preview-btn:hover { background: #e8eaed; }

    #tomdum-preview-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center;
    }
    #tomdum-preview-overlay .td-preview-box {
      background: #1e1e1e; color: #d4d4d4; border-radius: 10px;
      width: 90vw; max-width: 700px; max-height: 80vh;
      display: flex; flex-direction: column;
      font-family: "Consolas", "Fira Mono", monospace; font-size: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    }
    #tomdum-preview-overlay .td-preview-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 16px; border-bottom: 1px solid #333;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; font-weight: 600; color: #eee;
    }
    #tomdum-preview-overlay .td-preview-header .td-preview-tabs {
      display: flex; gap: 8px;
    }
    #tomdum-preview-overlay .td-preview-header .td-ptab {
      padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;
      background: #333; color: #aaa; border: 1px solid transparent;
    }
    #tomdum-preview-overlay .td-preview-header .td-ptab.active {
      background: #1a73e8; color: white;
    }
    #tomdum-preview-overlay .td-preview-close {
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 0;
    }
    #tomdum-preview-overlay .td-preview-close:hover { color: #eee; }
    #tomdum-preview-overlay pre {
      margin: 0; padding: 16px; overflow: auto; flex: 1;
      white-space: pre-wrap; word-break: break-all; line-height: 1.5;
    }
    #tomdum-preview-overlay .td-copy-btn {
      margin: 10px 16px 12px; padding: 6px 14px;
      background: #333; color: #ccc; border: 1px solid #555;
      border-radius: 5px; font-size: 11px; cursor: pointer; align-self: flex-start;
    }
    #tomdum-preview-overlay .td-copy-btn:hover { background: #444; }

    /* Category tree dropdown */
    #tomdum-seed-panel .td-tree-parent { font-weight: 600; color: #222; background: #f5f7fa; }
    #tomdum-seed-panel .td-tree-parent:hover,
    #tomdum-seed-panel .td-tree-parent.highlighted { background: #e8f0fe; }
    #tomdum-seed-panel .td-tree-arrow { font-size: 9px; color: #888; margin-right: 5px; }
    #tomdum-seed-panel .td-tree-dot { display: inline-block; width: 12px; color: #ccc; margin-right: 3px; text-align: center; }
    #tomdum-seed-panel .td-tree-context { font-size: 10px; color: #aaa; margin-left: 6px; font-style: italic; }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────
// Searchable dropdown helper
// ─────────────────────────────────────────────

/**
 * Converts a plain container div into a searchable dropdown.
 * @param {HTMLElement} wrap     - .td-search-wrap container already in the DOM
 * @param {Array}       items    - [{ id, label }]
 * @param {string}      placeholder
 * @returns {{ getValue, setValue, addItem, setItems, reset }}
 */
function makeSearchableDropdown(wrap, items, placeholder) {
  let selected = { id: "", label: "" };
  let highlighted = -1;

  wrap.innerHTML = `
    <input class="td-search-input" type="text" placeholder="${placeholder}" autocomplete="off" />
    <span class="td-search-caret">▼</span>
    <div class="td-search-dropdown"></div>
  `;

  const input    = wrap.querySelector(".td-search-input");
  const dropdown = wrap.querySelector(".td-search-dropdown");

  function getFiltered(query) {
    const q = query.toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : [...items];
  }

  function renderList(query) {
    const filtered = getFiltered(query);
    highlighted = -1;
    if (filtered.length === 0) {
      dropdown.innerHTML = `<div class="td-search-empty">No results</div>`;
    } else {
      dropdown.innerHTML = filtered.map((item, idx) =>
        `<div class="td-search-item${item.id === selected.id ? " selected" : ""}"
              data-id="${item.id}" data-idx="${idx}">${item.label}</div>`
      ).join("");

      dropdown.querySelectorAll(".td-search-item").forEach((el) => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault(); // keep focus on input
          selectItem({ id: el.dataset.id, label: el.textContent });
        });
      });
    }
    dropdown.classList.add("open");
  }

  function selectItem(item) {
    selected = item;
    input.value = item.label;
    dropdown.classList.remove("open");
    highlighted = -1;
  }

  function moveHighlight(dir) {
    const els = [...dropdown.querySelectorAll(".td-search-item")];
    if (!els.length) return;
    els.forEach((e) => e.classList.remove("highlighted"));
    highlighted = Math.max(0, Math.min(els.length - 1, highlighted + dir));
    els[highlighted]?.classList.add("highlighted");
    els[highlighted]?.scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", () => renderList(input.value));
  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveHighlight(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const highlighted_el = dropdown.querySelector(".td-search-item.highlighted");
      if (highlighted_el) selectItem({ id: highlighted_el.dataset.id, label: highlighted_el.textContent });
    }
    else if (e.key === "Escape") { dropdown.classList.remove("open"); }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.remove("open");
  }, true);

  return {
    getValue: () => selected.id,
    setValue: (id, label) => { selected = { id, label }; input.value = label; },
    addItem:  (item) => { items.push(item); },
    setItems: (newItems) => { items.length = 0; items.push(...newItems); },
    reset:    () => { selected = { id: "", label: "" }; input.value = ""; },
  };
}

// ─────────────────────────────────────────────
// Category tree dropdown
// ─────────────────────────────────────────────

/**
 * Like makeSearchableDropdown but renders the nested category tree returned by
 * GET /categories: [{ id, name, children: [{ id, name }] }]
 *
 * Browse mode  → shows parents as bold group headers with children indented.
 * Search mode  → shows flat filtered results with "(Parent)" context label.
 * Both parents and children are selectable.
 */
function makeCategoryTreeDropdown(wrap, categories, placeholder) {
  let selected    = { id: "", label: "" };
  let highlighted = -1;

  wrap.innerHTML = `
    <input class="td-search-input" type="text" placeholder="${placeholder}" autocomplete="off" />
    <span class="td-search-caret">▼</span>
    <div class="td-search-dropdown"></div>
  `;

  const input    = wrap.querySelector(".td-search-input");
  const dropdown = wrap.querySelector(".td-search-dropdown");

  function esc(str) { return str.replace(/"/g, "&quot;"); }

  // Flat list of all items (parents + children) used for search
  function flatAll() {
    const out = [];
    categories.forEach(parent => {
      out.push({ id: parent.id, name: parent.name, parentName: null });
      (parent.children ?? []).forEach(child => {
        out.push({ id: child.id, name: child.name, parentName: parent.name });
      });
    });
    return out;
  }

  function renderTree() {
    highlighted = -1;
    if (categories.length === 0) {
      dropdown.innerHTML = `<div class="td-search-empty">No categories</div>`;
      dropdown.classList.add("open");
      return;
    }
    const rows = [];
    categories.forEach(parent => {
      const hasChildren = (parent.children ?? []).length > 0;
      rows.push(
        `<div class="td-search-item${hasChildren ? " td-tree-parent" : ""}${parent.id === selected.id ? " selected" : ""}"
              data-id="${esc(parent.id)}" data-label="${esc(parent.name)}">
           ${hasChildren ? '<span class="td-tree-arrow">▸</span>' : ""}${parent.name}
         </div>`
      );
      (parent.children ?? []).forEach(child => {
        rows.push(
          `<div class="td-search-item${child.id === selected.id ? " selected" : ""}"
                data-id="${esc(child.id)}" data-label="${esc(child.name)}"
                style="padding-left:22px">
             <span class="td-tree-dot">·</span>${child.name}
           </div>`
        );
      });
    });
    dropdown.innerHTML = rows.join("");
    bindClicks();
    dropdown.classList.add("open");
  }

  function renderSearch(query) {
    highlighted = -1;
    const q = query.toLowerCase();
    const matches = flatAll().filter(c => c.name.toLowerCase().includes(q));
    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="td-search-empty">No results</div>`;
    } else {
      dropdown.innerHTML = matches.map(c =>
        `<div class="td-search-item${c.id === selected.id ? " selected" : ""}"
              data-id="${esc(c.id)}" data-label="${esc(c.name)}">
           ${c.name}${c.parentName ? `<span class="td-tree-context">${c.parentName}</span>` : ""}
         </div>`
      ).join("");
      bindClicks();
    }
    dropdown.classList.add("open");
  }

  function bindClicks() {
    dropdown.querySelectorAll(".td-search-item").forEach(el => {
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        selectItem({ id: el.dataset.id, label: el.dataset.label });
      });
    });
  }

  function selectItem(item) {
    selected = item;
    input.value = item.label;
    dropdown.classList.remove("open");
    highlighted = -1;
  }

  function moveHighlight(dir) {
    const els = [...dropdown.querySelectorAll(".td-search-item")];
    if (!els.length) return;
    els.forEach(e => e.classList.remove("highlighted"));
    highlighted = Math.max(0, Math.min(els.length - 1, highlighted + dir));
    els[highlighted]?.classList.add("highlighted");
    els[highlighted]?.scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", () => input.value.trim() ? renderSearch(input.value) : renderTree());
  input.addEventListener("input", () => input.value.trim() ? renderSearch(input.value) : renderTree());
  input.addEventListener("keydown", e => {
    if      (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); moveHighlight(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const hl = dropdown.querySelector(".td-search-item.highlighted");
      if (hl) selectItem({ id: hl.dataset.id, label: hl.dataset.label });
    }
    else if (e.key === "Escape") dropdown.classList.remove("open");
  });

  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) dropdown.classList.remove("open");
  }, true);

  return {
    getValue: () => selected.id,
    setValue: (id, label) => { selected = { id, label }; input.value = label; },
    addItem: (item) => {
      if (item.parentId) {
        const parent = categories.find(c => c.id === item.parentId);
        if (parent) {
          parent.children = parent.children ?? [];
          parent.children.push({ id: item.id, name: item.label });
          return;
        }
      }
      categories.push({ id: item.id, name: item.label, children: [] });
    },
    reset:    () => { selected = { id: "", label: "" }; input.value = ""; },
  };
}

// ─────────────────────────────────────────────
// Floating panel — created once, reused across cards
// ─────────────────────────────────────────────

function getOrCreatePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="td-header">
      <div>TomDum Seeder <span>Kathmandu</span></div>
      <button class="td-close" id="td-close-btn">✕</button>
    </div>
    <div class="td-body">
      <div class="td-biz-name" id="td-biz-name">—</div>
      <div class="td-meta" id="td-meta"></div>
      <hr class="td-divider" />
      <div>
        <div class="td-label" style="display:flex;justify-content:space-between;align-items:center;">
          TomDum Category
          <span class="td-add-link" id="td-add-cat-link">+ Add new</span>
        </div>
        <div class="td-search-wrap" id="td-category-wrap"></div>
        <div id="td-add-cat-row" style="display:none; flex-direction:column; gap:5px; margin-top:5px">
          <select id="td-parent-cat-select" style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:6px;font-size:11px;outline:none;cursor:pointer">
            <option value="">— Top-level category —</option>
          </select>
          <div class="td-add-row" style="margin-top:0">
            <input type="text" id="td-new-cat-name" placeholder="Category name (e.g. Bakery)" />
            <button id="td-create-cat-btn">Create</button>
          </div>
        </div>
      </div>
      <div>
        <div class="td-label" style="display:flex;justify-content:space-between;align-items:center;">
          Area
          <span class="td-add-link" id="td-add-area-link">+ Add new</span>
        </div>
        <div class="td-search-wrap" id="td-area-wrap"></div>
        <div class="td-add-row" id="td-add-area-row" style="display:none">
          <input type="text" id="td-new-area-name" placeholder="Area name (e.g. Bouddha)" />
          <button id="td-create-area-btn">Create</button>
        </div>
      </div>
      <button class="td-preview-btn" id="td-preview-btn">Preview scraped data</button>
      <button class="td-seed-btn" id="td-seed-btn">Seed to TomDum</button>
      <div class="td-status" id="td-status"></div>
      <hr class="td-divider" />
      <div id="td-auth-section"></div>
    </div>
  `;

  document.body.appendChild(panel);

  const statusEl = panel.querySelector("#td-status");
  const setStatus = (msg, type = "") => {
    statusEl.textContent = msg;
    statusEl.className = "td-status " + type;
  };

  // Initialise searchable dropdowns
  const catDropdown = makeCategoryTreeDropdown(
    panel.querySelector("#td-category-wrap"),
    tdCategories,
    "Search category…"
  );
  const areaDropdown = makeSearchableDropdown(
    panel.querySelector("#td-area-wrap"),
    tdAreas.map((a) => ({ id: a.id, label: a.name })),
    "Search area…"
  );
  panel._catDropdown  = catDropdown;
  panel._areaDropdown = areaDropdown;

  panel.querySelector("#td-close-btn").addEventListener("click", () => {
    panel.style.display = "none";
  });

  // ── Add new category ──────────────────────────────────────────
  panel.querySelector("#td-add-cat-link").addEventListener("click", () => {
    const row = panel.querySelector("#td-add-cat-row");
    const opening = row.style.display === "none";
    row.style.display = opening ? "flex" : "none";
    if (opening) {
      // Populate parent dropdown with current top-level categories
      const select = row.querySelector("#td-parent-cat-select");
      select.innerHTML = '<option value="">— Top-level category —</option>' +
        tdCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      panel.querySelector("#td-new-cat-name").focus();
    }
  });

  panel.querySelector("#td-create-cat-btn").addEventListener("click", async () => {
    const { tomdumToken } = await chrome.storage.local.get("tomdumToken");
    if (!tomdumToken) { setStatus("Save your admin token first.", "error"); return; }

    const nameInput = panel.querySelector("#td-new-cat-name");
    const name = nameInput.value.trim();
    if (!name) { setStatus("Enter a category name.", "error"); return; }

    const parentId = panel.querySelector("#td-parent-cat-select")?.value || null;

    const btn = panel.querySelector("#td-create-cat-btn");
    btn.disabled = true;
    btn.textContent = "Creating…";

    chrome.runtime.sendMessage(
      { action: "CREATE_CATEGORY", token: tomdumToken, name, parentId },
      (res) => {
        btn.disabled = false;
        btn.textContent = "Create";
        if (!res?.success) { setStatus("Error: " + (res?.error ?? "unknown"), "error"); return; }

        const cat = res.data;
        panel._catDropdown.addItem({ id: cat.id, label: cat.name, parentId: cat.parentId ?? null });
        panel._catDropdown.setValue(cat.id, cat.name);

        nameInput.value = "";
        panel.querySelector("#td-add-cat-row").style.display = "none";
        const parentName = parentId ? tdCategories.find(c => c.id === parentId)?.name : null;
        setStatus(`${parentName ? `Subcategory of "${parentName}"` : "Category"} "${cat.name}" created ✓`, "success");
      }
    );
  });

  // ── Add new area ───────────────────────────────────────────────
  panel.querySelector("#td-add-area-link").addEventListener("click", () => {
    const row = panel.querySelector("#td-add-area-row");
    row.style.display = row.style.display === "none" ? "flex" : "none";
    if (row.style.display === "flex") panel.querySelector("#td-new-area-name").focus();
  });

  panel.querySelector("#td-create-area-btn").addEventListener("click", async () => {
    const { tomdumToken } = await chrome.storage.local.get("tomdumToken");
    if (!tomdumToken) { setStatus("Save your admin token first.", "error"); return; }

    const nameInput = panel.querySelector("#td-new-area-name");
    const name = nameInput.value.trim();
    if (!name) { setStatus("Enter an area name.", "error"); return; }

    const btn = panel.querySelector("#td-create-area-btn");
    btn.disabled = true;
    btn.textContent = "Creating…";

    // Auto-fill GPS from the current business being seeded
    const lat = tdPanelBiz?.lat ?? null;
    const lng = tdPanelBiz?.lng ?? null;

    chrome.runtime.sendMessage(
      { action: "CREATE_AREA", token: tomdumToken, name, lat, lng },
      (res) => {
        btn.disabled = false;
        btn.textContent = "Create";
        if (!res?.success) { setStatus("Error: " + (res?.error ?? "unknown"), "error"); return; }

        const area = res.data;
        tdAreas.push(area);
        panel._areaDropdown.addItem({ id: area.id, label: area.name });
        panel._areaDropdown.setValue(area.id, area.name);

        nameInput.value = "";
        panel.querySelector("#td-add-area-row").style.display = "none";
        const gpsNote = (lat && lng) ? ` (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})` : " (no GPS — add manually)";
        setStatus(`Area "${area.name}" created ✓${gpsNote}`, "success");
      }
    );
  });

  // ── Preview overlay ────────────────────────────────────────────
  panel.querySelector("#td-preview-btn").addEventListener("click", () => {
    if (!tdPanelBiz) return;
    openPreviewOverlay(tdPanelBiz);
  });

  // ── Auth section: login form or logged-in state ───────────────
  function renderAuthSection() {
    const section = panel.querySelector("#td-auth-section");
    if (tdSavedToken && tdSavedUser) {
      section.innerHTML = `
        <div class="td-logged-in">
          <span class="td-user">✓ ${tdSavedUser.name || tdSavedUser.email}</span>
          <button class="td-logout-btn" id="td-logout-btn">Log out</button>
        </div>
      `;
      section.querySelector("#td-logout-btn").addEventListener("click", async () => {
        await chrome.storage.local.remove(["tomdumToken", "tomdumUser"]);
        tdSavedToken = null;
        tdSavedUser  = null;
        renderAuthSection();
        setStatus("Logged out.", "");
      });
    } else {
      section.innerHTML = `
        <div class="td-label">Admin Login</div>
        <div class="td-login-form">
          <input type="email" id="td-login-email" placeholder="Email" autocomplete="email" />
          <input type="password" id="td-login-password" placeholder="Password" autocomplete="current-password" />
          <div class="td-login-error" id="td-login-error"></div>
          <button class="td-login-btn" id="td-login-btn">Log in</button>
        </div>
      `;

      const loginBtn = section.querySelector("#td-login-btn");
      const errEl    = section.querySelector("#td-login-error");

      const doLogin = async () => {
        const identifier = section.querySelector("#td-login-email").value.trim();
        const password   = section.querySelector("#td-login-password").value;
        if (!identifier || !password) { errEl.textContent = "Enter email and password."; return; }

        loginBtn.disabled = true;
        loginBtn.textContent = "Logging in…";
        errEl.textContent = "";

        chrome.runtime.sendMessage(
          { action: "LOGIN", identifier, password },
          async (res) => {
            loginBtn.disabled = false;
            loginBtn.textContent = "Log in";
            if (!res?.success) {
              errEl.textContent = res?.error ?? "Login failed.";
              return;
            }
            const { token, user } = res.data;
            await chrome.storage.local.set({ tomdumToken: token, tomdumUser: user });
            tdSavedToken = token;
            tdSavedUser  = user;
            renderAuthSection();
            setStatus(`Welcome, ${user.name || user.email}!`, "success");
          }
        );
      };

      loginBtn.addEventListener("click", doLogin);
      section.querySelector("#td-login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }
  }

  renderAuthSection();

  // ── Seed button: 3-step seeding flow ──────────────────────────
  panel.querySelector("#td-seed-btn").addEventListener("click", async () => {
    const { tomdumToken } = await chrome.storage.local.get("tomdumToken");
    const categoryId = panel._catDropdown.getValue();
    const areaId     = panel._areaDropdown.getValue();

    if (!tomdumToken) { setStatus("Log in first.", "error"); return; }
    if (!categoryId)  { setStatus("Select a category.", "error"); return; }
    if (!areaId)      { setStatus("Select an area.", "error"); return; }

    const seedBtn = panel.querySelector("#td-seed-btn");
    seedBtn.disabled = true;
    setStatus("Seeding business…");

    const biz = tdPanelBiz;

    // Build the business payload — strip null/undefined/empty
    const business = Object.fromEntries(
      Object.entries({
        name:        biz.name,
        address:     biz.address,
        phone:       biz.phone,
        website:     biz.website,
        description: biz.description,
        hours:       biz.hours,
        attributes:  biz.attributes,
        photos:      biz.photos?.length ? biz.photos : undefined,
        lat:         biz.lat,
        lng:         biz.lng,
        categoryId,
        areaId,
      }).filter(([, v]) => v !== null && v !== undefined && v !== "")
    );

    // ── Step 1: seed the business ──────────────────────────────
    chrome.runtime.sendMessage(
      { action: "SEED_BUSINESS", token: tomdumToken, business },
      async (seedRes) => {
        if (!seedRes?.success) {
          const msg = typeof seedRes?.error === "object"
            ? JSON.stringify(seedRes.error)
            : (seedRes?.error ?? "unknown error");
          setStatus("Error: " + msg, "error");
          seedBtn.disabled = false;
          return;
        }

        const businessId = seedRes.data.id;
        const slug       = seedRes.data.slug;
        const reviews    = biz._reviews ?? [];

        if (biz._sourceBtn) {
          biz._sourceBtn.classList.add("td-seeded");
          const lbl = biz._sourceBtn.querySelector(".td-seed-label");
          if (lbl) lbl.textContent = "Seeded ✓";
        }

        // ── Step 2: save reviews ───────────────────────────────
        if (reviews.length > 0) {
          setStatus(`Business seeded ✓ — importing ${reviews.length} reviews…`);

          chrome.runtime.sendMessage(
            { action: "SEED_REVIEWS", businessId, token: tomdumToken, source: "google", reviews },
            (reviewRes) => {
              if (!reviewRes?.success) {
                console.error("[TomDum] SEED_REVIEWS failed:", reviewRes?.error);
                setStatus(`✓ Seeded slug: ${slug} — but reviews failed: ${reviewRes?.error ?? "unknown"}`, "error");
                seedBtn.textContent = "Seeded (reviews failed)";
                return;
              }

              const saved = reviewRes?.data?.saved ?? 0;

              if (saved > 0) {
                // ── Step 3: AI insights (fire-and-forget) ─────
                setStatus(`✓ Seeded! ${saved} Google reviews imported. Generating AI insights…`);
                chrome.runtime.sendMessage(
                  { action: "GENERATE_INSIGHTS", businessId, token: tomdumToken },
                  (insightRes) => {
                    if (insightRes?.success) {
                      setStatus(`✓ Done! Slug: ${slug} · ${saved} reviews · AI insights ready`, "success");
                    } else {
                      setStatus(`✓ Seeded! Slug: ${slug} · ${saved} reviews imported`, "success");
                    }
                  }
                );
              } else {
                setStatus(`✓ Seeded! Slug: ${slug}`, "success");
              }
              seedBtn.textContent = "Seeded ✓";
            }
          );
        } else {
          setStatus(`✓ Seeded! Slug: ${slug}`, "success");
          seedBtn.textContent = "Seeded ✓";
        }
      }
    );
  });

  return panel;
}

// ─────────────────────────────────────────────
// Preview overlay — shows full scraped JSON before seeding
// ─────────────────────────────────────────────

function openPreviewOverlay(biz) {
  document.getElementById("tomdum-preview-overlay")?.remove();

  const { _reviews, _sourceBtn, attributes, ...businessFields } = biz;

  const views = {
    business: businessFields,
    reviews:  _reviews ?? [],
    about:    attributes ?? {},
  };
  let activeView = "business";

  const overlay = document.createElement("div");
  overlay.id = "tomdum-preview-overlay";

  function renderJson(key) {
    return JSON.stringify(views[key], null, 2);
  }

  function tabsHtml(active) {
    return Object.keys(views).map((k) => {
      const count = Array.isArray(views[k])
        ? ` (${views[k].length})`
        : k === "about" ? ` (${Object.keys(views[k]).length} sections)` : "";
      return `<div class="td-ptab${k === active ? " active" : ""}" data-view="${k}">${k}${count}</div>`;
    }).join("");
  }

  overlay.innerHTML = `
    <div class="td-preview-box">
      <div class="td-preview-header">
        <div class="td-preview-tabs" id="td-ptabs">${tabsHtml(activeView)}</div>
        <button class="td-preview-close" id="td-pclose">✕</button>
      </div>
      <pre id="td-preview-pre">${renderJson(activeView)}</pre>
      <button class="td-copy-btn" id="td-pcopy">Copy JSON</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#td-pclose").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#td-ptabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".td-ptab");
    if (!tab) return;
    activeView = tab.dataset.view;
    overlay.querySelector("#td-preview-pre").textContent = renderJson(activeView);
    overlay.querySelector("#td-ptabs").innerHTML = tabsHtml(activeView);
  });

  overlay.querySelector("#td-pcopy").addEventListener("click", () => {
    navigator.clipboard.writeText(renderJson(activeView)).then(() => {
      const btn = overlay.querySelector("#td-pcopy");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy JSON"; }, 1500);
    });
  });
}

// ─────────────────────────────────────────────
// Open panel — populate fields for the selected business
// ─────────────────────────────────────────────

function openPanel(biz) {
  const panel = getOrCreatePanel();
  tdPanelBiz = biz;

  panel.querySelector("#td-biz-name").textContent = biz.name ?? "Unknown";

  const reviewCount    = biz._reviews?.length ?? 0;
  const attrSections   = biz.attributes ? Object.keys(biz.attributes).length : 0;
  const attrItemCount  = biz.attributes
    ? Object.values(biz.attributes).reduce((s, arr) => s + arr.length, 0)
    : 0;

  panel.querySelector("#td-meta").innerHTML = [
    biz.address        ? `<div>📍 ${biz.address}</div>` : "",
    biz.phone          ? `<div>📞 ${biz.phone}</div>` : "",
    biz.googleCategory ? `<div>🏷 ${biz.googleCategory}</div>` : "",
    biz.website        ? `<div>🌐 ${biz.website}</div>` : "",
    biz.hours
      ? `<div>🕐 Hours captured ✓</div>`
      : `<div class="td-dim">🕐 No hours — open the business card first</div>`,
    biz.description
      ? `<div>📝 About captured ✓</div>`
      : "",
    attrSections > 0
      ? `<div>✅ ${attrSections} attribute sections (${attrItemCount} items)</div>`
      : `<div class="td-dim">ℹ️ No about attributes found</div>`,
    (biz.photos?.length ?? 0) > 0
      ? `<div>📷 ${biz.photos.length} photos captured</div>`
      : `<div class="td-dim">📷 No photos found</div>`,
    reviewCount > 0
      ? `<div>⭐ ${reviewCount} Google reviews ready to import</div>`
      : `<div class="td-dim">⭐ No reviews scraped</div>`,
  ].join("");

  panel._catDropdown.reset();
  panel._areaDropdown.reset();
  const statusEl = panel.querySelector("#td-status");
  statusEl.textContent = "";
  statusEl.className = "td-status";
  const seedBtn = panel.querySelector("#td-seed-btn");
  seedBtn.textContent = "Seed to TomDum";
  seedBtn.disabled = false;

  panel.style.display = "";
}
