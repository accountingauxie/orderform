const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";

let productList = [];
let customerList = [];
let choiceCustomer;

/* ===========================
   ON LOAD
=========================== */
window.onload = function () {
  // init Choices untuk contact
  choiceCustomer = new Choices("#customerSelect", {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
  });

  // tanggal hari ini
  document.getElementById("issueDate").value =
    new Date().toISOString().split("T")[0];

  // order number
  setOrderNumber();

  // load customer & product dari GAS
  loadDropdowns();

  // default 5 baris
  for (let i = 0; i < 5; i++) addRow();

  // prevent Enter submit
  document.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });

  // modal
  document.getElementById("saveCustomerBtn").onclick = saveCustomer;
};

/* ===========================
   ORDER NUMBER 1XXXXXX
=========================== */
const ORDER_KEY = "ORDERFORM_LAST_ORDER";

function generateOrderNumber() {
  let last = localStorage.getItem(ORDER_KEY);
  if (!last) last = "1000000";

  const next = parseInt(last, 10) + 1;
  localStorage.setItem(ORDER_KEY, next);
  return next;
}

function setOrderNumber() {
  const input = document.getElementById("orderNumber");
  input.value = generateOrderNumber();
  input.readOnly = true;
  input.style.background = "#f5f7fa";
  input.style.cursor = "not-allowed";
}

/* ===========================
   LOAD DROPDOWNS
=========================== */
async function loadDropdowns() {
  const res = await fetch(baseURL + "?action=getdata");
  const data = await res.json();

  productList = data.products || [];
  customerList = data.customers || [];

  // contact
  choiceCustomer.clearChoices();
  choiceCustomer.setChoices(
    [
      { value: "add_new", label: "➕ Add New Customer" },
      ...customerList.map(c => ({ value: c, label: c }))
    ],
    "value",
    "label",
    true
  );

  document.getElementById("customerSelect").addEventListener("change", function () {
    if (this.value === "add_new") openModal();
  });
}

/* ===========================
   MODAL CUSTOMER
=========================== */
function openModal() {
  document.getElementById("modal-bg").style.display = "flex";
  document.getElementById("newCustomerName").focus();
}

function closeModal() {
  document.getElementById("modal-bg").style.display = "none";
  document.getElementById("newCustomerName").value = "";
  document.getElementById("newCustomerPhone").value = "";
  document.getElementById("newCustomerAddress").value = "";
}

async function saveCustomer() {
  const name = document.getElementById("newCustomerName").value.trim();
  if (!name) return;

  await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

  choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
  choiceCustomer.setChoiceByValue(name);

  closeModal();
}

/* ===========================
   ADD ROW
=========================== */
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

    <td><input type="number" class="meter-input"></td>
    <td><input type="number" class="qty-input"></td>
    <td><input type="number" class="unit-price-input"></td>
    <td><input type="number" class="discount-input" value="0"></td>
    <td><input type="number" class="priceqty-input" readonly></td>
    <td><input type="number" class="line-total-input" readonly></td>
    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  // product dropdown
  new Choices(tr.querySelector(".item-select"), {
    searchEnabled: true,
    itemSelectText: "",
    choices: productList.map(p => ({ value: p, label: p }))
  });

  // TYPE logic (meter enable/disable)
  const typeSel = tr.querySelector(".type-select");
  const meterInput = tr.querySelector(".meter-input");

  typeSel.onchange = () => {
    if (typeSel.value === "spandek") {
      meterInput.disabled = false;
      meterInput.style.background = "#ffffff";
    } else {
      meterInput.disabled = true;
      meterInput.value = "";
      meterInput.style.background = "#f0f0f0";
    }
    recalcRow(tr);
    recalcTotals();
  };

  // default Spandek → meter aktif
  typeSel.dispatchEvent(new Event("change"));

  // calculation listeners
  tr.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });

  // enable drag
  enableDrag();
}

/* ===========================
   DELETE ROW
=========================== */
function deleteRow(el) {
  el.closest("tr").remove();
  recalcTotals();
}

/* ===========================
   DRAG
=========================== */
function enableDrag() {
  new Sortable(document.getElementById("itemsBody"), {
    animation: 150,
    handle: ".drag-handle"
  });
}

/* ===========================
   PER ROW CALC
=========================== */
function recalcRow(row) {
  const type = row.querySelector(".type-select").value;

  const meter = (type === "spandek")
    ? (parseFloat(row.querySelector(".meter-input").value) || 0)
    : 1;  // non-spandek anggap 1

  const qty   = parseFloat(row.querySelector(".qty-input").value) || 0;
  const unit  = parseFloat(row.querySelector(".unit-price-input").value) || 0;
  const disc  = parseFloat(row.querySelector(".discount-input").value) || 0;

  const netUnit  = unit - disc;
  const priceQty = netUnit * meter;
  const total    = priceQty * qty;

  row.querySelector(".priceqty-input").value  = priceQty ? priceQty.toFixed(2)  : "";
  row.querySelector(".line-total-input").value = total ? total.toFixed(2) : "";
}

/* ===========================
   TOTALS
=========================== */
function recalcTotals() {
  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach(el => {
    grand += parseFloat(el.value) || 0;
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent        = dpp.toFixed(2);
  document.getElementById("ppnDisplay").textContent        = ppn.toFixed(2);
  document.getElementById("grandTotalDisplay").textContent = grand.toFixed(2);
}
