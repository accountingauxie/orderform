/* CONFIG */
const baseURL =
  "https://script.google.com/macros/s/AKfycbxALt0Mi8bblQu7Zle70LLgFerBhUvfdAHJNZvPbB5i_hACp2MbPhzj56BRo3Emdk45Gw/exec";

let listSpandek = [];
let listNonSpandek = [];
let spandekPrice = {};
let nonSpandekPrice = {};

let customerList = [];
let choiceCustomer;

/* ===== HELPER FORMAT UANG (selalu 0.00) ===== */
function formatMoney(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ON LOAD */
window.onload = function () {
  // Choices untuk Contact
  choiceCustomer = new Choices("#customerSelect", {
    searchEnabled: true,
    itemSelectText: "",
    shouldSort: false,
    position: "bottom"
  });

  // Tanggal hari ini
  document.getElementById("issueDate").value =
    new Date().toISOString().split("T")[0];

  loadDropdowns();
  setOrderNumber();

  // Default 3 baris
  for (let i = 0; i < 3; i++) addRow();

  // Sortable drag handle
  new Sortable(document.getElementById("itemsBody"), {
    handle: ".drag-handle",
    animation: 150
  });
};

/* AUTO ORDER NUMBER */
function setOrderNumber() {
  const key = "ORDERFORM_LAST_ORDER";
  let last = localStorage.getItem(key) || "1000018"; // biar next 1000019 seperti screenshot
  let next = parseInt(last, 10) + 1;

  localStorage.setItem(key, String(next));
  document.getElementById("orderNumber").value = next;
}

/* LOAD DATA DARI APPS SCRIPT */
async function loadDropdowns() {
  try {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    customerList = data.customers || [];
    listSpandek = data.spandek || [];
    listNonSpandek = data.nonspandek || [];
    spandekPrice = data.priceSpan || {};
    nonSpandekPrice = data.priceNon || {};

    // Contact dropdown
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

    document
      .getElementById("customerSelect")
      .addEventListener("change", (e) => {
        if (e.target.value === "add_new") {
          alert("Add new customer (modal belum dibuat di versi ini).");
        }
      });
  } catch (err) {
    console.error("loadDropdowns error:", err);
  }
}

/* TAMBAH BARIS ITEM */
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

    <td>
      <select class="item-select"></select>
    </td>

    <td>
      <input type="number" class="meter-input" min="0" step="0.001">
    </td>

    <td>
      <input type="number" class="qty-input" min="0" step="1">
    </td>

    <td>
      <input type="text" class="unit-price-input" readonly>
    </td>

    <td>
      <input type="number" class="discount-input" min="0" step="1" value="0">
    </td>

    <td>
      <input type="text" class="priceqty-input" readonly>
    </td>

    <td>
      <input type="text" class="line-total-input" readonly>
    </td>

    <td class="delete-row" title="Delete" onclick="deleteRow(this)">🗑</td>
  `;

  body.appendChild(tr);

  // TYPE & ITEM DROPDOWN
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
    choiceItem.setChoices(
      list.map((v) => ({ value: v, label: v })),
      "value",
      "label",
      true
    );
  }

  loadItems(); // initial

  // Non Spandek → Meter disabled
  typeSel.addEventListener("change", () => {
    const meterInput = tr.querySelector(".meter-input");
    if (typeSel.value === "non") {
      meterInput.value = "";
      meterInput.disabled = true;
    } else {
      meterInput.disabled = false;
    }

    loadItems();
    recalcRow(tr);
    recalcTotals();
  });

  // Saat memilih item → set harga
  itemSel.addEventListener("change", () => {
    const item = itemSel.value;
    const price =
      typeSel.value === "spandek"
        ? spandekPrice[item] || 0
        : nonSpandekPrice[item] || 0;

    tr.querySelector(".unit-price-input").value = formatMoney(price);
    recalcRow(tr);
    recalcTotals();
  });

  // Perubahan angka di row
  tr.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => {
      recalcRow(tr);
      recalcTotals();
    });
  });
}

/* HAPUS BARIS */
function deleteRow(el) {
  el.closest("tr")?.remove();
  recalcTotals();
}

/* PERHITUNGAN PER BARIS */
function recalcRow(row) {
  const type = row.querySelector(".type-select").value;

  let meter = parseFloat(row.querySelector(".meter-input").value) || 0;
  if (type === "non") meter = 1; // non spandek meter = 1

  const qty = parseFloat(row.querySelector(".qty-input").value) || 0;

  let unitStr = row
    .querySelector(".unit-price-input")
    .value.replace(/,/g, "");
  const unit = parseFloat(unitStr) || 0;

  const disc = parseFloat(row.querySelector(".discount-input").value) || 0;

  const netUnit = unit - disc;
  const priceQty = netUnit * meter;
  const total = priceQty * qty;

  row.querySelector(".priceqty-input").value = formatMoney(priceQty);
  row.querySelector(".line-total-input").value = formatMoney(total);
}

/* PERHITUNGAN TOTAL */
function recalcTotals() {
  let grand = 0;

  document.querySelectorAll(".line-total-input").forEach((el) => {
    const v = parseFloat(el.value.replace(/,/g, "")) || 0;
    grand += v;
  });

  const dpp = grand / 1.11;
  const ppn = grand - dpp;

  document.getElementById("dppDisplay").textContent = formatMoney(dpp);
  document.getElementById("ppnDisplay").textContent = formatMoney(ppn);
  document.getElementById("grandTotalDisplay").textContent = formatMoney(grand);
}
