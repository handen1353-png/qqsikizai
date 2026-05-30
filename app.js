const STORAGE_KEY = "emergencyInventoryApp.v1";

const sampleItems = (globalThis.EMERGENCY_SAMPLE_ITEMS || []).map((item) => ({
  ...item,
  id: crypto.randomUUID(),
  requested: false
}));

function mergeSampleItems(items) {
  const merged = [...items];
  const existingNames = new Set(items.map((item) => item.name));
  sampleItems.forEach((item) => {
    if (!existingNames.has(item.name)) merged.push({ ...item });
  });
  return merged;
}

let state = { items: [], history: [], sampleSeedVersion: 2 };
let serverMode = false;
let revision = 0;

const el = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  summaryGrid: document.getElementById("summaryGrid"),
  expiryPanel: document.getElementById("expiryPanel"),
  searchName: document.getElementById("searchName"),
  filterLocation: document.getElementById("filterLocation"),
  filterStatus: document.getElementById("filterStatus"),
  itemsTable: document.getElementById("itemsTable"),
  itemForm: document.getElementById("itemForm"),
  itemId: document.getElementById("itemId"),
  itemName: document.getElementById("itemName"),
  itemLocation: document.getElementById("itemLocation"),
  itemStock: document.getElementById("itemStock"),
  itemExpiry: document.getElementById("itemExpiry"),
  itemMinimum: document.getElementById("itemMinimum"),
  itemUnit: document.getElementById("itemUnit"),
  itemMemo: document.getElementById("itemMemo"),
  clearItemForm: document.getElementById("clearItemForm"),
  movementForm: document.getElementById("movementForm"),
  movementItem: document.getElementById("movementItem"),
  movementType: document.getElementById("movementType"),
  movementQty: document.getElementById("movementQty"),
  movementDate: document.getElementById("movementDate"),
  movementExpiry: document.getElementById("movementExpiry"),
  movementReason: document.getElementById("movementReason"),
  movementStaff: document.getElementById("movementStaff"),
  historyTable: document.getElementById("historyTable"),
  exportItemsBtn: document.getElementById("exportItemsBtn"),
  exportRequestsBtn: document.getElementById("exportRequestsBtn"),
  exportHistoryBtn: document.getElementById("exportHistoryBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),
  importFile: document.getElementById("importFile"),
  clearDataBtn: document.getElementById("clearDataBtn"),
  toast: document.getElementById("toast")
};

async function loadState() {
  if (location.protocol !== "file:") {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.ok) {
        serverMode = true;
        const parsed = await response.json();
        revision = Number(parsed.revision) || 0;
        return {
          items: Array.isArray(parsed.items) ? parsed.items : [],
          history: Array.isArray(parsed.history) ? parsed.history : [],
          sampleSeedVersion: 2
        };
      }
    } catch {
      serverMode = false;
    }
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { items: sampleItems, history: [], sampleSeedVersion: 2 };
  }

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      items: parsed.sampleSeedVersion === 2 ? items : mergeSampleItems(items),
      history: Array.isArray(parsed.history) ? parsed.history : [],
      sampleSeedVersion: 2
    };
  } catch {
    return { items: sampleItems, history: [], sampleSeedVersion: 2 };
  }
}

async function saveState() {
  if (serverMode) {
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, revision })
      });
      if (response.ok) {
        const result = await response.json();
        revision = Number(result.revision) || revision;
        return true;
      }
      if (response.status === 409) {
        const latest = await response.json();
        state = {
          items: Array.isArray(latest.items) ? latest.items : [],
          history: Array.isArray(latest.history) ? latest.history : [],
          sampleSeedVersion: 2
        };
        revision = Number(latest.revision) || 0;
        renderAll();
        showToast("別の端末で更新がありました。最新状態を表示しました");
        return false;
      }
    } catch {
      serverMode = false;
      showToast("サーバー保存に失敗したため、この端末に保存しました");
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return true;
}

async function refreshStateFromServer() {
  if (!serverMode) return;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const latest = await response.json();
    const latestRevision = Number(latest.revision) || 0;
    if (latestRevision <= revision) return;
    state = {
      items: Array.isArray(latest.items) ? latest.items : [],
      history: Array.isArray(latest.history) ? latest.history : [],
      sampleSeedVersion: 2
    };
    revision = latestRevision;
    renderAll();
    showToast("最新の在庫情報を同期しました");
  } catch {
    // Keep the current screen usable during a temporary network interruption.
  }
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.setTimeout(() => el.toast.classList.remove("show"), 2200);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeInventory() {
  state.items.forEach((item) => {
    if (!Array.isArray(item.lots)) {
      item.lots = Number(item.stock) > 0 ? [{ quantity: Number(item.stock), expiry: "" }] : [];
    }
    item.lots = item.lots
      .map((lot) => ({ quantity: Number(lot.quantity) || 0, expiry: lot.expiry || "" }))
      .filter((lot) => lot.quantity > 0);
    item.stock = item.lots.reduce((total, lot) => total + lot.quantity, 0);
  });
}

function addLot(item, quantity, expiry = "") {
  const existing = item.lots.find((lot) => lot.expiry === expiry);
  if (existing) existing.quantity += quantity;
  else item.lots.push({ quantity, expiry });
  item.stock = item.lots.reduce((total, lot) => total + lot.quantity, 0);
}

function consumeLots(item, quantity, selectedExpiry = "") {
  let remaining = quantity;
  const consumed = [];
  const targetLots = selectedExpiry
    ? item.lots.filter((lot) => lot.expiry === selectedExpiry)
    : item.lots.sort((a, b) => (a.expiry || "9999-99").localeCompare(b.expiry || "9999-99"));
  const available = targetLots.reduce((total, lot) => total + lot.quantity, 0);
  if (available < quantity) return "";
  targetLots
    .forEach((lot) => {
      const used = Math.min(lot.quantity, remaining);
      lot.quantity -= used;
      remaining -= used;
      if (used > 0) consumed.push(`${formatExpiry(lot.expiry)}: ${used}`);
    });
  item.lots = item.lots.filter((lot) => lot.quantity > 0);
  item.stock = item.lots.reduce((total, lot) => total + lot.quantity, 0);
  return consumed.join(" / ");
}

function formatExpiry(expiry) {
  return expiry ? expiry.replace("-", "/") : "期限未登録";
}

function formatHistoryExpiry(expiry) {
  return expiry?.includes(":") ? expiry : formatExpiry(expiry);
}

function formatLots(item) {
  if (!item.lots.length) return "-";
  return item.lots
    .slice()
    .sort((a, b) => (a.expiry || "9999-99").localeCompare(b.expiry || "9999-99"))
    .map((lot) => `${formatExpiry(lot.expiry)}: ${lot.quantity}${item.unit}`)
    .join(" / ");
}

function getExpiryAlerts() {
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  return state.items.flatMap((item) =>
    item.lots
      .filter((lot) => {
        if (!lot.expiry) return false;
        const [year, month] = lot.expiry.split("-").map(Number);
        return new Date(year, month, 0) <= limit;
      })
      .map((lot) => ({ item, lot }))
  );
}

function switchView(viewName) {
  el.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  el.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function uniqueValues(key) {
  return [...new Set(state.items.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function fillSelect(select, values, keepValue = "") {
  const first = select.querySelector("option")?.outerHTML ?? "";
  select.innerHTML = first + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = values.includes(keepValue) ? keepValue : "";
}

function renderFilters() {
  fillSelect(el.filterLocation, uniqueValues("location"), el.filterLocation.value);
}

function renderSummary() {
  const shortage = state.items.filter((item) => Number(item.stock) <= Number(item.minimum)).length;
  const locations = uniqueValues("location").length;
  const historyCount = state.history.length;
  const cards = [
    ["登録物品", state.items.length],
    ["不足", shortage],
    ["保管場所", locations],
    ["履歴", historyCount]
  ];

  el.summaryGrid.innerHTML = cards
    .map(([label, value]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderExpiryAlerts() {
  const alerts = getExpiryAlerts();
  el.expiryPanel.classList.toggle("show", alerts.length > 0);
  el.expiryPanel.innerHTML = alerts.length
    ? `<strong>使用期限のお知らせ（3か月以内）</strong><ul>${alerts
        .map(({ item, lot }) => `<li>${escapeHtml(item.name)} ${lot.quantity}${escapeHtml(item.unit)} ${escapeHtml(formatExpiry(lot.expiry))}</li>`)
        .join("")}</ul>`
    : "";
}

function getFilteredItems() {
  const q = el.searchName.value.trim().toLowerCase();
  const location = el.filterLocation.value;
  const status = el.filterStatus.value;
  return state.items.filter((item) => {
    const isLow = Number(item.stock) <= Number(item.minimum);
    return (
      (!q || item.name.toLowerCase().includes(q)) &&
      (!location || item.location === location) &&
      (!status || (status === "不足" ? isLow : !isLow))
    );
  });
}

function renderItems() {
  const items = getFilteredItems();
  if (!items.length) {
    el.itemsTable.innerHTML = `<tr><td class="empty" colspan="10">表示できる物品がありません</td></tr>`;
    return;
  }

  el.itemsTable.innerHTML = items
    .map((item) => {
      const low = Number(item.stock) <= Number(item.minimum);
      return `
        <tr>
          <td><span class="badge ${low ? "low" : "ok"}">${low ? "不足" : "適正"}</span></td>
          <td><input class="request-check" type="checkbox" data-action="request" data-id="${item.id}" aria-label="${escapeHtml(item.name)}を要望書に追加" ${item.requested ? "checked" : ""}></td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.location)}</td>
          <td class="numeric">${Number(item.stock).toLocaleString()}</td>
          <td class="numeric">${Number(item.minimum).toLocaleString()}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(formatLots(item))}</td>
          <td>${escapeHtml(item.memo || "")}</td>
          <td>
            <div class="row-actions">
              <button class="small-button" type="button" data-action="move" data-id="${item.id}">受払</button>
              <button class="small-button" type="button" data-action="edit" data-id="${item.id}">編集</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderMovementItems(selectedId = "") {
  if (!state.items.length) {
    el.movementItem.innerHTML = `<option value="">物品を登録してください</option>`;
    return;
  }

  el.movementItem.innerHTML = state.items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}（現在庫 ${item.stock}${escapeHtml(item.unit)}）</option>`)
    .join("");

  if (selectedId) el.movementItem.value = selectedId;
}

function renderHistory() {
  const rows = state.history.slice().sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  if (!rows.length) {
    el.historyTable.innerHTML = `<tr><td class="empty" colspan="7">履歴はまだありません</td></tr>`;
    return;
  }

  el.historyTable.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td><span class="badge ${row.type === "払出" ? "low" : "ok"}">${escapeHtml(row.type)}</span></td>
          <td>${escapeHtml(row.itemName)}</td>
          <td class="numeric">${Number(row.quantity).toLocaleString()}</td>
          <td>${escapeHtml(formatHistoryExpiry(row.expiry))}</td>
          <td>${escapeHtml(row.reason)}</td>
          <td>${escapeHtml(row.staff)}</td>
        </tr>
      `
    )
    .join("");
}

function renderAll() {
  normalizeInventory();
  renderFilters();
  renderSummary();
  renderExpiryAlerts();
  renderItems();
  renderMovementItems(el.movementItem.value);
  renderHistory();
}

function resetItemForm() {
  el.itemForm.reset();
  el.itemId.value = "";
  el.itemStock.value = 0;
  el.itemExpiry.value = "";
  el.itemMinimum.value = 0;
  el.itemForm.querySelector(".primary-button").textContent = "登録する";
}

function editItem(id) {
  const item = state.items.find((target) => target.id === id);
  if (!item) return;
  el.itemId.value = item.id;
  el.itemName.value = item.name;
  el.itemLocation.value = item.location;
  el.itemStock.value = item.stock;
  el.itemExpiry.value = "";
  el.itemMinimum.value = item.minimum;
  el.itemUnit.value = item.unit;
  el.itemMemo.value = item.memo || "";
  el.itemForm.querySelector(".primary-button").textContent = "更新する";
  switchView("master");
}

function selectMovementItem(id) {
  renderMovementItems(id);
  switchView("movement");
}

async function upsertItem(event) {
  event.preventDefault();
  const existingItem = state.items.find((target) => target.id === el.itemId.value);
  const item = {
    id: el.itemId.value || crypto.randomUUID(),
    name: el.itemName.value.trim(),
    location: el.itemLocation.value.trim(),
    stock: Number(el.itemStock.value),
    minimum: Number(el.itemMinimum.value),
    unit: el.itemUnit.value.trim(),
    memo: el.itemMemo.value.trim(),
    requested: existingItem?.requested || false,
    lots:
      existingItem && Number(existingItem.stock) === Number(el.itemStock.value)
        ? existingItem.lots
        : Number(el.itemStock.value) > 0
          ? [{ quantity: Number(el.itemStock.value), expiry: el.itemExpiry.value }]
          : []
  };

  if (!item.name || !item.location || !item.unit) {
    showToast("必須項目を入力してください");
    return;
  }

  const index = state.items.findIndex((target) => target.id === item.id);
  if (index >= 0) {
    state.items[index] = item;
    showToast("物品を更新しました");
  } else {
    state.items.push(item);
    showToast("物品を登録しました");
  }

  if (!(await saveState())) return;
  resetItemForm();
  renderAll();
  switchView("list");
}

async function submitMovement(event) {
  event.preventDefault();
  const item = state.items.find((target) => target.id === el.movementItem.value);
  if (!item) {
    showToast("物品を選択してください");
    return;
  }

  const qty = Number(el.movementQty.value);
  const receiving = el.movementType.value === "受入";
  const nextStock = Number(item.stock) + (receiving ? qty : -qty);
  if (nextStock < 0) {
    showToast("在庫数がマイナスになります");
    return;
  }

  let handledExpiry = el.movementExpiry.value;
  if (receiving) addLot(item, qty, handledExpiry);
  else {
    handledExpiry = consumeLots(item, qty, el.movementExpiry.value);
    if (!handledExpiry) {
      showToast("指定した使用期限の在庫が不足しています");
      return;
    }
  }
  state.history.push({
    id: crypto.randomUUID(),
    itemId: item.id,
    itemName: item.name,
    type: el.movementType.value,
    quantity: qty,
    expiry: handledExpiry,
    date: el.movementDate.value,
    reason: el.movementReason.value.trim(),
    staff: el.movementStaff.value.trim(),
    createdAt: new Date().toISOString()
  });

  if (!(await saveState())) return;
  el.movementForm.reset();
  el.movementDate.value = today();
  renderAll();
  showToast("在庫を更新しました");
  switchView("history");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportItems() {
  downloadCsv(
    `救急物品_物品マスタ_${today()}.csv`,
    ["物品名", "保管場所", "現在庫数", "最低在庫数", "単位", "メモ", "要望", "期限別在庫"],
    state.items.map((item) => [item.name, item.location, item.stock, item.minimum, item.unit, item.memo, item.requested ? "はい" : "", JSON.stringify(item.lots)])
  );
}

function exportHistory() {
  downloadCsv(
    `救急物品_受払履歴_${today()}.csv`,
    ["処理日", "区分", "物品名", "数量", "使用期限", "理由", "担当者"],
    state.history.map((row) => [row.date, row.type, row.itemName, row.quantity, row.expiry, row.reason, row.staff])
  );
}

function exportRequests() {
  const requests = state.items.filter((item) => item.requested);
  if (!requests.length) {
    showToast("要望にチェックされた物品がありません");
    return;
  }

  downloadCsv(
    `救急物品_物品要望書_${today()}.csv`,
    ["物品名", "保管場所", "現在庫数", "最低在庫数", "単位", "メモ"],
    requests.map((item) => [item.name, item.location, item.stock, item.minimum, item.unit, item.memo])
  );
}

function exportAll() {
  const rows = [
    ["種別", "物品ID", "物品名", "保管場所", "現在庫数", "最低在庫数", "単位", "メモ", "要望", "期限別在庫", "処理日", "区分", "数量", "使用期限", "理由", "担当者"],
    ...state.items.map((item) => ["物品", item.id, item.name, item.location, item.stock, item.minimum, item.unit, item.memo, item.requested ? "はい" : "", JSON.stringify(item.lots), "", "", "", "", "", ""]),
    ...state.history.map((row) => ["履歴", row.itemId, row.itemName, "", "", "", "", "", "", "", row.date, row.type, row.quantity, row.expiry, row.reason, row.staff])
  ];
  const [headers, ...data] = rows;
  downloadCsv(`救急物品_全データ_${today()}.csv`, headers, data);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

async function importCsv(file) {
  const text = await file.text();
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = rows.shift() || [];
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));

  if (headers.includes("種別")) {
    importAllRows(rows, headerIndex);
  } else if (headers.includes("物品名") && headers.includes("現在庫数")) {
    importItemRows(rows, headerIndex);
  } else {
    showToast("対応していないCSV形式です");
    return;
  }

  if (!(await saveState())) return;
  renderAll();
  showToast("CSVを取り込みました");
}

function value(row, headerIndex, key) {
  return row[headerIndex[key]] ?? "";
}

function parseLots(row, headerIndex, stock) {
  try {
    const lots = JSON.parse(value(row, headerIndex, "期限別在庫"));
    if (Array.isArray(lots)) return lots;
  } catch {
    // Older CSV files do not include lot details.
  }
  return stock > 0 ? [{ quantity: stock, expiry: "" }] : [];
}

function importItemRows(rows, headerIndex) {
  state.items = rows.map((row) => {
    const stock = Number(value(row, headerIndex, "現在庫数")) || 0;
    return {
      id: crypto.randomUUID(),
      name: value(row, headerIndex, "物品名"),
      location: value(row, headerIndex, "保管場所"),
      stock,
      minimum: Number(value(row, headerIndex, "最低在庫数")) || 0,
      unit: value(row, headerIndex, "単位"),
      memo: value(row, headerIndex, "メモ"),
      requested: value(row, headerIndex, "要望") === "はい",
      lots: parseLots(row, headerIndex, stock)
    };
  });
  state.history = [];
}

function importAllRows(rows, headerIndex) {
  const itemIdMap = new Map();
  const items = [];
  const history = [];

  rows.forEach((row) => {
    const type = value(row, headerIndex, "種別");
    if (type === "物品") {
      const id = value(row, headerIndex, "物品ID") || crypto.randomUUID();
      itemIdMap.set(id, id);
      const stock = Number(value(row, headerIndex, "現在庫数")) || 0;
      items.push({
        id,
        name: value(row, headerIndex, "物品名"),
        location: value(row, headerIndex, "保管場所"),
        stock,
        minimum: Number(value(row, headerIndex, "最低在庫数")) || 0,
        unit: value(row, headerIndex, "単位"),
        memo: value(row, headerIndex, "メモ"),
        requested: value(row, headerIndex, "要望") === "はい",
        lots: parseLots(row, headerIndex, stock)
      });
    }
  });

  rows.forEach((row) => {
    const type = value(row, headerIndex, "種別");
    if (type === "履歴") {
      const oldId = value(row, headerIndex, "物品ID");
      history.push({
        id: crypto.randomUUID(),
        itemId: itemIdMap.get(oldId) || oldId,
        itemName: value(row, headerIndex, "物品名"),
        type: value(row, headerIndex, "区分"),
        quantity: Number(value(row, headerIndex, "数量")) || 0,
        expiry: value(row, headerIndex, "使用期限"),
        date: value(row, headerIndex, "処理日"),
        reason: value(row, headerIndex, "理由"),
        staff: value(row, headerIndex, "担当者"),
        createdAt: new Date().toISOString()
      });
    }
  });

  state.items = items;
  state.history = history;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

el.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
["input", "change"].forEach((eventName) => {
  el.searchName.addEventListener(eventName, renderItems);
  el.filterLocation.addEventListener(eventName, renderItems);
  el.filterStatus.addEventListener(eventName, renderItems);
});

el.itemsTable.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (button) {
    if (button.dataset.action === "edit") editItem(button.dataset.id);
    if (button.dataset.action === "move") selectMovementItem(button.dataset.id);
  }
  const checkbox = event.target.closest('input[data-action="request"]');
  if (checkbox) {
    const item = state.items.find((target) => target.id === checkbox.dataset.id);
    if (!item) return;
    item.requested = checkbox.checked;
    if (!(await saveState())) renderAll();
  }
});

el.itemForm.addEventListener("submit", upsertItem);
el.clearItemForm.addEventListener("click", resetItemForm);
el.movementForm.addEventListener("submit", submitMovement);
el.exportItemsBtn.addEventListener("click", exportItems);
el.exportRequestsBtn.addEventListener("click", exportRequests);
el.exportHistoryBtn.addEventListener("click", exportHistory);
el.exportAllBtn.addEventListener("click", exportAll);
el.importFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) importCsv(file);
  event.target.value = "";
});
el.clearDataBtn.addEventListener("click", async () => {
  if (!confirm("登録データと履歴をすべて削除します。よろしいですか？")) return;
  state = { items: [], history: [], sampleSeedVersion: 2 };
  if (!(await saveState())) return;
  renderAll();
  showToast("全データを削除しました");
});

async function init() {
  state = await loadState();
  el.movementDate.value = today();
  renderAll();
  if (serverMode) {
    window.setInterval(refreshStateFromServer, 3000);
    window.addEventListener("focus", refreshStateFromServer);
  }
}

init();
