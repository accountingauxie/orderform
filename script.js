/* CONFIG */
const baseURL =
  "https://script.google.com/macros/s/AKfycbxzY3p101ahIm5f7mjhJpbdRsPp61c_HFDel--A3O5bVUZguip0A-QAuh19EH5FpMQVfg/exec";

let listSpandek = [];
let listNonSpandek = [];
let priceSpan = [];
let priceNon = [];
let customerList = [];
let choiceCustomer;

/* ================= FORMAT RP ================= */

function formatMoney(num) {
  const n = Number(num) || 0;
  return (
    "Rp " +
    n.toFixed(2)
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
  const res = await fetch(baseURL + "?action=getdata");
  const data = await res.json();

  customerList = data.customers || [];
  listSpandek = data.spandek || [];
  listNonSpandek = data.nonspandek || [];
  priceSpan = data.priceSpan || [];
  priceNon = data.priceNon || [];

  // load customer dropdown
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

    <td><select class="item-select"></select></td>

    <td><input type="number" class="meter-input" step="0.001"></td>
    <td><input type="number" class="qty-input" step="1"></td>

    <td><input type="text" class="unit-price-input" readonly></td>
    <td><input type="text" class="discount-input" value="0"></td>

    <td><input type="text" class="priceqty-input" readonly></td>

    <td><input type="text" class="line-total-input" readonly></td>

    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  const typeSel = tr.querySelector(".type-select");
  const itemSel = tr.querySelector(".item-select");
  const meterInput = tr.querySelector(".meter-input");
  const discInput = tr.querySelector(".discount-input");

  meterInput.disabled = true;

  /* ============ INIT CHOICES ============ */

  const choiceItem = new Choices(itemSel, {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false
  });

  /* Load item sesuai tipe */
  function loadItems() {
    let list = [];
    if (typeSel.value === "Spandek") list = listSpandek;
    if (typeSel.value === "Non Spandek") list = listNonSpandek;

    choiceItem.clearChoices();

    choiceItem.setChoices(
      list.map((name, i) => ({ value: i, label: name })), 
      "value",
      "label",
      true
    );
  }

  /* ================= TYPE CHANGE ================= */

  typeSel.addEventListener("change", () => {
    loadItems();

    if (typeSel.value === "Spandek") {
      meterInput.disabled = false;
      meterInput.style.background = "white";
    } else {
      meterInput.disabled = true;
      meterInput.value = "1";
      meterInput.style.background = "#e8e8e8";
    }

    tr.querySelector(".unit-price-input").value = "";
    tr.querySelector(".priceqty-input").value = "";
    tr.querySelector(".line-total-input").value = "";
  });

  /* ================= ITEM CHANGE ================= */

  itemSel.addEventListener("change", () => {
    const idx = parseInt(itemSel.value);
    let price = 0;

    if (typeSel.value === "Spandek") price = priceSpan[idx] || 0;
    if (typeSel.value === "Non Spandek") price = priceNon[idx] || 0;

    tr.querySelector(".unit-price-input").value = formatMoney(price);
    recalcRow(tr);
    recalcTotals();
  });

  /* ================= DISCOUNT FORMAT ================= */

  discInput.addEventListener("input", () => {
    const unit = parseMoney(tr.querySelector(".unit-price-input").value);
    let d = parseMoney(discInput.value);

    if (d > unit) d = unit;

    discInput.value = formatMoney(d);

    recalcRow(tr);
    recalcTotals();
  });

  /* ================= INPUT CHANGE ================= */

  tr.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });
}

/* ================= DELETE ================= */

function deleteRow(el) {
  el.closest("tr").remove();
  recalcTotals();
}

/* ================= PER-BARIS ================= */

function recalcRow(row) {
  const type = row.querySelector(".type-select").value;

  let meter = parseFloat(row.querySelector(".meter-input").value);
  if (isNaN(meter) || meter <= 0) meter = 1;

  if (type === "Non Spandek") meter = 1;

  const qty = parseFloat(row.querySelector(".qty-input").value) || 0;
  const unit = parseMoney(row.querySelector(".unit-price-input").value);
  const disc = parseMoney(row.querySelector(".discount-input").value);

  const netUnit = Math.max(unit - disc, 0);
  const priceQty = netUnit * meter;
  const total = priceQty * qty;

  row.querySelector(".priceqty-input").value = formatMoney(priceQty);
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

  document.getElementById("dppDisplay").textContent = formatMoney(dpp);
  document.getElementById("ppnDisplay").textContent = formatMoney(ppn);
  document.getElementById("grandTotalDisplay").textContent = formatMoney(grand);
}
