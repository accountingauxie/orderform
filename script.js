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
   FORMAT RUPIAH (TANPA UBAH UI)
============================================================ */
function formatNumber(num) {
  return Number(num).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* Convert string "37.000,00" → number 37000 */
function unformatNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
}


/* ============================================================
   ON LOAD
============================================================ */
window.onload = function () {

  // init dropdown customer
  choiceCustomer = new Choices("#customerSelect", {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
  });

  document.getElementById("issueDate").value =
    new Date().toISOString().split("T")[0];

  setOrderNumber();
  loadDropdowns();

  document.getElementById("saveCustomerBtn").onclick = saveCustomer;

  document.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });
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
   LOAD DROPDOWNS
============================================================ */
async function loadDropdowns() {

  const res = await fetch(baseURL + "?action=getdata");
  const data = await res.json();

  listSpandek = data.spandek || [];
  listNonSpandek = data.nonspandek || [];

  /* CUSTOMER DROPDOWN */
  choiceCustomer.clearChoices();
  choiceCustomer.setChoices(
    [
      { value: "add_new", label: "➕ Add New Customer" },
      ...data.customers.map(c => ({ value: c, label: c })),
    ],
    "value",
    "label",
    true
  );

  document.getElementById("customerSelect").onchange = function () {
    if (this.value === "add_new") openModal();
  };

  // default rows = 3
  for (let i = 0; i < 3; i++) addRow();
}


/* ============================================================
   CUSTOMER MODAL HANDLER
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

  await fetch(baseURL + "?action=addcustomer&name=" + encodeURIComponent(name));

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

  /* INIT item dropdown */
  const choiceItem = new Choices(itemSel, {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
  });


  function loadItemChoices() {
    const list = typeSel.value === "spandek" ? listSpandek : listNonSpandek;

    choiceItem.clearChoices();
    choiceItem.setChoices(
      list.map(v => ({ value: v, label: v })),
      "value",
      "label",
      true
    );
  }

  loadItemChoices();


  /* CHANGE TYPE */
  typeSel.onchange = () => {
    const isSpan = typeSel.value === "spandek";

    meterInput.disabled = !isSpan;
    meterInput.style.background = isSpan ? "#ffffff" : "#f0f0f0";
    if (!isSpan) meterInput.value = "";

    loadItemChoices();
    recalcRow(tr);
    recalcTotals();
  };


  /* WHEN ITEM SELECTED → GET PRICE */
  itemSel.addEventListener("change", async () => {

    const product = itemSel.value;
    if (!product) return;

    const type = typeSel.value;

    const r = await fetch(
      baseURL +
      "?action=getprice" +
      "&product=" + encodeURIComponent(product) +
      "&type=" + encodeURIComponent(type)
    );

    const price = parseFloat(await r.text()) || 0;

    tr.querySelector(".unit-price-input").value =
      price ? formatNumber(price) : "";

    recalcRow(tr);
    recalcTotals();
  });


  /* RECALC ON INPUT */
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
   ENABLE DRAG SORT
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

  const meter = isSpan
    ? Math.max(0, parseFloat(row.querySelector(".meter-input").value) || 0)
    : 1;

  const qty = Math.max(0, parseFloat(row.querySelector(".qty-input").value) || 0);

  const unit = unformatNumber(row.querySelector(".unit-price-input").value);
  const disc = Math.max(0, parseFloat(row.querySelector(".discount-input").value) || 0);

  const net = unit - disc;
  const ppq = net * meter;
  const total = ppq * qty;

  row.querySelector(".priceqty-input").value =
    ppq ? formatNumber(ppq) : "";

  row.querySelector(".line-total-input").value =
    total ? formatNumber(total) : "";
}


/* ============================================================
   TOTAL CALC
============================================================ */
function recalcTotals() {

  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach(el => {
    grand += unformatNumber(el.value);
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent = formatNumber(dpp);
  document.getElementById("ppnDisplay").textContent = formatNumber(ppn);
  document.getElementById("grandTotalDisplay").textContent = formatNumber(grand);
}
