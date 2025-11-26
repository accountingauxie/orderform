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

  /* ==========================
     LOAD DATA
  ========================== */
  async function loadDropdowns() {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    productList = data.products || [];

    // CUSTOMER DROPDOWN
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
        alert("Fitur tambah customer baru via modal bisa ditambah nanti 🙂");
      }
    });

    // default 3 rows
    addLine();
    addLine();
    addLine();
  }

  /* ==========================
     ADD LINE
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
      <td><input type="number" step="1"   min="0" class="qty"   name="qty_${idx}"></td>

      <td><input type="text" readonly class="unitPrice" data-value="" name="unitPrice_${idx}"></td>
      <td><input type="text" readonly class="ppq"       data-value="" name="ppq_${idx}"></td>

      <td><input type="number" step="1" min="0" class="discount" name="discount_${idx}" value="0"></td>

      <td><input type="text" readonly class="subtotal"   data-value="" name="subtotal_${idx}"></td>
      <td><input type="text" readonly class="tax"        data-value="" name="tax_${idx}"></td>
      <td><input type="text" readonly class="totalPrice" data-value="" name="totalPrice_${idx}"></td>

      <td><button type="button" class="delete-btn">🗑</button></td>
    `;

    orderBody.appendChild(tr);

    // Product dropdown
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
    tr.querySelector(".discount").addEventListener("input", () => calculateRow(tr));

    tr.querySelector(".delete-btn").addEventListener("click", () => {
      tr.remove();
      calculateSummary();
    });
  }

  /* ==========================
     GET PRICE
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
    const discInput = tr.querySelector(".discount");

    let meter = parseFloat(meterInput.value) || 0;
    let qty   = parseFloat(qtyInput.value)   || 0;
    let disc  = parseFloat(discInput.value)  || 0;

    if (meter < 0) meter = meterInput.value = 0;
    if (qty   < 0) qty   = qtyInput.value   = 0;
    if (disc  < 0) disc  = discInput.value  = 0;

    const price = parseFloat(tr.querySelector(".unitPrice").getAttribute("data-value")) || 0;

    // Price per Qty
    const ppq = meter * price;
    tr.querySelector(".ppq").setAttribute("data-value", ppq);
    tr.querySelector(".ppq").value = formatRupiah(ppq);

    // Subtotal per row (sebelum pajak, sesudah diskon)
    let subtotal = ppq * qty - disc;
    if (subtotal < 0) subtotal = 0;

    const tax = subtotal * 0.11;
    const total = subtotal + tax;

    const subEl = tr.querySelector(".subtotal");
    subEl.setAttribute("data-value", subtotal);
    subEl.value = formatRupiah(subtotal);

    const taxEl = tr.querySelector(".tax");
    taxEl.setAttribute("data-value", tax);
    taxEl.value = formatRupiah(tax);

    const totEl = tr.querySelector(".totalPrice");
    totEl.setAttribute("data-value", total);
    totEl.value = formatRupiah(total);

    calculateSummary();
  }

  /* ==========================
     CALCULATE SUMMARY
  ========================== */
  function calculateSummary() {

    let subtotal = 0;
    let tax = 0;
    let grand = 0;

    document.querySelectorAll(".subtotal").forEach(el => {
      subtotal += parseFloat(el.getAttribute("data-value")) || 0;
    });

    document.querySelectorAll(".tax").forEach(el => {
      tax += parseFloat(el.getAttribute("data-value")) || 0;
    });

    document.querySelectorAll(".totalPrice").forEach(el => {
      grand += parseFloat(el.getAttribute("data-value")) || 0;
    });

    document.getElementById("subTotal").value   = formatRupiah(subtotal);
    document.getElementById("ppn").value        = formatRupiah(tax);
    document.getElementById("grandTotal").value = formatRupiah(grand);
  }

  /* ==========================
     BUTTON ADD LINE
  ========================== */
  document.getElementById("addLine").addEventListener("click", addLine);

  /* ==========================
     SUBMIT FORM
  ========================== */
  orderForm.addEventListener("submit", async e => {
    e.preventDefault();

    if (!orderForm.checkValidity()) {
      orderForm.reportValidity();
      return;
    }

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerText = "Sending...";

    // ubah semua display (Rp ..) ke angka murni sebelum kirim
    document.querySelectorAll("[data-value]").forEach(el => {
      el.value = el.getAttribute("data-value") || 0;
    });

    try {
      const res = await fetch(baseURL, {
        method: "POST",
        body: new FormData(orderForm)
      });

      const txt = await res.text();
      alert(txt);

      orderForm.reset();
      orderBody.innerHTML = "";
      addLine(); addLine(); addLine();
      calculateSummary();

    } catch (err) {
      alert("Gagal mengirim order. Coba lagi.");
      console.error(err);
    }

    btn.disabled = false;
    btn.innerText = "Kirim Order";
  });

  /* ==========================
     INIT
  ========================== */
  loadDropdowns();

  Sortable.create(orderBody, {
    handle: ".col-drag",
    animation: 150
  });
};
