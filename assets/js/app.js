const TARGET_URL = "https://mapavdv.kr-vysocina.cz/Ajax/GetPoints";
const REFRESH_MS = 15000;

document.addEventListener("DOMContentLoaded", () => {
  const statusText  = document.getElementById("statusText");
  const statusDot   = document.getElementById("statusDot");
  const refreshBtn  = document.getElementById("refreshBtn");
  const sideList    = document.getElementById("sideList");
  const sidePanel   = document.getElementById("sidePanel");
  const sideClose   = document.getElementById("sideClose");
  const detailPanel = document.getElementById("detailPanel");
  const detailBody  = document.getElementById("detailBody");
  const detailClose = document.getElementById("detailClose");

  // --- MAPA (dark theme - CartoDB Dark Matter) ---
  const map = L.map("map", { zoomControl: true }).setView([49.394, 15.591], 9);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);
  const markersLayer = L.layerGroup().addTo(map);

  // --- IKONY ---
  function makeIcon(type, isEarly) {
    const emoji = type === "train" ? "\ud83d\ude82" : "\ud83d\ude8c";
    const bg = isEarly ? "#facc15" : (type === "train" ? "#a78bfa" : "#0ea5e9");
    const html = `<div style="background:${bg};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.3)">${emoji}</div>`;
    return L.divIcon({ html, className: "", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18] });
  }

  // --- STATUS: Nacitam / Online / Offline ---
  function setStatus(text, state = "ok") {
    statusText.textContent = text;
    if (state === "loading") {
      statusDot.style.background = "#f59e0b";
      statusDot.style.boxShadow  = "0 0 10px #f59e0b";
      statusDot.title = "Nacitam";
    } else if (state === "error") {
      statusDot.style.background = "#f97373";
      statusDot.style.boxShadow  = "0 0 10px #f97373";
      statusDot.title = "Offline";
    } else {
      statusDot.style.background = "#36d399";
      statusDot.style.boxShadow  = "0 0 10px #36d399";
      statusDot.title = "Online";
    }
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
    const ts = Date.now();
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

  function showSchedule(point) {
    const lineName = encodeURIComponent(point.line);
    const dest = encodeURIComponent(point.dest);
    detailBody.innerHTML = `
      <h3>${point.type === "train" ? "\ud83d\ude82 Vlak" : "\ud83d\ude8c Autobus"} Linka ${escapeHtml(point.line)}</h3>
      <p>Smer: <strong>${escapeHtml(point.dest)}</strong></p>
      <p>Zpozdeni: <strong>${point.delay > 0 ? "+"+point.delay : point.delay} min</strong></p>
      <hr>
      <p><a href="https://idos.cz/jizdnirady/spojeni/?f=&t=${dest}&date=&time=" target="_blank">\ud83d\udd17 Otevrit IDOS</a></p>
      <p><a href="https://idos.cz/vyhledavani/?dotaz=${lineName}" target="_blank">\ud83d\udd0d Hledat linku ${escapeHtml(point.line)}</a></p>
      <hr>
      <p>Lat: ${point.lat.toFixed(5)} | Lng: ${point.lng.toFixed(5)}</p>
      <p><a href="https://www.google.com/maps?q=${point.lat},${point.lng}" target="_blank">\ud83d\uddfa Google Maps</a></p>
    `;
    detailPanel.classList.add("open");
  }

  detailClose.addEventListener("click", () => detailPanel.classList.remove("open"));
  sideClose.addEventListener("click", () => sidePanel.classList.remove("open"));

  let allPoints = [];

  function renderPoints(points) {
    markersLayer.clearLayers();
    allPoints = points;
    sideList.innerHTML = "";
    points.forEach((p) => {
      const isEarly = p.delay < -2;
      const isLate  = p.delay > 5;
      let delayTxt  = p.delay > 0 ? "+"+p.delay+" min" : p.delay < 0 ? p.delay+" min" : "vcas";
      const li = document.createElement("div");
      li.className = "side-item" + (isLate ? " late" : isEarly ? " early" : "");
      li.innerHTML = `<span class="side-icon">${p.type === "train" ? "\ud83d\ude82" : "\ud83d\ude8c"}</span><span class="side-info"><strong>Linka ${escapeHtml(p.line)}</strong><br>${escapeHtml(p.dest) || "?"}</span><span class="side-delay ${isLate ? "delay-high" : isEarly ? "delay-early" : "delay-ok"}">${delayTxt}</span>`;
      li.addEventListener("click", () => { map.setView([p.lat, p.lng], 13); showSchedule(p); });
      sideList.appendChild(li);
      const icon = makeIcon(p.type, isEarly);
      const marker = L.marker([p.lat, p.lng], { icon });
      marker.bindPopup(`<strong>${p.type === "train" ? "\ud83d\ude82 Vlak" : "\ud83d\ude8c Autobus"} ${escapeHtml(p.line)}</strong><br>Smer: ${escapeHtml(p.dest)}<br>Zpozdeni: <strong>${delayTxt}</strong>`);
      marker.on("click", () => showSchedule(p));
      marker.addTo(markersLayer);
    });
    if (points.length) { try { map.fitBounds(markersLayer.getBounds().pad(0.1)); } catch {} }
  }

  async function loadData() {
    setStatus("Nacitam...", "loading");
    try {
      const raw = await fetchData();
      const points = parsePoints(raw);
      renderPoints(points);
      if (points.length > 0) {
        setStatus("Online ("+points.length+" spoju)", "ok");
      } else {
        setStatus("Online (zadna data)", "ok");
      }
    } catch(err) {
      console.error(err);
      setStatus("Offline", "error");
    }
  }

  document.getElementById("toggleSide").addEventListener("click", () => {
    sidePanel.classList.toggle("open");
  });
  refreshBtn.addEventListener("click", loadData);
  loadData();
  setInterval(loadData, REFRESH_MS);
});
