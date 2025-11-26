window.onload = function () {

    const baseURL = "https://script.google.com/macros/s/AKfycbxVLp7NlU-giwsUvES8Lkq2wSeckGausQmG1xclkahzZwjk-qAjt3xwAPgCXBH2jZptww/exec";

    let productList = [];
    let customerList = [];
    let choiceCustomer;

    const orderBody = document.getElementById("orderBody");

    /* ============= FORMAT RUPIAH ============= */
    function rupiah(x) {
        return "Rp " + Number(x || 0).toLocaleString("id-ID");
    }

    /* ============= LOAD DROPDOWN ============= */
    async function loadData() {
        const res = await fetch(baseURL + "?action=getdata");
        const data = await res.json();

        productList = data.products;
        customerList = data.customers;

        choiceCustomer = new Choices("#customer", {
            searchEnabled: true,
            shouldSort: false,
            placeholder: true
        });

        const custChoices = customerList.map(c => ({ value: c, label: c }));
        custChoices.unshift({ value: "__add__", label: "➕ Tambah Customer" });

        choiceCustomer.setChoices(custChoices, "value", "label", true);

        document.getElementById("customer").addEventListener("change", (e) => {
            if (e.target.value === "__add__") {
                document.getElementById("modal-bg").style.display = "flex";
            }
        });

        addRow();
    }

    /* ============= ADD CUSTOMER ============= */
    document.getElementById("saveCustomer").addEventListener("click", async () => {
        const name = document.getElementById("newCustomer").value.trim();
        if (!name) return;

        await fetch(baseURL + "?action=addCustomer&name=" + encodeURIComponent(name));
        choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
        choiceCustomer.setChoiceByValue(name);

        document.getElementById("modal-bg").style.display = "none";
    });

    /* ============= ADD ROW ============= */
    function addRow() {
        const idx = orderBody.children.length + 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="drag">⋮⋮</td>
            <td><select name="product_${idx}" class="productSel"></select></td>
            <td><input name="meter_${idx}" type="number" step="0.01"></td>
            <td><input name="qty_${idx}" type="number" step="1"></td>
            <td><input name="unitPrice_${idx}" type="text" class="unitPrice" readonly data-value="0"></td>
            <td><input name="discount_${idx}" class="discountUnit" type="number" step="1"></td>
            <td><input name="ppq_${idx}" type="text" class="ppq" readonly data-value="0"></td>
            <td><input name="totalPrice_${idx}" type="text" class="totalPrice" readonly data-value="0"></td>
            <td><button class="delete-btn">✖</button></td>
        `;

        orderBody.appendChild(tr);

        const select = tr.querySelector(".productSel");
        const choice = new Choices(select, { searchEnabled: true, shouldSort: false });

        const items = productList.map(p => ({ value: p, label: p }));
        choice.setChoices(items, "value", "label", true);

        select.addEventListener("change", () => updatePrice(tr));
        tr.querySelector(`input[name="meter_${idx}"]`).addEventListener("input", () => calc(tr));
        tr.querySelector(`input[name="qty_${idx}"]`).addEventListener("input", () => calc(tr));
        tr.querySelector(`input[name="discount_${idx}"]`).addEventListener("input", () => calc(tr));

        tr.querySelector(".delete-btn").addEventListener("click", () => {
            tr.remove();
            calcSummary();
        });
    }

    document.getElementById("addRow").addEventListener("click", addRow);

    /* ============= GET PRICE ============= */
    async function updatePrice(tr) {
        const product = tr.querySelector(".productSel").value;
        if (!product) return;

        const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
        const price = Number(await res.text());

        tr.querySelector(".unitPrice").setAttribute("data-value", price);
        tr.querySelector(".unitPrice").value = rupiah(price);

        calc(tr);
    }

    /* ============= CALC ROW ============= */
    function calc(tr) {
        let meter = parseFloat(tr.querySelector("[name^='meter']").value) || 0;
        let qty = parseFloat(tr.querySelector("[name^='qty']").value) || 0;
        let price = Number(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;
        let disc = Number(tr.querySelector(".discountUnit").value) || 0;

        let priceQty = meter * (price - disc);
        let total = priceQty * qty;

        tr.querySelector(".ppq").setAttribute("data-value", priceQty);
        tr.querySelector(".ppq").value = rupiah(priceQty);

        tr.querySelector(".totalPrice").setAttribute("data-value", total);
        tr.querySelector(".totalPrice").value = rupiah(total);

        calcSummary();
    }

    /* ============= CALC SUMMARY ============= */
    function calcSummary() {
        let grand = 0;

        document.querySelectorAll(".totalPrice").forEach(el => {
            grand += Number(el.getAttribute("data-value")) || 0;
        });

        let dpp = grand / 1.11;
        let ppn = grand - dpp;

        document.getElementById("dpp").textContent = rupiah(Math.round(dpp));
        document.getElementById("ppn").textContent = rupiah(Math.round(ppn));
        document.getElementById("grand").textContent = rupiah(Math.round(grand));
    }

    /* ============= SUBMIT ============= */
    document.getElementById("orderForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.textContent = "Sending...";

        document.querySelectorAll("[data-value]").forEach(el => {
            el.value = el.getAttribute("data-value");
        });

        const result = await fetch(baseURL, {
            method: "POST",
            body: new FormData(orderForm)
        });

        alert(await result.text());
        btn.disabled = false;
        btn.textContent = "Kirim Order";
        location.reload();
    });

    loadData();
};
