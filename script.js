window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbxPt-rxcR5owCnEB0vJq3NHT6w4UCN2hx3m9RMl6gRoJUeo7wkSM4pZ1gRRK8CfN1iB/exec";
    let productList = [];
    let choiceCustomer;

    // ✅ AMAN: ambil elemen dengan jelas, jangan andalkan global ID
    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    const modalBG = document.getElementById("modal-bg");
    const newCustomerInput = document.getElementById("newCustomerName");
    const saveCustomerBtn = document.getElementById("saveCustomerBtn");

    // set default tanggal hari ini
    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    function formatRupiah(num) {
        return "Rp " + Number(num || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    /* ==========================
       LOAD DATA FROM APPSCRIPT
       ========================== */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        /* CUSTOMER DROPDOWN */
        choiceCustomer = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true
        });

        choiceCustomer.setChoices(
            [
                ...(data.customers || []).map(v => ({ value: v, label: v })),
                { value: "__add__", label: "➕ Add New Customer" }
            ],
            "value",
            "label",
            true
        );

        document.getElementById("customer").addEventListener("change", function () {
            if (this.value === "__add__") {
                modalBG.style.display = "block";
                newCustomerInput.value = "";
                newCustomerInput.focus();
            }
        });

        saveCustomerBtn.addEventListener("click", async () => {
            const name = newCustomerInput.value.trim();
            if (!name) return;

            await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));

            choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
            choiceCustomer.setChoiceByValue(name);

            modalBG.style.display = "none";
        });

        /* default 3 rows */
        addLine();
        addLine();
        addLine();
    }

    /* ==========================
       ADD LINE FUNCTION
       ========================== */
    function addLine() {

    const idx = orderBody.children.length + 1;

    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td class="col-drag">⋮⋮</td>

        <td>
            <select class="product-select" name="product_${idx}"></select>
        </td>

        <td><input type="number" step="0.01" min="0" class="meter" name="meter_${idx}"></td>
        <td><input type="number" step="1" min="0" class="qty" name="qty_${idx}"></td>

        <td><input type="text" readonly class="unitPrice" data-value="" name="unitPrice_${idx}"></td>
        <td><input type="text" readonly class="ppq" data-value="" name="ppq_${idx}"></td>
        <td><input type="text" readonly class="totalPrice" data-value="" name="totalPrice_${idx}"></td>

        <td><button type="button" class="delete-btn">🗑</button></td>
    `;

    orderBody.appendChild(tr);

    /* Product dropdown */
    const select = tr.querySelector(".product-select");
    const choice = new Choices(select, { searchEnabled: true, shouldSort: false });

    choice.setChoices(
        productList.map(v => ({ value: v, label: v })),
        "value",
        "label",
        true
    );

    /* EVENT LISTENERS */
    select.addEventListener("change", () => updatePrice(tr));
    tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
    tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));

    tr.querySelector(".delete-btn").addEventListener("click", () => {
        tr.remove();
        calculateSummary();
    });
}

    /* ==========================
       GET PRICE FROM GSHEET
       ========================== */
    async function updatePrice(tr) {
        const product = tr.querySelector(".product-select").value;
        if (!product) return;

        const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
        const price = parseFloat(await res.text()) || 0;

        const unitPrice = tr.querySelector(".unitPrice");
        unitPrice.setAttribute("data-value", price);
        unitPrice.value = formatRupiah(price);

        calculateRow(tr);
    }

    /* ==========================
       CALCULATE PER ROW
       ========================== */
    function calculateRow(tr) {
        const meterInput = tr.querySelector(".meter");
        const qtyInput = tr.querySelector(".qty");

        let meter = parseFloat(meterInput.value) || 0;
        let qty = parseFloat(qtyInput.value) || 0;

        // ✅ JAGA SUPAYA TIDAK MINUS
        if (meter < 0) { meter = 0; meterInput.value = 0; }
        if (qty < 0) { qty = 0; qtyInput.value = 0; }

        const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

        const ppq = meter * price;
        const total = ppq * qty;

        tr.querySelector(".ppq").setAttribute("data-value", ppq);
        tr.querySelector(".ppq").value = formatRupiah(ppq);

        tr.querySelector(".totalPrice").setAttribute("data-value", total);
        tr.querySelector(".totalPrice").value = formatRupiah(total);

        calculateSummary();
    }

    /* ==========================
       CALCULATE SUMMARY
       ========================== */
    function calculateSummary() {

        let subtotal = 0;
        document.querySelectorAll(".totalPrice").forEach(el => {
            subtotal += parseFloat(el.getAttribute("data-value")) || 0;
        });

        const ppn = subtotal * 0.11;
        const grand = subtotal + ppn;

        document.getElementById("subTotal").value = formatRupiah(subtotal);
        document.getElementById("ppn").value = formatRupiah(ppn);
        document.getElementById("grandTotal").value = formatRupiah(grand);
    }

    /* ==========================
       ADD LINE BUTTON
       ========================== */
    document.getElementById("addLine").addEventListener("click", addLine);

    /* ==========================
       SUBMIT FORM
       ========================== */
    orderForm.addEventListener("submit", async e => {
        e.preventDefault();

        // validasi basic HTML5
        if (!orderForm.checkValidity()) {
            orderForm.reportValidity();
            return;
        }

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.innerText = "Sending...";

        // inject raw number value
        document.querySelectorAll("[data-value]").forEach(el => {
            el.value = el.getAttribute("data-value");
        });

        try {
            const res = await fetch(baseURL, {
                method: "POST",
                body: new FormData(orderForm)
            });

            const txt = await res.text();
            alert(txt);

            // Reset form
            orderForm.reset();
            orderBody.innerHTML = "";
            addLine();
            addLine();
            addLine();
            calculateSummary();
        } catch (err) {
            alert("Gagal mengirim order. Coba lagi.");
            console.error(err);
        }

        btn.disabled = false;
        btn.innerText = "Kirim Order";
    });

    /* ==========================
       INIT LOAD + SORTABLE
       ========================== */
    loadDropdowns();

    Sortable.create(orderBody, {
        handle: ".col-drag",
        animation: 150
    });
};
