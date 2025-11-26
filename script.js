window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";
    let productList = [];
    let choiceCustomer;

    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    const modalBG = document.getElementById("modal-bg");
    const newCustomerInput = document.getElementById("newCustomerName");
    const saveCustomerBtn = document.getElementById("saveCustomerBtn");
    const cancelCustomerBtn = document.getElementById("cancelCustomerBtn");

    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    /* ------------------------ FORMAT ------------------------ */
    function formatRupiah(num) {
        return "Rp " + Number(num || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    function formatXero(num) {
        const n = Number(num || 0);
        return n.toLocaleString("en-NZ", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /* ------------------------ ORDER NUMBER ------------------------ */
    const ORDER_PREFIX = "1";  
    const ORDER_KEY = "ORDERFORM_LAST_ORDER";

    function generateOrderNumber() {
        let last = localStorage.getItem(ORDER_KEY);

        if (!last) {
            const newNum = ORDER_PREFIX + "000001";
            localStorage.setItem(ORDER_KEY, newNum);
            return newNum;
        }

        const prefix = last.slice(0,1);
        const counter = parseInt(last.slice(1), 10);

        const next = prefix + String(counter + 1).padStart(6, "0");
        localStorage.setItem(ORDER_KEY, next);
        return next;
    }

    function setOrderNumber() {
        const num = generateOrderNumber();
        document.getElementById("ordnum").value = num;
    }

    /* ------------------------ LOAD DROPDOWN ------------------------ */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        // CUSTOMER DROPDOWN
        choiceCustomer = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true,
            itemSelectText: ""
        });

        const customerArray = data.customers || [];

        choiceCustomer.setChoices(
            [
                { value: "__add__", label: "➕ Add New Customer", disabled: false },
                ...customerArray.map(c => ({ value: c, label: c }))
            ],
            "value",
            "label",
            true
        );

        document.getElementById("customer").addEventListener("change", e => {
            if (e.target.value === "__add__") {
                modalBG.style.display = "block";
                newCustomerInput.value = "";
                newCustomerInput.focus();
            }
        });

        cancelCustomerBtn.onclick = () => {
            modalBG.style.display = "none";
            choiceCustomer.setChoiceByValue("");
        };

        saveCustomerBtn.onclick = async () => {
            const name = newCustomerInput.value.trim();
            if (!name) return;

            await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

            choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
            choiceCustomer.setChoiceByValue(name);

            modalBG.style.display = "none";
        };

        // Order number
        setOrderNumber();

        // Default 3 rows
        addLine(); addLine(); addLine();
        calculateSummary();
    }

    /* ------------------------ ADD ROW ------------------------ */
    function addLine() {
        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="col-drag">⋮⋮</td>

            <td><select class="product-select" name="product_${idx}"></select></td>

            <td><input type="number" class="meter" min="0" step="0.01" name="meter_${idx}"></td>
            <td><input type="number" class="qty" min="0" step="1" name="qty_${idx}"></td>

            <td><input type="text" class="unitPrice" data-value="" name="unitPrice_${idx}" readonly></td>

            <td><input type="number" class="discUnit" min="0" step="0.01" value="0" name="discUnit_${idx}"></td>

            <td><input type="text" class="ppq" data-value="" name="ppq_${idx}" readonly></td>

            <td><input type="text" class="totalPrice" data-value="" name="total_${idx}" readonly></td>

            <td><button type="button" class="delete-btn">🗑</button></td>
        `;

        orderBody.appendChild(tr);

        /* Product dropdown */
        const select = tr.querySelector(".product-select");
        const choice = new Choices(select, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: ""
        });

        choice.setChoices(
            productList.map(v => ({ value: v, label: v })),
            "value",
            "label",
            true
        );

        select.addEventListener("change", () => updatePrice(tr));
        tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".discUnit").addEventListener("input", () => calculateRow(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calculateSummary();
        });
    }

    /* ------------------------ GET PRICE ------------------------ */
    async function updatePrice(tr) {
        const product = tr.querySelector(".product-select").value;
        if (!product) return;

        const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
        const price = parseFloat(await res.text()) || 0;

        const up = tr.querySelector(".unitPrice");
        up.setAttribute("data-value", price);
        up.value = formatRupiah(price);

        calculateRow(tr);
    }

    /* ------------------------ CALCULATE ROW ------------------------ */
    function calculateRow(tr) {
        const meter = parseFloat(tr.querySelector(".meter").value) || 0;
        const qty = parseFloat(tr.querySelector(".qty").value) || 0;
        const discUnit = parseFloat(tr.querySelector(".discUnit").value) || 0;

        const unitPrice = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

        const netUnit = Math.max(unitPrice - discUnit, 0);
        const ppq = meter * netUnit;
        const total = ppq * qty;

        tr.querySelector(".ppq").setAttribute("data-value", ppq);
        tr.querySelector(".ppq").value = formatRupiah(ppq);

        tr.querySelector(".totalPrice").setAttribute("data-value", total);
        tr.querySelector(".totalPrice").value = formatRupiah(total);

        calculateSummary();
    }

    /* ------------------------ SUMMARY ------------------------ */
    function calculateSummary() {
        let grand = 0;

        document.querySelectorAll(".totalPrice").forEach(el => {
            grand += parseFloat(el.getAttribute("data-value")) || 0;
        });

        const dpp = grand / 1.11;
        const ppn = grand - dpp;

        document.getElementById("grandVal").textContent = formatXero(grand);
        document.getElementById("dppVal").textContent = formatXero(dpp);
        document.getElementById("ppnVal").textContent = formatXero(ppn);
    }

    /* ------------------------ SUBMIT FORM ------------------------ */
    orderForm.addEventListener("submit", async e => {
        e.preventDefault();

        if (!document.getElementById("customer").value) {
            alert("Customer wajib diisi.");
            return;
        }

        let validRow = false;
        document.querySelectorAll(".product-select").forEach(sel => {
            if (sel.value) validRow = true;
        });
        if (!validRow) {
            alert("Minimal 1 product harus diisi.");
            return;
        }

        // Convert data-value → value
        document.querySelectorAll("[data-value]").forEach(el => {
            el.value = el.getAttribute("data-value");
        });

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.textContent = "Sending...";

        try {
            const res = await fetch(baseURL, {
                method: "POST",
                body: new FormData(orderForm)
            });
            const txt = await res.text();
            alert(txt);

            orderForm.reset();
            orderBody.innerHTML = "";
            document.getElementById("date").value = new Date().toISOString().split("T")[0];

            setOrderNumber();

            addLine(); addLine(); addLine();
            calculateSummary();

        } catch (err) {
            alert("Gagal mengirim. Coba lagi.");
            console.error(err);
        }

        btn.disabled = false;
        btn.textContent = "Kirim Order";
    });

    /* ------------------------ INIT ------------------------ */
    loadDropdowns();

    Sortable.create(orderBody, {
        handle: ".col-drag",
        animation: 150
    });
};
