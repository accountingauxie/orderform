window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbw8105MSJQsOG0PyNQAQviOec1OZN_7_B-8fbNdGcjfsLe6sYbn5n9cpjF9OS2gGVsE/exec";
    let productList = [];
    let customerChoice;

    const orderForm = document.getElementById("orderForm");
    const orderBody = document.getElementById("orderBody");

    // set default tanggal hari ini
    document.getElementById("date").value = new Date().toISOString().split("T")[0];

    function formatRupiah(num) {
        return "Rp " + Number(num || 0).toLocaleString("id-ID", {
            maximumFractionDigits: 0
        });
    }

    function formatXeroNumber(num) {
        const n = Number(num || 0);
        return n.toLocaleString("en-NZ", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /* ============================================================
       AUTO INVOICE NUMBER INVYYMMXXXX
       - Jika backend kirim data.nextInv → pakai itu
       - Kalau tidak, pakai localStorage dan reset tiap bulan
    ============================================================ */
    function generateLocalInvoiceNumber() {
        const now = new Date();
        const yy = String(now.getFullYear() % 100).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const prefix = `INV${yy}${mm}`;

        const key = "ORDERFORM_LAST_INV";
        const saved = localStorage.getItem(key);

        let counter = 1;
        if (saved && saved.startsWith(prefix)) {
            const lastNum = parseInt(saved.slice(prefix.length), 10);
            if (!isNaN(lastNum)) counter = lastNum + 1;
        }

        const inv = prefix + String(counter).padStart(4, "0");
        localStorage.setItem(key, inv);
        return inv;
    }

    function setInvoiceNumber(nextInvFromServer) {
        let inv;
        if (nextInvFromServer && /^INV\d{4}\d{4}$/.test(nextInvFromServer)) {
            inv = nextInvFromServer;
        } else {
            inv = generateLocalInvoiceNumber();
        }
        document.getElementById("invnum").value = inv;
    }

    /* ============================================================
       LOAD DATA (customers, products, optional nextInv)
    ============================================================ */
    async function loadDropdowns() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products || [];

        // CUSTOMER DROPDOWN
        customerChoice = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true,
            itemSelectText: ""
        });

        customerChoice.setChoices(
            (data.customers || []).map(v => ({ value: v, label: v })),
            "value",
            "label",
            true
        );

        // Set Invoice Number
        setInvoiceNumber(data.nextInv);

        // Default 3 rows
        addLine();
        addLine();
        addLine();
    }

    /* ============================================================
       ADD ROW
    ============================================================ */
    function addLine() {

        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="col-drag">⋮⋮</td>

            <td>
                <select class="product-select" name="product_${idx}"></select>
            </td>

            <td><input type="number" class="meter" min="0" step="0.01" name="meter_${idx}"></td>
            <td><input type="number" class="qty" min="0" step="1" name="qty_${idx}"></td>

            <td><input type="text" class="unitPrice" data-value="" name="unitPrice_${idx}" readonly></td>
            <td><input type="text" class="ppq" data-value="" name="ppq_${idx}" readonly></td>

            <td><input type="number" class="disc" min="0" step="1" value="0" name="disc_${idx}"></td>

            <td><input type="text" class="totalPrice" data-value="" name="total_${idx}" readonly></td>

            <td><button type="button" class="delete-btn">🗑</button></td>
        `;

        orderBody.appendChild(tr);

        /* PRODUCT DROPDOWN */
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
        tr.querySelector(".disc").addEventListener("input", () => calculateRow(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calculateSummary();
        });
    }

    /* ============================================================
       GET PRICE
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
       CALCULATE ROW (discount per Qty)
       - Unit price already includes 11% tax
       - TotalRow = (meter * price * qty) - (discountPerQty * qty)
    ============================================================ */
    function calculateRow(tr) {
        const meter = parseFloat(tr.querySelector(".meter").value) || 0;
        const qty = parseFloat(tr.querySelector(".qty").value) || 0;
        const discPerQty = parseFloat(tr.querySelector(".disc").value) || 0;
        const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

        const ppq = meter * price;               // harga per qty (meter × unit price)
        const gross = ppq * qty;                 // total sebelum diskon
        const discTotal = discPerQty * qty;      // diskon total
        const total = gross - discTotal;         // total akhir (tax incl)

        const ppqInput = tr.querySelector(".ppq");
        ppqInput.setAttribute("data-value", ppq);
        ppqInput.value = formatRupiah(ppq);

        const totalInput = tr.querySelector(".totalPrice");
        totalInput.setAttribute("data-value", total);
        totalInput.value = formatRupiah(total);

        calculateSummary();
    }

    /* ============================================================
       SUMMARY (DPP / PPN / GRAND TOTAL)
    ============================================================ */
    function calculateSummary() {
        let grandTotal = 0;

        document.querySelectorAll(".totalPrice").forEach(el => {
            grandTotal += parseFloat(el.getAttribute("data-value")) || 0;
        });

        const dpp = grandTotal / 1.11;
        const ppn = grandTotal - dpp;

        document.getElementById("grandVal").textContent = formatXeroNumber(grandTotal);
        document.getElementById("dppVal").textContent = formatXeroNumber(dpp);
        document.getElementById("ppnVal").textContent = formatXeroNumber(ppn);
    }

    /* ============================================================
       BUTTON ADD ROW
    ============================================================ */
    document.getElementById("addLine").addEventListener("click", addLine);

    /* ============================================================
       FORM SUBMIT + VALIDATION
    ============================================================ */
    orderForm.addEventListener("submit", async e => {
        e.preventDefault();

        const cust = document.getElementById("customer").value;
        if (!cust) {
            alert("Customer wajib diisi.");
            return;
        }

        // minimal 1 baris punya produk
        let validRow = false;
        document.querySelectorAll(".product-select").forEach(sel => {
            if (sel.value) validRow = true;
        });
        if (!validRow) {
            alert("Minimal 1 item harus diisi.");
            return;
        }

        // convert field yang punya data-value agar dikirim angka murni
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

            // set inv baru
            setInvoiceNumber();

            addLine(); addLine(); addLine();
            calculateSummary();
        } catch (err) {
            alert("Gagal mengirim order. Coba lagi.");
            console.error(err);
        }

        btn.disabled = false;
        btn.textContent = "Kirim Order";
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
