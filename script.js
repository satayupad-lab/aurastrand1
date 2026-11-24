/* ==========================================================
   Aura Strand — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + ปุ่มกรอง mood
   - order.html   : เติมฟอร์มจาก URL + ส่งออเดอร์ไป Apps Script
   - admin.html   : แสดงออเดอร์จาก Google Sheet (CSV)
   ========================================================== */

var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWOoYBvCOeNjy0kGS5VYGcNOE0kAsE61hZbnOzUWfGXYLrWXjT8yhQoeMlXcDBddnq/exec";
var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNdBB7c0LrxCSRSmFqFp3mu8nIsizPJhtF7tFrpqfvYqlweAgYO63e1BFWVtberEgx8WH2OkVIhqxJ/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.getElementById("ordersTable")) initAdminPage();
});

/* ---------------------------------------------------------
   1) หน้า product.html
   --------------------------------------------------------- */
function initProductPage() {
  var filterBar = document.getElementById("filter-bar");
  var list = document.getElementById("product-list");
  var products = [];
  var currentMood = "all";

  fetch("products.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;

      // อ่าน ?mood=xxx (ไม่สนตัวพิมพ์เล็ก/ใหญ่) ถ้าตรงกับ mood ที่มีอยู่ให้กรองอัตโนมัติ
      var param = (new URLSearchParams(window.location.search).get("mood") || "").toLowerCase();
      var match = products.filter(function (p) { return p.mood.toLowerCase() === param; })[0];
      if (match) currentMood = match.mood;

      renderFilters();
      renderProducts();
    })
    .catch(function (err) {
      console.error(err);
      list.textContent = "ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง";
    });

  // สร้างปุ่มกรองจาก mood ที่มีใน products.json (ทั้งหมด + Beauty + Strong ...)
  function renderFilters() {
    if (!filterBar) return;
    var moods = [];
    products.forEach(function (p) {
      if (moods.indexOf(p.mood) === -1) moods.push(p.mood);
    });

    filterBar.innerHTML = "";
    addButton("all", "ทั้งหมด");
    moods.forEach(function (m) { addButton(m, m); });

    function addButton(value, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (value === currentMood ? " btn--accent" : "");
      b.textContent = label;
      b.addEventListener("click", function () {
        currentMood = value;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(b);
    }
  }

  function renderProducts() {
    list.innerHTML = "";
    var shown = products.filter(function (p) {
      return currentMood === "all" || p.mood === currentMood;
    });

    shown.forEach(function (p) {
      var fullName = p.name + " " + p.size;
      var card = el("div", "product-card");

      var imgWrap = el("div", "product-card__img");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = fullName;
      img.loading = "lazy";
      imgWrap.appendChild(img);

      var body = el("div", "product-card__body");

      var mood = el("div", "product-card__mood");
      var dot = el("span", "mood-dot mood-dot--" + p.mood.toLowerCase());
      mood.appendChild(dot);
      mood.appendChild(document.createTextNode(p.mood));

      var name = el("h3", "product-card__name", p.name);
      var size = el("div", "product-card__size", p.size);
      var desc = el("p", "product-card__desc", p.description);
      var price = el("div", "product-card__price", Number(p.price).toLocaleString("th-TH") + " บาท");

      var btn = el("a", "btn btn--block", "สั่งซื้อ");
      btn.href = "order.html?item=" + encodeURIComponent(fullName) + "&price=" + encodeURIComponent(p.price);

      [mood, name, size, desc, price, btn].forEach(function (n) { body.appendChild(n); });
      card.appendChild(imgWrap);
      card.appendChild(body);
      list.appendChild(card);
    });
  }
}

/* ---------------------------------------------------------
   2) หน้า order.html
   --------------------------------------------------------- */
function initOrderPage() {
  var form = document.getElementById("orderForm");
  var params = new URLSearchParams(window.location.search);

  // เติมทั้งชื่อสินค้า (#items) และราคา (#total) ทันทีที่โหลดหน้า
  var itemsInput = document.getElementById("items");
  var totalInput = document.getElementById("total");
  if (itemsInput && params.get("item") !== null) itemsInput.value = params.get("item");
  if (totalInput && params.get("price") !== null) totalInput.value = params.get("price");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var payload = {
      customerName: document.getElementById("customerName").value,
      contact: document.getElementById("contact").value,
      items: document.getElementById("items").value,
      total: document.getElementById("total").value,
      note: document.getElementById("note").value
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ---------------------------------------------------------
   3) หน้า admin.html
   --------------------------------------------------------- */
function initAdminPage() {
  var tbody = document.querySelector("#ordersTable tbody");
  tbody.innerHTML = "";
  tbody.appendChild(messageRow("กำลังโหลดข้อมูล..."));

  // ต่อ timestamp ท้าย URL เพื่อลดปัญหา cache
  fetch(SHEET_CSV_URL + "&_=" + Date.now())
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text).filter(function (r) {
        return r.some(function (c) { return c.trim() !== ""; });
      });

      // ถ้าแถวแรกเป็นหัวตาราง (คอลัมน์ A ไม่ใช่วันที่) ให้ข้าม
      if (rows.length && isNaN(Date.parse(rows[0][0]))) rows.shift();

      // ข้อมูลถูก appendRow ต่อท้ายตามเวลา จึงกลับลำดับให้ล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.innerHTML = "";
      if (!rows.length) {
        tbody.appendChild(messageRow("ยังไม่มีรายการสั่งซื้อ"));
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        for (var i = 0; i < 6; i++) {
          var td = document.createElement("td");
          td.textContent = r[i] !== undefined ? r[i] : "";
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (err) {
      console.error(err);
      tbody.innerHTML = "";
      tbody.appendChild(messageRow("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง"));
    });

  function messageRow(msg) {
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = msg;
    tr.appendChild(td);
    return tr;
  }
}

/* parse CSV เอง: รองรับค่าในเครื่องหมายคำพูด, comma และขึ้นบรรทัดใหม่ในช่อง, "" แทน " */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* helper สร้าง element */
function el(tag, className, text) {
  var n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}
