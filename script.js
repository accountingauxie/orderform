/* CONFIG */
const baseURL =
  "https://script.google.com/macros/s/AKfycbxALt0Mi8bblQu7Zle70LLgFerBhUvfdAHJNZvPbB5i_hACp2MbPhzj56BRo3Emdk45Gw/exec";

let listSpandek = [];
let listNonSpandek = [];
let spandekPrice = {};
let nonSpandekPrice = {};

let customerList = [];
let choiceCustomer;

/* ON LOAD */
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

  for (let i = 0; i < 3; i++) addRow(); // default 3 rows

  document.getElementById("saveCustomerBtn").onclick = saveCustomer;
};

/* AUTO ORDER NUMBER */
function setOrderNumber() {
  const key = "ORDERFORM_LAST_ORDER";
  let last = localStorage.getItem(key) || "1000000";
  let next = parseInt(last) + 1;

  localStorage.setItem(key, next);
  document.getElementById("orderNumber").value = next;
}

/* LOAD DATA */
async function loadDropdowns() {
  const res = await fetch(baseURL + "?action=getdata");
  const data = await res.json();

  customerList = data.customers || [];
  listSpandek = data.spandek || [];
  listNonSpandek = data.nonspandek || [];
  spandekPrice = data.priceSpan || {};
  nonSpandekPrice = data.priceNon || {};

  /* CONTACT */
  choiceCustomer.clearChoices();
  choiceCustomer.setChoices(
    [
      { value: "add_new", label: "➕ Add New Customer" },
      ...customerList.map(c => ({ value: c, label: c }))
    ],
    "value", "label", true
  );

  document.getElementById("customerSelect").addEventListener("change", e => {
    if (e.target.value === "add_new") openModal();
  });
}

/* ADD CUSTOMER */
function openModal() {
  document.getElementById("modal-bg").style.display = "flex";
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

/* ADD ROW */
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

    <td><input type="number" class="meter-input" min="0" step="0.001"></td>
    <td><input type="number" class="qty-input" min="0"></td>

    <td><input type="text" class="unit-price-input" readonly></td>
    <td><input type="number" class="discount-input" min="0" value="0"></td>

    <td><input type="text" class="priceqty-input" readonly></td>
    <td><input type="text" class="line-total-input" readonly></td>

    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  /* INIT ITEM DROPDOWN */
  const typeSel = tr.querySelector(".type-select");
  const itemSel = tr.querySelector(".item-select");

  const choiceItem = new Choices(itemSel, {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
    position: "bottom"
  });

  function loadItems() {
    const list = typeSel.value === "spandek" ? listSpandek : listNonSpandek;
    choiceItem.clearChoices();
    choiceItem.setChoices(list.map(v => ({ value: v, label: v })), "value", "label", true);
  }

  loadItems();

  typeSel.onchange = () => {
    tr.querySelector(".meter-input").disabled = typeSel.value === "non";
    if (typeSel.value === "non") tr.querySelector(".meter-input").value = "";
    loadItems();
    recalcRow(tr);
    recalcTotals();
  };

  itemSel.addEventListener("change", () => {
    const item = itemSel.value;
    const price =
      typeSel.value === "spandek"
        ? spandekPrice[item] || 0
        : nonSpandekPrice[item] || 0;

    tr.querySelector(".unit-price-input").value = price.toLocaleString();
    recalcRow(tr);
    recalcTotals();
  });

  tr.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });

  enableDrag();
}

/* DELETE ROW */
function deleteRow(el) {
  el.closest("tr").remove();
  recalcTotals();
}

/* ENABLE DRAG */
function enableDrag() {
  new Sortable(document.getElementById("itemsBody"), {
    animation: 120,
    handle: ".drag-handle"
  });
}

/* ROW CALC */
function recalcRow(row) {
  const type = row.querySelector(".type-select").value;

  let meter = parseFloat(row.querySelector(".meter-input").value) || 0;
  if (type === "non") meter = 1;

  const qty = parseFloat(row.querySelector(".qty-input").value) || 0;
  let unit = row.querySelector(".unit-price-input").value.replace(/,/g, "");
  unit = parseFloat(unit) || 0;

  const disc = parseFloat(row.querySelector(".discount-input").value) || 0;

  const net = unit - disc;
  const priceQty = net * meter;
  const total = priceQty * qty;

  row.querySelector(".priceqty-input").value = priceQty.toLocaleString();
  row.querySelector(".line-total-input").value = total.toLocaleString();
}

/* TOTAL CALC */
function recalcTotals() {
  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach(el => {
    let v = el.value.replace(/,/g, "");
    grand += parseFloat(v) || 0;
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent = dpp.toLocaleString();
  document.getElementById("ppnDisplay").textContent = ppn.toLocaleString();
  document.getElementById("grandTotalDisplay").textContent = grand.toLocaleString();
}
