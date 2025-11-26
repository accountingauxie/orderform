window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";
    let productList = [];
    let customerChoice;

    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    function formatRupiah(num) {
        return "Rp " + Number(num || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    /* ================================================
       LOAD DATA
    ================================================= */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        customerChoice = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true
        });

        customerChoice.setChoices(
            data.customers.map(v => ({ value: v, label: v })),
            "value",
            "label",
            true
        );

        addLine();
        addLine();
        addLine();
    }

    /* ================================================
       ADD ROW
    ================================================= */
    function addLine() {

        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="col-drag">⋮⋮</td>

            <td><select class="product-select" name="product_${idx}"></select></td>

            <td><input type="number" class="meter" min="0" step="0.01"></td>
            <td><input type="number" class="qty" min="0" step="1"></td>

            <td><input type="text" class="unitPrice" data-value="" readonly></td>
            <td><input type="text" class="ppq" data-value="" readonly></td>

            <td><input type="number" class="disc" min="0" step="1" value="0"></td>

            <td><input type="text" class="subtotal" data-value="" readonly></td>
            <td><input type="text" class="tax" data-value="" readonly></td>
            <td><input type="text" class="totalPrice" data-value="" readonly></td>

            <td><button type="button" class="delete-btn">🗑</button></td>
        `;

        orderBody.appendChild(tr);

        /* PRODUCT DROPDOWN */
        const select = tr.querySelector(".product-select");
        const choice = new Choices(select, {
            searchEnabled: true,
            shouldSort: false
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
        tr.querySelector(".disc").addEventListener("input", () => calculateRow(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calculateSummary();
        });
    }

    /* ================================================
       GET PRICE
    ================================================= */
    async function updatePrice(tr) {
        const product = tr.querySelector(".product-select").value;
        if (!product) return;

        const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
        const price = parseFloat(await res.text()) || 0;

        tr.querySelector(".unitPrice").setAttribute("data-value", price);
        tr.querySelector(".unitPrice").value = formatRupiah(price);

        calculateRow(tr);
    }

    /* ================================================
       CALCULATE ROW
    ================================================= */
    function calculateRow(tr) {
        const meter = parseFloat(tr.querySelector(".meter").value) || 0;
        const qty = parseFloat(tr.querySelector(".qty").value) || 0;
        const disc = parseFloat(tr.querySelector(".disc").value) || 0;

        const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

        const ppq = meter * price;
        const subtotal = (ppq * qty) - disc;
        const tax = subtotal * 0.11;
        const total = subtotal + tax;

        tr.querySelector(".ppq").value = formatRupiah(ppq);
        tr.querySelector(".ppq").setAttribute("data-value", ppq);

        tr.querySelector(".subtotal").value = formatRupiah(subtotal);
        tr.querySelector(".subtotal").setAttribute("data-value", subtotal);

        tr.querySelector(".tax").value = formatRupiah(tax);
        tr.querySelector(".tax").setAttribute("data-value", tax);

        tr.querySelector(".totalPrice").value = formatRupiah(total);
        tr.querySelector(".totalPrice").setAttribute("data-value", total);

        calculateSummary();
    }

    /* ================================================
       SUMMARY
    ================================================= */
    function calculateSummary() {
        let subtotal = 0;

        document.querySelectorAll(".subtotal").forEach(el => {
            subtotal += parseFloat(el.getAttribute("data-value")) || 0;
        });

        const ppn = subtotal * 0.11;
        const grand = subtotal + ppn;

        document.getElementById("subTotal").value = formatRupiah(subtotal);
        document.getElementById("ppn").value = formatRupiah(ppn);
        document.getElementById("grandTotal").value = formatRupiah(grand);
    }

    document.getElementById("addLine").addEventListener("click", addLine);

    /* ================================================
       FORM SUBMIT
    ================================================= */
    orderForm.addEventListener("submit", async e => {
        e.preventDefault();

        const cust = document.getElementById("customer").value;
        if (!cust) {
            alert("Customer wajib diisi.");
            return;
        }

        let validRow = false;
        document.querySelectorAll(".product-select").forEach(s => {
            if (s.value) validRow = true;
        });

        if (!validRow) {
            alert("Minimal 1 item harus diisi.");
            return;
        }

        document.querySelectorAll("[data-value]").forEach(el => {
            el.value = el.getAttribute("data-value");
        });

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const res = await fetch(baseURL, {
                method: "POST",
                body: new FormData(orderForm)
            });

            alert(await res.text());

            orderForm.reset();
            orderBody.innerHTML = "";
            addLine(); addLine(); addLine();
            calculateSummary();

        } catch (err) {
            alert("Gagal mengirim order.");
            console.error(err);
        }

        btn.disabled = false;
        btn.innerText = "Kirim Order";
    });

    /* ================================================
       INIT
    ================================================= */
    loadDropdowns();

    Sortable.create(orderBody, {
        handle: ".col-drag",
        animation: 150
    });

};
