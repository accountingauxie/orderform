/* ============================================================
   XERO ULTRA MODERN ORDER FORM — FINAL VERSION (NO ERROR)
   Fully compatible with your new index.html layout
============================================================ */

window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";

    let productList = [];
    let choiceCustomer;

    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    function formatRupiah(num) {
        return "Rp " + Number(num || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    /* ============================================================
       LOAD PRODUCTS + CUSTOMERS
    ============================================================ */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        // ====== CUSTOMER CHOICES ======
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
            "value", "label", true
        );

        document.getElementById("customer").addEventListener("change", function () {
            if (this.value === "__add__") {
                alert("Silakan tambahkan fitur modal customer baru (opsional)");
            }
        });

        // default 3 rows
        addLine();
        addLine();
        addLine();
    }

    /* ============================================================
       ADD LINE
    ============================================================ */
    function addLine() {
        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="col-drag">⋮⋮</td>

            <td>
                <select class="product-select" name="product_${idx}"></select>
            </td>

            <td><input type="number" step="0.01" min="0" class="meter"></td>

            <td><input type="number" step="1" min="0" class="qty"></td>

            <!-- Unit Price -->
            <td><input type="text" class="unitPrice" data-value="" readonly></td>

            <!-- Price per Qty -->
            <td><input type="text" class="ppq" data-value="" readonly></td>

            <!-- Discount -->
            <td><input type="number" min="0" step="1" class="discount" value="0"></td>

            <!-- Subtotal -->
            <td><input type="text" class="subtotal" data-value="" readonly></td>

            <!-- Tax -->
            <td><input type="text" class="tax" data-value="" readonly></td>

            <td><button type="button" class="delete-btn">🗑</button></td>
        `;

        orderBody.appendChild(tr);

        /* PRODUCT DROPDOWN */
        const select = tr.querySelector(".product-select");
        const choice = new Choices(select, { searchEnabled: true, shouldSort: false });

        choice.setChoices(
            productList.map(v => ({ value: v, label: v })),
            "value", "label", true
        );

        select.addEventListener("change", () => updatePrice(tr));

        tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".discount").addEventListener("input", () => calculateRow(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calculateSummary();
        });
    }

    /* ============================================================
       GET PRICE FROM SERVER
    ============================================================ */
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

    /* ============================================================
       CALCULATE PER ROW
    ============================================================ */
    function calculateRow(tr) {
        let meter = parseFloat(tr.querySelector(".meter").value) || 0;
        let qty = parseFloat(tr.querySelector(".qty").value) || 0;
        let discount = parseFloat(tr.querySelector(".discount").value) || 0;

        const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

        // Price per Qty
        const ppq = meter * price;
        tr.querySelector(".ppq").setAttribute("data-value", ppq);
        tr.querySelector(".ppq").value = formatRupiah(ppq);

        // Subtotal sebelum ppn
        let subtotal = (ppq * qty) - discount;
        if (subtotal < 0) subtotal = 0;

        tr.querySelector(".subtotal").setAttribute("data-value", subtotal);
        tr.querySelector(".subtotal").value = formatRupiah(subtotal);

        // PPN 11%
        const tax = subtotal * 0.11;
        tr.querySelector(".tax").setAttribute("data-value", tax);
        tr.querySelector(".tax").value = formatRupiah(tax);

        calculateSummary();
    }

    /* ============================================================
       CALCULATE SUMMARY
    ============================================================ */
    function calculateSummary() {
        let subtotal = 0;
        let tax = 0;

        document.querySelectorAll(".subtotal").forEach(el => {
            subtotal += parseFloat(el.getAttribute("data-value")) || 0;
        });

        document.querySelectorAll(".tax").forEach(el => {
            tax += parseFloat(el.getAttribute("data-value")) || 0;
        });

        const grand = subtotal + tax;

        document.getElementById("subTotal").value = formatRupiah(subtotal);
        document.getElementById("ppn").value = formatRupiah(tax);
        document.getElementById("grandTotal").value = formatRupiah(grand);
    }

    /* ============================================================
       ADD ROW BUTTON
    ============================================================ */
    document.getElementById("addLine").addEventListener("click", addLine);

    /* ============================================================
       SUBMIT FORM
    ============================================================ */
    orderForm.addEventListener("submit", async e => {
        e.preventDefault();

        // Validasi
        if (!orderForm.checkValidity()) {
            orderForm.reportValidity();
            return;
        }

        const submitBtn = document.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";

        // Convert displayed values to raw number
        document.querySelectorAll("[data-value]").forEach(el => {
            el.value = el.getAttribute("data-value");
        });

        try {
            const res = await fetch(baseURL, {
                method: "POST",
                body: new FormData(orderForm)
            });

            alert(await res.text());

            // reset form
            orderForm.reset();
            orderBody.innerHTML = "";
            addLine(); addLine(); addLine();
            calculateSummary();

        } catch (err) {
            alert("Gagal mengirim order.");
            console.error(err);
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Kirim Order";
    });

    /* ============================================================
       INIT
    ============================================================ */
    loadDropdowns();

    Sortable.create(orderBody, {
        handle: ".col-drag",
        animation: 150
    });
};
