console.log("SCRIPT LOADED!");
window.onload = function () {

  const baseURL =
   "https://script.google.com/macros/s/AKfycbxVLp7NlU-giwsUvES8Lkq2wSeckGausQmG1xclkahzZwjk-qAjt3xwAPgCXBH2jZptww/exec";

  let productList = [];

  const orderForm = document.getElementById("orderForm");
  const orderBody = document.getElementById("orderBody");
  const addLineBtn = document.getElementById("addLine");

  // SET DEFAULT DATE
  const dateField = document.getElementById("date");
  dateField.value = new Date().toISOString().split("T")[0];

  function formatRupiah(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }

  // =============================
  // LOAD DROPDOWNS
  // =============================
  async function loadDropdowns() {
    const res = await fetch(baseURL + "?action=getdata");
    const data = await res.json();

    productList = data.products;

    const choiceCustomer = new Choices("#customer", { searchEnabled: true });
    choiceCustomer.setChoices(
      data.customers.map(v => ({ value: v, label: v })),
      "value",
      "label",
      true
    );

    // Add 3 rows default
    addLine();
    addLine();
    addLine();
  }

  // =============================
  // ADD ROW
  // =============================
  function addLine() {
    const idx = orderBody.children.length + 1;

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

    orderBody.appendChild(tr);

    // Apply Choices.js to product dropdown
    const select = tr.querySelector(".product-select");
    const choice = new Choices(select, { searchEnabled: true });
    choice.setChoices(
      productList.map(v => ({ value: v, label: v })),
      "value",
      "label",
      true
    );

    select.addEventListener("change", () => updatePrice(tr));
    tr.querySelector(".meter").addEventListener("input", () => calculateRow(tr));
    tr.querySelector(".qty").addEventListener("input", () => calculateRow(tr));

    // Delete button
    tr.querySelector(".delete-btn").addEventListener("click", () => {
      tr.remove();
      calculateSummary();
    });
  }

  // ✅ FIX PENTING: klik tombol + Add row
  addLineBtn.addEventListener("click", addLine);

  // =============================
  // GET PRICE FROM SERVER
  // =============================
  async function updatePrice(tr) {
    const product = tr.querySelector(".product-select").value;
    const unitInput = tr.querySelector(".unitPrice");

    if (!product) return;

    const res = await fetch(baseURL + "?action=getprice&product=" + encodeURIComponent(product));
    const price = parseFloat(await res.text()) || 0;

    unitInput.setAttribute("data-value", price);
    unitInput.value = formatRupiah(price);

    calculateRow(tr);
  }

  // =============================
  // CALCULATE ROW
  // =============================
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

  // =============================
  // SUMMARY
  // =============================
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

  // =============================
  // SUBMIT FORM
  // =============================
  orderForm.addEventListener("submit", async e => {
    e.preventDefault();

    const resultEl = document.getElementById("result");
    resultEl.textContent = "⏳ Mengirim order...";

    // convert formatted fields → raw number
    document.querySelectorAll("[data-value]").forEach(el => {
      el.value = el.getAttribute("data-value");
    });

    const res = await fetch(baseURL, {
      method: "POST",
      body: new FormData(orderForm)
    });

    const txt = await res.text();

    if (txt.includes("✅")) {
      resultEl.textContent = "✅ Order berhasil dikirim!";
      orderForm.reset();
      orderBody.innerHTML = "";
      dateField.value = new Date().toISOString().split("T")[0];
      addLine(); addLine(); addLine();
      calculateSummary();
    } else {
      resultEl.textContent = "❌ Error: " + txt;
    }
  });

  // DISABLE ENTER
  orderForm.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });

  // INIT
  loadDropdowns();

  // ✅ FIX: pakai orderBody yang sudah didefinisikan
  Sortable.create(orderBody, {
    handle: ".col-drag",
    animation: 150
  });

}; // END onload
