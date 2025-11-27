/* ============================================================
   GLOBAL CONFIG
============================================================ */
const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";

let productList = [];
let customerList = [];
let choiceCustomer;

/* ============================================================
   ON LOAD
============================================================ */
window.onload = function () {

    // init customer dropdown
    choiceCustomer = new Choices("#customerSelect", {
        searchEnabled: true,
        itemSelectText: "",
        shouldSort: false,
    });

    loadDropdowns();

    // set issue date
    document.getElementById("issueDate").value =
        new Date().toISOString().split("T")[0];

    // order number
    setOrderNumber();

    // default 5 rows
    for (let i = 0; i < 5; i++) addRow();

    // modal handling
    document.getElementById("saveCustomerBtn").onclick = saveCustomer;
    document.querySelector(".btn-cancel").onclick = closeModal;

    // prevent Enter submit
    document.addEventListener("keydown", e => {
        if (e.key === "Enter") e.preventDefault();
    });
};

/* ============================================================
   ORDER NUMBER AUTOGENERATE 1XXXXXX
============================================================ */
const ORDER_KEY = "ORDERFORM_LAST_ORDER";

function generateOrderNumber() {
    let last = localStorage.getItem(ORDER_KEY);

    if (!last) last = "1000000"; // first number

    let next = parseInt(last) + 1;
    localStorage.setItem(ORDER_KEY, next);

    return next;
}

function setOrderNumber() {
    const order = generateOrderNumber();
    const input = document.getElementById("orderNumber");
    input.value = order;
    input.setAttribute("readonly", true);
    input.style.background = "#f1f3f5";
    input.style.cursor = "not-allowed";
}

/* ============================================================
   LOAD DROPDOWNS (CUSTOMER + PRODUCT)
============================================================ */
async function loadDropdowns() {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    productList = data.products || [];
    customerList = data.customers || [];

    choiceCustomer.clearChoices();
    choiceCustomer.setChoices(
        [
            { value: "add_new", label: "➕ Add New Customer" },
            ...customerList.map(c => ({ value: c, label: c }))
        ],
        "value", "label", true
    );

    document.getElementById("customerSelect")
        .addEventListener("change", function () {
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

    await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

    choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
    choiceCustomer.setChoiceByValue(name);

    closeModal();
}

/* ============================================================
   ADD ROW (WITH TYPE COLUMN + DRAG ICON)
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

    // fill product dropdown
    new Choices(tr.querySelector(".item-name"), {
        searchEnabled: true,
        itemSelectText: "",
        choices: productList.map(p => ({ value: p, label: p }))
    });

    // TYPE LOGIC
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

    // event listeners
    tr.querySelectorAll("input").forEach(inp => {
        inp.oninput = () => {
            recalcRow(tr);
            recalcTotals();
        };
    });

    // enable drag reorder
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
        handle: ".drag-handle"
    });
}

/* ============================================================
   CALCULATE PER ROW
============================================================ */
function recalcRow(row) {
    const type = row.querySelector(".type-select").value;
    const meter = type === "spandek"
        ? parseFloat(row.querySelector(".meter-input").value) || 0
        : 1; // non-spandek treat meter as 1

    const qty = parseFloat(row.querySelector(".qty-input").value) || 0;
    const unit = parseFloat(row.querySelector(".unit-price-input").value) || 0;
    const disc = parseFloat(row.querySelector(".discount-input").value) || 0;

    const netUnit = unit - disc;
    const priceQty = netUnit * meter;
    const total = priceQty * qty;

    row.querySelector(".priceqty-input").value = priceQty ? priceQty.toFixed(2) : "";
    row.querySelector(".line-total-input").value = total ? total.toFixed(2) : "";
}

/* ============================================================
   CALCULATE TOTALS
============================================================ */
function recalcTotals() {
    let final = 0;

    document.querySelectorAll(".line-total-input").forEach(el => {
        final += parseFloat(el.value) || 0;
    });

    let dpp = final / 1.11;
    let ppn = final - dpp;

    document.getElementById("dppDisplay").textContent = dpp.toFixed(2);
    document.getElementById("ppnDisplay").textContent = ppn.toFixed(2);
    document.getElementById("grandTotalDisplay").textContent = final.toFixed(2);
}
