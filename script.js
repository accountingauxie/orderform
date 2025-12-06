/* CONFIG */
const baseURL =
  "https://script.google.com/macros/s/AKfycbxALt0Mi8bblQu7Zle70LLgFerBhUvfdAHJNZvPbB5i_hACp2MbPhzj56BRo3Emdk45Gw/exec";

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

    <td><input type="number" class="meter-input" step="0.001"></td>
    <td><input type="number" class="qty-input" step="1"></td>

    <td><input type="text" class="unit-price-input" readonly></td>
    <td><input type="number" class="discount-input" step="1" value="0"></td>

    <td><input type="text" class="priceqty-input" readonly></td>
    <td><input type="text" class="line-total-input" readonly></td>

    <td class="delete-row" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  const typeSel = tr.querySelector(".type-select");
  const itemSel = tr.querySelector(".item-select");
  const meterInput = tr.querySelector(".meter-input");

  typeSel.value = ""; // force reset
  meterInput.disabled = true;

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

  typeSel.addEventListener("change", () => {
    if (typeSel.value === "Spandek") {
      meterInput.disabled = false;
    } else {
      meterInput.value = "";
      meterInput.disabled = true;
    }

    loadItemsForType();
    tr.querySelector(".unit-price-input").value = "";
    tr.querySelector(".priceqty-input").value = "";
    tr.querySelector(".line-total-input").value = "";
  });

  itemSel.addEventListener("change", () => {
    const item = itemSel.value;
    let price = 0;

    /* 🔥 SUPPORT ARRAY & OBJECT */
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

/* ================= PER BARIS ================= */

function recalcRow(row) {
  const type = row.querySelector(".type-select").value;

  let meter = parseFloat(row.querySelector(".meter-input").value) || 0;
  if (type === "Non Spandek") meter = 1;

  const qty = parseFloat(row.querySelector(".qty-input").value) || 0;
  const unit = parseMoney(row.querySelector(".unit-price-input").value);
  const disc = parseFloat(row.querySelector(".discount-input").value) || 0;

  const netUnit = unit - disc;
  const priceQty = netUnit * (meter || 1);
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
