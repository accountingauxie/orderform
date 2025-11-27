/* ============================================================
   GLOBALS
============================================================ */
const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";

let productList = [];
let customerList = [];
let choiceCustomer;

/* ============================================================
   ON LOAD
============================================================ */
window.onload = function () {

    // Init Customer Choices.js
    choiceCustomer = new Choices("#customerSelect", {
        searchEnabled: true,
        itemSelectText: "",
        shouldSort: false
    });

    // Load data
    loadDropdowns();

    // Set Issue Date today
    document.getElementById("issueDate").value =
        new Date().toISOString().split("T")[0];

    // Auto Order Number
    setOrderNumber();

    // Add default 5 rows like screenshot
    for (let i = 0; i < 5; i++) addRow();

    // Prevent Enter submit
    document.addEventListener("keydown", e => {
        if (e.key === "Enter") e.preventDefault();
    });

    // Modal buttons
    document.getElementById("saveCustomerBtn").onclick = saveCustomer;
    document.querySelector(".btn-cancel").onclick = closeModal;
};

/* ============================================================
   ORDER NUMBER AUTOGENERATE 1xxxxxx
============================================================ */
const ORDER_KEY = "ORDERFORM_LAST_ORDER";

function generateOrderNumber() {
    let last = localStorage.getItem(ORDER_KEY);
    if (!last) last = "1000000";

    let next = parseInt(last) + 1;
    localStorage.setItem(ORDER_KEY, next);

    return next;
}

function setOrderNumber() {
    document.getElementById("orderNumber").value = generateOrderNumber();
}

/* ============================================================
   LOAD CUSTOMER + PRODUCT LIST
============================================================ */
async function loadDropdowns() {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    productList = data.products || [];
    customerList = data.customers || [];

    // Load Customers
    choiceCustomer.clearChoices();
    choiceCustomer.setChoices(
        [
            { value: "add_new", label: "➕ Add New Customer" },
            ...customerList.map(c => ({ value: c, label: c }))
        ],
        "value", "label", true
    );

    document.getElementById("customerSelect").addEventListener("change", function () {
        if (this.value === "add_new") openModal();
    });
}

/* ============================================================
   MODAL CUSTOMER
============================================================ */
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

    // Save to DB (optional)
    await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

    // Add to dropdown
    choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
    choiceCustomer.setChoiceByValue(name);

    closeModal();
}

/* ============================================================
   ADD ROW (MATCH EXACT HTML UI)
============================================================ */
function addRow() {
    const body = document.getElementById("itemsBody");

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><select class="item-name"></select></td>
        <td><input type="number" class="meter-input"></td>
        <td><input type="number" class="qty-input"></td>
        <td><input type="number" class="unit-price-input"></td>
        <td><input type="number" class="discount-input" value="0"></td>
        <td><input type="number" class="priceqty-input" readonly></td>
        <td><input type="number" class="line-total-input" readonly></td>
        <td class="delete-row" onclick="deleteRow(this)">🗑</td>
    `;

    body.appendChild(tr);

    // Load product dropdown
    new Choices(tr.querySelector(".item-name"), {
        searchEnabled: true,
        itemSelectText: "",
        choices: productList.map(p => ({ value: p, label: p }))
    });

    // Add listeners
    tr.querySelectorAll("input").forEach(inp => {
        inp.oninput = () => {
            recalcRow(tr);
            recalcTotals();
        };
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
   DRAG AND DROP
============================================================ */
function enableDrag() {
    new Sortable(document.getElementById("itemsBody"), {
        animation: 150,
        handle: "td:first-child"
    });
}

/* ============================================================
   CALCULATE PER ROW
============================================================ */
function recalcRow(row) {
    const qty = parseFloat(row.querySelector(".qty-input").value) || 0;
    const unit = parseFloat(row.querySelector(".unit-price-input").value) || 0;
    const disc = parseFloat(row.querySelector(".discount-input").value) || 0;

    const netUnit = unit - disc;
    const total = qty * netUnit;

    row.querySelector(".priceqty-input").value = netUnit ? netUnit.toFixed(2) : "";
    row.querySelector(".line-total-input").value = total ? total.toFixed(2) : "";
}

/* ============================================================
   CALCULATE TOTALS (DPP + PPN + GT)
============================================================ */
function recalcTotals() {
    let total = 0;

    document.querySelectorAll(".line-total-input").forEach(el => {
        total += parseFloat(el.value) || 0;
    });

    const dpp = total / 1.11;
    const ppn = total - dpp;

    document.getElementById("dppDisplay").textContent = dpp.toFixed(2);
    document.getElementById("ppnDisplay").textContent = ppn.toFixed(2);
    document.getElementById("grandTotalDisplay").textContent = total.toFixed(2);
}
