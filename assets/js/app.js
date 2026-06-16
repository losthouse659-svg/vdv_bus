const TARGET_URL = "https://mapavdv.kr-vysocina.cz/Ajax/GetPoints";
const REFRESH_MS = 15000;

document.addEventListener("DOMContentLoaded", () => {
  const statusText = document.getElementById("statusText");
  const statusDot  = document.getElementById("statusDot");
  const refreshBtn = document.getElementById("refreshBtn");
  const sideList   = document.getElementById("sideList");
  const sidePanel  = document.getElementById("sidePanel");
  const sideClose  = document.getElementById("sideClose");
  const detailPanel= document.getElementById("detailPanel");
  const detailBody = document.getElementById("detailBody");
  const detailClose= document.getElementById("detailClose");

  // --- MAPA ---
  const map = L.map("map", { zoomControl: true }).setView([49.394, 15.591], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "\u00a9 OpenStreetMap contributors",
  }).addTo(map);
  const markersLayer = L.layerGroup().addTo(map);

  // --- IKONY ---
  function makeIcon(type, isEarly) {
    const emoji = type === "train" ? "\ud83d\ude82" : "\ud83d\ude8c";
    const bg    = isEarly ? "#facc15" : (type === "train" ? "#a78bfa" : "#0ea5e9");
    const html  = `<div style="background:${bg};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.3)">${emoji}</div>`;
    return L.divIcon({ html, className: "", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18] });
  }

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusDot.style.background  = isError ? "#f97373" : "#36d399";
    statusDot.style.boxShadow   = isError ? "0 0 18px #f97373" : "0 0 18px #36d399";
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  function parsePoints(raw) {
    let items = raw;
    if (raw && typeof raw.contents === "string") {
      try { items = JSON.parse(raw.contents); } catch { return []; }
    }
    if (!Array.isArray(items)) return [];
    return items
      .filter(i => i.lat != null && i.lng != null)
      .map(i => ({
        lat:   parseFloat(i.lat),
        lng:   parseFloat(i.lng),
        line:  String(i.text ?? "?").trim(),
        dest:  String(i.finalStopName ?? "").trim(),
        delay: Number(i.delay ?? 0),
        type:  String(i.vehicleType ?? "bus").toLowerCase().includes("train") ? "train" : "bus",
      }))
      .filter(p => isFinite(p.lat) && isFinite(p.lng));
  }

  async function fetchData() {
    const ts     = Date.now();
    const target = TARGET_URL + "?t=" + ts;

    try {
      if (window.puter) {
        const res = await puter.net.fetch(target);
        if (res.ok) return await res.json();
      }
    } catch(e) { console.warn("puter fail", e); }

    try {
      const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(target), { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch(e) { console.warn("allorigins fail", e); }

    try {
      const res = await fetch("https://api.cors.lol/?url=" + encodeURIComponent(target), { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch(e) { console.warn("cors.lol fail", e); }

    try {
      const res = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target), { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch(e) { console.warn("codetabs fail", e); }

    throw new Error("Vsechny proxy selhaly");
  }

  // --- JIZDNI RAD pres IDOS widget ---
  function showSchedule(point) {
    const lineName = encodeURIComponent(point.line);
    const dest     = encodeURIComponent(point.dest);
    detailBody.innerHTML = `
      <div class="detail-info">
        <div class="detail-badge ${point.type}">${point.type === "train" ? "\ud83d\ude82 Vlak" : "\ud83d\ude8c Autobus"}</div>
        <h3>Linka ${escapeHtml(point.line)}</h3>
        <p>\u0160m\u011br: <strong>${escapeHtml(point.dest)}</strong></p>
        <p>Aktu\u00e1ln\u00ed zpo\u017ed\u011bn\u00ed: <strong class="delay-${point.delay > 5 ? "high" : point.delay < -2 ? "early" : "ok"}">${point.delay > 0 ? "+"+point.delay : point.delay} min</strong></p>
      </div>
      <div class="schedule-section">
        <h4>\ud83d\udcc5 J\u00edzdn\u00ed \u0159\u00e1d</h4>
        <p class="schedule-hint">Naj\u00edt j\u00edzdn\u00ed \u0159\u00e1d na IDOS:</p>
        <a class="idos-btn" href="https://idos.cz/jizdnirady/spojeni/?f=&t=${dest}&date=&time=" target="_blank">\ud83d\udd17 Otev\u0159\u00edt IDOS</a>
        <a class="idos-btn" href="https://idos.cz/vyhledavani/?dotaz=${lineName}" target="_blank">\ud83d\udd0d Hledat linku ${escapeHtml(point.line)}</a>
      </div>
      <div class="schedule-section">
        <h4>\ud83d\udccd GPS poloha</h4>
        <p>\u0160\u00ed\u0159ka: ${point.lat.toFixed(5)}</p>
        <p>D\u00e9lka: ${point.lng.toFixed(5)}</p>
        <a class="idos-btn" href="https://www.google.com/maps?q=${point.lat},${point.lng}" target="_blank">\ud83d\uddfa Zobrazit na Google Maps</a>
      </div>`;
    detailPanel.classList.add("open");
  }

  detailClose.addEventListener("click", () => detailPanel.classList.remove("open"));
  sideClose.addEventListener("click", () => sidePanel.classList.remove("open"));

  let allPoints = [];

  function renderPoints(points) {
    markersLayer.clearLayers();
    allPoints = points;

    // Sidebar list
    sideList.innerHTML = "";
    points.forEach((p, idx) => {
      const isEarly = p.delay < -2;
      const isLate  = p.delay > 5;
      let delayTxt  = p.delay > 0 ? "+"+p.delay+" min" : p.delay < 0 ? p.delay+" min" : "v\u010das";
      let delayClass= isLate ? "delay-high" : isEarly ? "delay-early" : "delay-ok";

      // Sidebar polozka
      const li = document.createElement("div");
      li.className = "side-item" + (isLate ? " late" : isEarly ? " early" : "");
      li.innerHTML = `
        <span class="side-icon">${p.type === "train" ? "\ud83d\ude82" : "\ud83d\ude8c"}</span>
        <div class="side-info">
          <strong>Linka ${escapeHtml(p.line)}</strong>
          <span>${escapeHtml(p.dest) || "?"}</span>
        </div>
        <span class="side-delay ${delayClass}">${delayTxt}</span>`;
      li.addEventListener("click", () => {
        map.setView([p.lat, p.lng], 13);
        showSchedule(p);
      });
      sideList.appendChild(li);

      // Mapa marker
      let fillColor = "#0ea5e9";
      if (isLate)  fillColor = "#f97373";
      if (isEarly) fillColor = "#facc15";

      const icon   = makeIcon(p.type, isEarly);
      const marker = L.marker([p.lat, p.lng], { icon });
      marker.bindPopup(`
        <strong>${p.type === "train" ? "\ud83d\ude82 Vlak" : "\ud83d\ude8c Autobus"} ${escapeHtml(p.line)}</strong><br>
        \u0160m\u011br: ${escapeHtml(p.dest)}<br>
        Zpo\u017ed\u011bn\u00ed: <b style="color:${isLate ? "#f97373" : isEarly ? "#facc15" : "#36d399'}">${delayTxt}</b><br>
        <a href="#" onclick="event.preventDefault()" style="color:#7aa2ff">\ud83d\udcc5 J\u00edzdn\u00ed \u0159\u00e1d</a>`);
      marker.on("click", () => showSchedule(p));
      marker.addTo(markersLayer);
    });

    if (points.length) {
      try { map.fitBounds(markersLayer.getBounds().pad(0.1)); } catch {}
    }
  }

  async function loadData() {
    setStatus("Na\u010d\u00edt\u00e1m polohy...");
    try {
      const raw    = await fetchData();
      const points = parsePoints(raw);
      renderPoints(points);
      if (points.length > 0) {
        setStatus("Zobrazeno spoj\u016f: " + points.length);
      } else {
        setStatus("API nevr\u00e1tilo \u017e\u00e1dn\u00e1 data", true);
      }
    } catch(err) {
      console.error(err);
      setStatus("Chyba: nelze na\u010d\u00edst data", true);
    }
  }

  document.getElementById("toggleSide").addEventListener("click", () => {
    sidePanel.classList.toggle("open");
  });

  refreshBtn.addEventListener("click", loadData);
  loadData();
  setInterval(loadData, REFRESH_MS);
});
