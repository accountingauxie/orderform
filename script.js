/* CONFIG */
const baseURL =
  "https://script.google.com/macros/s/AKfycbxzY3p101ahIm5f7mjhJpbdRsPp61c_HFDel--A3O5bVUZguip0A-QAuh19EH5FpMQVfg/exec";

let listSpandek = [];
let listNonSpandek = [];
let spandekPrice = {};
let nonSpandekPrice = {};

let customerList = [];
let choiceCustomer;

/* ================= FORMAT RP ================= */

function formatMoney(num) {
  const n = Number(num) || 0;
  return (
    "Rp " +
    n
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

function parseMoney(str) {
  if (!str) return 0;
  return parseFloat(
    str.replace(/Rp\s*/gi, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

/* ================= ON LOAD ================= */

window.onload = function () {
  choiceCustomer = new Choices("#customerSelect", {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false
  });

  document.getElementById("issueDate").value =
    new Date().toISOString().split("T")[0];

  loadDropdowns();
  setOrderNumber();

  for (let i = 0; i < 3; i++) addRow();

  new Sortable(document.getElementById("itemsBody"), {
    handle: ".drag-handle",
    animation: 150
  });
};

/* ================= ORDER NUMBER ================= */

function setOrderNumber() {
  const key = "ORDERFORM_LAST_ORDER";
  let last = localStorage.getItem(key);
  if (!last) last = "1000000";

  const next = parseInt(last, 10) + 1;
  localStorage.setItem(key, String(next));

  document.getElementById("orderNumber").value = next;
}

/* ================= LOAD DATA ================= */

async function loadDropdowns() {
  try {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    customerList = data.customers || [];
    listSpandek = data.spandek || [];
    listNonSpandek = data.nonspandek || [];
    spandekPrice = data.priceSpan || {};
    nonSpandekPrice = data.priceNon || {};

    choiceCustomer.clearChoices();
    choiceCustomer.setChoices(
      [
        { value: "add_new", label: "➕ Add New Customer" },
        ...customerList.map((c) => ({ value: c, label: c }))
      ],
      "value",
      "label",
      true
    );

  } catch (err) {
    console.error("loadDropdowns error:", err);
  }
}

/* ================= ADD ROW ================= */

function addRow() {
  const body = document.getElementById("itemsBody");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td class="drag-handle">⋮⋮</td>

    <td>
      <select class="type-select">
        <option value="">-- Pilih --</option>
        <option value="Spandek">Spandek</option>
        <option value="Non Spandek">Non Spandek</option>
      </select>
    </td>

    <td>
      <select class="item-select"></select>
    </td>

    <td><input type="text" class="meter-input"></td>
    <td><input type="number" class="qty-input" step="1"></td>

    <td><input type="text" class="unit-price-input" readonly></td>
    <td><input type="text" class="discount-input" value="Rp 0,00"></td>

    <td><input type="text" class="priceqty-input" readonly></td>
    <td><input type="text" class="line-total-input" readonly></td>

    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  const typeSel   = tr.querySelector(".type-select");
  const itemSel   = tr.querySelector(".item-select");
  const meterInput = tr.querySelector(".meter-input");
  const discInput = tr.querySelector(".discount-input");

  meterInput.disabled = true;
  meterInput.style.background = "#eee";

  const choiceItem = new Choices(itemSel, {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false
  });

  function loadItemsForType() {
    let list = [];
    if (typeSel.value === "Spandek") list = listSpandek;
    if (typeSel.value === "Non Spandek") list = listNonSpandek;

    choiceItem.clearChoices();
    choiceItem.setChoices(
      list.map(i => ({ value: i, label: i })),
      "value",
      "label",
      true
    );
  }

  /* ===== TYPE CHANGE ===== */
  typeSel.addEventListener("change", () => {
    if (typeSel.value === "Spandek") {
      meterInput.disabled = false;
      meterInput.style.background = "white";
    } else {
      meterInput.value = "";
      meterInput.disabled = true;
      meterInput.style.background = "#eee";
    }

    loadItemsForType();

    tr.querySelector(".unit-price-input").value = "";
    tr.querySelector(".priceqty-input").value   = "";
    tr.querySelector(".line-total-input").value = "";
  });

  /* ===== ITEM SELECTED ===== */
  itemSel.addEventListener("change", () => {
    const item = itemSel.value;
    let price = 0;

    if (typeSel.value === "Spandek") {
      if (Array.isArray(spandekPrice)) {
        const idx = listSpandek.indexOf(item);
        if (idx >= 0) price = Number(spandekPrice[idx]) || 0;
      } else {
        price = Number(spandekPrice[item]) || 0;
      }
    }

    if (typeSel.value === "Non Spandek") {
      if (Array.isArray(nonSpandekPrice)) {
        const idx = listNonSpandek.indexOf(item);
        if (idx >= 0) price = Number(nonSpandekPrice[idx]) || 0;
      } else {
        price = Number(nonSpandekPrice[item]) || 0;
      }
    }

    tr.querySelector(".unit-price-input").value = formatMoney(price);

    recalcRow(tr);
    recalcTotals();
  });

  /* ===== DISKON (FORMAT RP & MAX UNIT PRICE) ===== */
  discInput.addEventListener("input", () => {
    let raw = discInput.value.replace(/[^0-9]/g, "");
    if (raw === "") raw = "0";

    let num = parseInt(raw, 10) || 0;
    const unit = parseMoney(tr.querySelector(".unit-price-input").value);

    if (num > unit) num = unit;

    discInput.value = formatMoney(num);

    recalcRow(tr);
    recalcTotals();
  });

  /* ===== INPUT LISTENER LAIN (meter & qty) ===== */
  tr.querySelectorAll("input").forEach(inp => {
    if (inp === discInput) return;

    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });
}

/* ================= DELETE ROW ================= */

function deleteRow(el) {
  el.closest("tr").remove();
  recalcTotals();
}

/* ================= PER BARIS (CORE) ================= */

function recalcRow(row) {
  const type       = row.querySelector(".type-select").value;
  const meterInput = row.querySelector(".meter-input");

  let meter = 0;

  /* NON SPANDEK = meter 1 */
  if (type === "Non Spandek") {
    meter = 1;
  }

  /* SPANDEK = baca input */
  else if (type === "Spandek") {
    let raw = meterInput.value.trim();

    raw = raw.replace(",", ".");

    if (raw === "" || raw === "." || raw.endsWith(".")) return;

    meter = parseFloat(raw);
    if (isNaN(meter) || meter < 0) meter = 0;
  }

  const qty  = parseFloat(row.querySelector(".qty-input").value) || 0;
  const unit = parseMoney(row.querySelector(".unit-price-input").value);

  let disc = parseMoney(row.querySelector(".discount-input").value);
  if (disc > unit) disc = unit;
  if (isNaN(disc) || disc < 0) disc = 0;

  row.querySelector(".discount-input").value = formatMoney(disc);

  const netUnit  = Math.max(unit - disc, 0);
  const priceQty = netUnit * meter;
  const total    = priceQty * qty;

  row.querySelector(".priceqty-input").value   = formatMoney(priceQty);
  row.querySelector(".line-total-input").value = formatMoney(total);
}

/* ================= TOTAL ================= */

function recalcTotals() {
  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach(el => {
    grand += parseMoney(el.value);
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent       = formatMoney(dpp);
  document.getElementById("ppnDisplay").textContent       = formatMoney(ppn);
  document.getElementById("grandTotalDisplay").textContent = formatMoney(grand);
}

/* ================= PREVENT NEGATIVE ================= */

document.addEventListener("input", function (e) {
  if (e.target.classList.contains("qty-input")) {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) e.target.value = 0;
  }
});
