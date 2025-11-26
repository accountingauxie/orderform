window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbx5nIOngaL4vM4Z-uOZqnWOxRUGLB0Fs_F0mvGtHVimi9gwV1CAFBQhQoSh6Y6QSQs5/exec"; 
    // ganti dengan URL Web App GAS kamu

    let productList = [];
    let choiceCustomer;

    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    /* ==========================
       FORMAT RUPIAH
    ========================== */
    function rupiah(n) {
        return "Rp " + Number(n || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    /* ==========================
       GENERATE ORDER NUMBER
       Format: 1 + 6 digit → total 7 digit
    ========================== */
    function generateOrderNumber() {
        let last = localStorage.getItem("ORDERFORM_LAST_ORDER");
        if (!last) last = 1000000;

        let next = Number(last) + 1;
        localStorage.setItem("ORDERFORM_LAST_ORDER", next);

        return next;
    }

    document.getElementById("orderID").value = generateOrderNumber();


    /* ==========================
       LOAD PRODUCTS & CUSTOMERS
    ========================== */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        /* CUSTOMER DROPDOWN */
        choiceCustomer = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true,
        });

        const customerChoices = [
            ...(data.customers || []).map(v => ({ value: v, label: v })),
            { value: "__add__", label: "➕ Add Customer Baru" }
        ];

        choiceCustomer.setChoices(customerChoices, "value", "label", true);

        document.getElementById("customer").addEventListener("change", function () {
            if (this.value === "__add__") {
                const name = prompt("Nama customer baru:");
                if (!name) return;

                fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name))
                    .then(() => {
                        choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
                        choiceCustomer.setChoiceByValue(name);
                    });
            }
        });

        addRow();
    }


    /* ==========================
       ADD ROW
    ========================== */
    function addRow() {
        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="cursor:grab;">⋮⋮</td>

            <td>
                <select class="product" name="product_${idx}"></select>
            </td>

            <td><input type="number" step="0.01" class="meter" name="meter_${idx}"></td>
            <td><input type="number" step="1" class="qty" name="qty_${idx}"></td>

            <td><input type="text" class="unitPrice" name="unitPrice_${idx}" readonly></td>

            <td><input type="number" class="discountUnit" name="discount_${idx}" value="0"></td>

            <td><input type="text" class="ppq" name="ppq_${idx}" readonly></td>
            <td><input type="text" class="totalPrice" name="totalPrice_${idx}" readonly></td>

            <td><button type="button" class="delete-btn">✕</button></td>
        `;

        orderBody.appendChild(tr);

        /* PRODUCT DROPDOWN */
        const select = tr.querySelector(".product");
        const choice = new Choices(select, { searchEnabled: true, shouldSort: false });

        choice.setChoices(
            productList.map(v => ({ value: v, label: v })),
            "value",
            "label",
            true
        );

        select.addEventListener("change", () => loadPrice(tr));
        tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));
        tr.querySelector(".discountUnit").addEventListener("input", () => calculateRow(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calculateSummary();
        });
    }


    /* ==========================
       LOAD UNIT PRICE
    ========================== */
    async function loadPrice(tr) {
        const product = tr.querySelector(".product").value;
        if (!product) return;

        const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
        const price = Number(await res.text());

        const unit = tr.querySelector(".unitPrice");
        unit.setAttribute("data-value", price);
        unit.value = rupiah(price);

        calculateRow(tr);
    }


    /* ==========================
       CALCULATE PER ROW
    ========================== */
    function calculateRow(tr) {
        const meter = Number(tr.querySelector(".meter").value || 0);
        const qty = Number(tr.querySelector(".qty").value || 0);
        const unit = Number(tr.querySelector(".unitPrice").getAttribute("data-value") || 0);
        const discount = Number(tr.querySelector(".discountUnit").value || 0);

        const finalUnit = unit - discount;
        const ppq = meter * finalUnit;
        const total = ppq * qty;

        tr.querySelector(".ppq").value = rupiah(ppq);
        tr.querySelector(".ppq").setAttribute("data-value", ppq);

        tr.querySelector(".totalPrice").value = rupiah(total);
        tr.querySelector(".totalPrice").setAttribute("data-value", total);

        calculateSummary();
    }


    /* ==========================
       CALCULATE SUMMARY
    ========================== */
    function calculateSummary() {
        let total = 0;

        document.querySelectorAll(".totalPrice").forEach(el => {
            total += Number(el.getAttribute("data-value") || 0);
        });

        const dpp = total / 1.11;
        const ppn = total - dpp;

        document.getElementById("dpp").textContent = rupiah(dpp);
        document.getElementById("ppn").textContent = rupiah(ppn);
        document.getElementById("grandTotal").textContent = rupiah(total);
    }


    /* ==========================
       ADD ROW BUTTON
    ========================== */
    document.getElementById("addRow").addEventListener("click", addRow);


    /* ==========================
       SUBMIT FORM
    ========================== */
    orderForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.textContent = "Sending...";

        try {
            const res = await fetch(baseURL, {
                method: "POST",
                body: new FormData(orderForm)
            });

            const msg = await res.text();
            alert(msg);

            location.reload();

        } catch (err) {
            alert("Gagal mengirim order.");
            console.error(err);
        }

        btn.disabled = false;
        btn.textContent = "Kirim Order";
    });


    /* ==========================
       INIT
    ========================== */
    loadDropdowns();

    Sortable.create(orderBody, {
        handle: "td",
        animation: 150
    });
};
