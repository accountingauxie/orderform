/* ============================================================
   CONFIG
============================================================ */
const baseURL =
  "https://script.google.com/macros/s/AKfycbwExwntX5JjyQqMXij6aBoBQRc7FmcZI6qNa3EiBuOB7ljFDv_WTCmwoCSZYsdcoU2Z/exec";

let listSpandek = [];
let listNonSpandek = [];
let customerList = [];

let choiceCustomer;


/* ============================================================
   ON LOAD
============================================================ */
window.onload = function () {
  // Init Choices untuk customer (tanpa option awal)
  choiceCustomer = new Choices("#customerSelect", {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
  });

  document.getElementById("issueDate").value =
    new Date().toISOString().split("T")[0];

  setOrderNumber();
  loadDropdowns(); // ROW akan dibuat setelah data dropdown siap

  document.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });

  document.getElementById("saveCustomerBtn").onclick = saveCustomer;
};


/* ============================================================
   ORDER NUMBER
============================================================ */
const ORDER_KEY = "ORDERFORM_LAST_ORDER";

function generateOrderNumber() {
  let last = localStorage.getItem(ORDER_KEY);
  if (!last) last = "1000000";

  const next = parseInt(last, 10) + 1;
  localStorage.setItem(ORDER_KEY, next);
  return next;
}

function setOrderNumber() {
  const el = document.getElementById("orderNumber");
  el.value = generateOrderNumber();
  el.readOnly = true;
  el.style.background = "#f5f7fa";
  el.style.cursor = "not-allowed";
}


/* ============================================================
   LOAD DROPDOWNS (GAS)
============================================================ */
async function loadDropdowns() {
  const res = await fetch(baseURL + "?action=getdata");
  const data = await res.json();

  listSpandek = data.spandek || [];
  listNonSpandek = data.nonspandek || [];
  customerList = data.customers || [];

  /* CONTACT DROPDOWN */
  choiceCustomer.clearChoices();
  choiceCustomer.setChoices(
    [
      { value: "add_new", label: "➕ Add New Customer" },
      ...customerList.map(c => ({ value: c, label: c })),
    ],
    "value",
    "label",
    true
  );

  const custSelect = document.getElementById("customerSelect");
  custSelect.addEventListener("change", function () {
    if (this.value === "add_new") openModal();
  });

  // BUAT DEFAULT ROW hanya setelah data product sudah siap
  for (let i = 0; i < 3; i++) addRow();
}


/* ============================================================
   CUSTOMER MODAL
============================================================ */
function openModal() {
  document.getElementById("modal-bg").style.display = "flex";
  document.getElementById("newCustomerName").focus();
}

function closeModal() {
  document.getElementById("modal-bg").style.display = "none";
}

async function saveCustomer() {
  const name = document.getElementById("newCustomerName").value.trim();
  if (!name) return;

  await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

  choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
  choiceCustomer.setChoiceByValue(name);

  closeModal();
}


/* ============================================================
   ADD ROW
============================================================ */
function addRow() {
  const body = document.getElementById("itemsBody");

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="drag-handle">⋮⋮</td>

    <td>
      <select class="type-select">
        <option value="spandek">Spandek</option>
        <option value="non">Non Spandek</option>
      </select>
    </td>

    <td><select class="item-select"></select></td>

    <td><input type="number" class="meter-input" min="0"></td>
    <td><input type="number" class="qty-input" min="0"></td>

    <td><input type="text" class="unit-price-input" readonly></td>
    <td><input type="number" class="discount-input" value="0" min="0"></td>

    <td><input type="text" class="priceqty-input" readonly></td>
    <td><input type="text" class="line-total-input" readonly></td>

    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  const typeSel = tr.querySelector(".type-select");
  const itemSel = tr.querySelector(".item-select");
  const meterInput = tr.querySelector(".meter-input");

  /* INIT ITEM DROPDOWN */
  const choiceItem = new Choices(itemSel, {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
  });

  function loadItemChoices() {
    const list =
      typeSel.value === "spandek" ? listSpandek : listNonSpandek;

    choiceItem.clearChoices();
    choiceItem.setChoices(
      list.map(v => ({ value: v, label: v })),
      "value",
      "label",
      true
    );
  }

  // Saat row pertama kali dibuat, langsung load item list
  loadItemChoices();

  /* TYPE CHANGE */
  typeSel.onchange = () => {
    const isSpan = typeSel.value === "spandek";

    meterInput.disabled = !isSpan;
    meterInput.style.background = isSpan ? "#ffffff" : "#f0f0f0";
    if (!isSpan) meterInput.value = "";

    loadItemChoices();
    recalcRow(tr);
    recalcTotals();
  };

  // Awal: jika default type = spandek, meter aktif
  meterInput.disabled = false;

  /* ITEM → GET PRICE */
  itemSel.addEventListener("change", async () => {
    const product = itemSel.value;
    if (!product) return;

    const type = typeSel.value; // 'spandek' atau 'non'

    const r = await fetch(
      baseURL +
      "?action=getprice&product=" +
      encodeURIComponent(product) +
      "&type=" +
      encodeURIComponent(type)
    );

    const priceText = await r.text();
    const price = parseFloat(priceText) || 0;

    tr.querySelector(".unit-price-input").value =
      price > 0 ? price.toFixed(2) : "";

    recalcRow(tr);
    recalcTotals();
  });

  /* CALC ON INPUT */
  tr.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });

  enableDrag();
}


/* ============================================================
   DELETE ROW
============================================================ */
function deleteRow(el) {
  el.closest("tr").remove();
  recalcTotals();
}


/* ============================================================
   DRAG SORT
============================================================ */
function enableDrag() {
  new Sortable(document.getElementById("itemsBody"), {
    animation: 150,
    handle: ".drag-handle",
  });
}


/* ============================================================
   ROW CALCULATION
============================================================ */
function recalcRow(row) {
  const isSpan = row.querySelector(".type-select").value === "spandek";

  const rawMeter = parseFloat(row.querySelector(".meter-input").value);
  const meter = isSpan ? Math.max(0, (rawMeter || 0)) : 1;

  const rawQty = parseFloat(row.querySelector(".qty-input").value);
  const qty = Math.max(0, (rawQty || 0));

  const unit = Math.max(
    0,
    parseFloat(row.querySelector(".unit-price-input").value) || 0
  );

  const rawDisc = parseFloat(row.querySelector(".discount-input").value);
  const disc = Math.max(0, (rawDisc || 0));

  const net = unit - disc;
  const ppq = net * meter;
  const total = ppq * qty;

  row.querySelector(".priceqty-input").value =
    ppq > 0 ? ppq.toFixed(2) : "";
  row.querySelector(".line-total-input").value =
    total > 0 ? total.toFixed(2) : "";
}


/* ============================================================
   TOTAL CALC
============================================================ */
function recalcTotals() {
  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach(el => {
    grand += parseFloat(el.value) || 0;
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent = dpp.toFixed(2);
  document.getElementById("ppnDisplay").textContent = ppn.toFixed(2);
  document.getElementById("grandTotalDisplay").textContent = grand.toFixed(2);
}
