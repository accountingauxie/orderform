window.onload = function () {

  const baseURL =
   "https://script.google.com/macros/s/AKfycbxVLp7NlU-giwsUvES8Lkq2wSeckGausQmG1xclkahzZwjk-qAjt3xwAPgCXBH2jZptww/exec";  // ← WAJIB GANTI

  let productList = [];
  let choiceCustomer;

  const modalBG = document.getElementById("modal-bg");
  const newCustomerInput = document.getElementById("newCustomerName");
  const saveCustomerBtn = document.getElementById("saveCustomerBtn");

  document.getElementById("date").value = new Date().toISOString().split("T")[0];

  function formatRupiah(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }

  async function loadDropdowns() {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    productList = data.products;

    /* CUSTOMER DROPDOWN */
    choiceCustomer = new Choices("#customer", { 
        searchEnabled: true,
        shouldSort: false,
        placeholder: true
    });

    choiceCustomer.setChoices(
      [
        ...data.customers.map(v => ({ value: v, label: v })),
        { value: "__add__", label: "➕ Add New Customer" }
      ],
      "value", "label", true
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

      // KIRIM KE APPS SCRIPT
      await fetch(baseURL + "?action=addcustomer&name=" + encodeURIComponent(name));

      // TAMBAH KE DROPDOWN
      choiceCustomer.setChoices([{ value: name, label: name }], "value", "label", false);
      choiceCustomer.setChoiceByValue(name);

      modalBG.style.display = "none";
    });

    // Auto add 3 rows
    addLine();
    addLine();
    addLine();
  }

  /* =====================================
     ADD LINE
  ===================================== */
  function addLine() {
    const tbody = document.getElementById("orderBody");
    const idx = tbody.children.length + 1;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-drag">⋮⋮</td>

      <td><select class="product-select" name="product_${idx}"></select></td>
      <td><input type="number" step="0.01" class="meter" name="meter_${idx}"></td>
      <td><input type="number" step="1" class="qty" name="qty_${idx}"></td>

      <td><input type="text" readonly class="unitPrice" name="unit_${idx}" data-value=""></td>
      <td><input type="text" readonly class="ppq" name="ppq_${idx}" data-value=""></td>
      <td><input type="text" readonly class="totalPrice" name="total_${idx}" data-value=""></td>

      <td><button type="button" class="delete-btn">🗑</button></td>
    `;

    tbody.appendChild(tr);

    /* Product dropdown */
    const select = tr.querySelector(".product-select");
    const choice = new Choices(select, { searchEnabled: true });

    choice.setChoices(
      productList.map(v => ({ value: v, label: v })),
      "value", "label", true
    );

    select.addEventListener("change", () => updatePrice(tr));
    tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
    tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));

    tr.querySelector(".delete-btn").addEventListener("click", () => {
      tr.remove();
      calculateSummary();
    });
  }

  /* =====================================
     PRICE LOOKUP
  ===================================== */
  async function updatePrice(tr) {
    const product = tr.querySelector(".product-select").value;
    if (!product) return;

    const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
    const price = parseFloat(await res.text()) || 0;

    tr.querySelector(".unitPrice").setAttribute("data-value", price);
    tr.querySelector(".unitPrice").value = formatRupiah(price);

    calculateRow(tr);
  }

  /* =====================================
     CALCULATE ROW
  ===================================== */
  function calculateRow(tr) {
    const meter = parseFloat(tr.querySelector(".meter").value) || 0;
    const qty = parseFloat(tr.querySelector(".qty").value) || 0;
    const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

    const ppq = meter * price;
    const total = ppq * qty;

    tr.querySelector(".ppq").setAttribute("data-value", ppq);
    tr.querySelector(".ppq").value = formatRupiah(ppq);

    tr.querySelector(".totalPrice").setAttribute("data-value", total);
    tr.querySelector(".totalPrice").value = formatRupiah(total);

    calculateSummary();
  }

  /* =====================================
     SUMMARY
  ===================================== */
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

  /* =====================================
     ADD LINE BTN
  ===================================== */
  document.getElementById("addLine").addEventListener("click", addLine);


  /* =====================================
     SUBMIT
  ===================================== */
  document.getElementById("orderForm").addEventListener("submit", async e => {
    e.preventDefault();

    // RAW number 
    document.querySelectorAll("[data-value]").forEach(el => {
      el.value = el.getAttribute("data-value");
    });

    const res = await fetch(baseURL, {
      method: "POST",
      body: new FormData(orderForm)
    });

    const txt = await res.text();
    alert(txt);
  });

  loadDropdowns();

  Sortable.create(orderBody, {
    handle: ".col-drag",
    animation: 150
  });

};
