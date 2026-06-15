const TARGET_URL = "https://mapavdv.kr-vysocina.cz/Ajax/GetPoints";
const REFRESH_MS = 15000;

// Cekame na DOM + Puter.js
document.addEventListener("DOMContentLoaded", async () => {
  const statusText = document.getElementById("statusText");
  const statusDot  = document.getElementById("statusDot");
  const refreshBtn = document.getElementById("refreshBtn");

  // Leaflet mapa
  const map = L.map("map", { zoomControl: true }).setView([49.394, 15.591], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  const markersLayer = L.layerGroup().addTo(map);

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusDot.style.background = isError ? "#f97373" : "#36d399";
    statusDot.style.boxShadow  = isError ? "0 0 18px #f97373" : "0 0 18px #36d399";
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
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
      }))
      .filter(p => isFinite(p.lat) && isFinite(p.lng));
  }

  async function fetchData() {
    const ts = Date.now();
    const target = TARGET_URL + "?t=" + ts;

    // 1. Puter.js - CORS free, funguje na github.io
    try {
      if (window.puter) {
        const res = await puter.net.fetch(target);
        if (res.ok) {
          const json = await res.json();
          console.log("[proxy] puter OK");
          return json;
        }
      }
    } catch(e) { console.warn("[proxy] puter fail:", e); }

    // 2. allorigins /get
    try {
      const res = await fetch(
        "https://api.allorigins.win/get?url=" + encodeURIComponent(target),
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        console.log("[proxy] allorigins OK");
        return json; // { contents: "..." }
      }
    } catch(e) { console.warn("[proxy] allorigins fail:", e); }

    // 3. cors.lol
    try {
      const res = await fetch(
        "https://api.cors.lol/?url=" + encodeURIComponent(target),
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        console.log("[proxy] cors.lol OK");
        return json;
      }
    } catch(e) { console.warn("[proxy] cors.lol fail:", e); }

    // 4. codetabs
    try {
      const res = await fetch(
        "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target),
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        console.log("[proxy] codetabs OK");
        return json;
      }
    } catch(e) { console.warn("[proxy] codetabs fail:", e); }

    throw new Error("Vsechny proxy selhaly");
  }

  function renderPoints(points) {
    markersLayer.clearLayers();
    points.forEach(p => {
      const delayTxt = p.delay > 0 ? "+" + p.delay + " min"
                     : p.delay < 0 ? p.delay + " min"
                     : "vcas";
      const popup = "<strong>Linka " + escapeHtml(p.line) + "</strong><br>"
                  + "Smer: " + escapeHtml(p.dest) + "<br>"
                  + "Zpozdeni: " + delayTxt;
      L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "#7aa2ff",
        weight: 2,
        fillColor: p.delay > 5 ? "#f97373" : "#0ea5e9",
        fillOpacity: 0.9,
      }).bindPopup(popup).addTo(markersLayer);
    });
    if (points.length) {
      try { map.fitBounds(markersLayer.getBounds().pad(0.1)); } catch {}
    }
  }

  async function loadData() {
    setStatus("Nacitam polohy...");
    try {
      const raw    = await fetchData();
      const points = parsePoints(raw);
      renderPoints(points);
      if (points.length > 0) {
        setStatus("Zobrazenych spoju: " + points.length);
      } else {
        setStatus("API nevratio zadna data", true);
      }
    } catch(err) {
      console.error(err);
      setStatus("Chyba: nelze nacist data", true);
    }
  }

  refreshBtn.addEventListener("click", loadData);
  loadData();
  setInterval(loadData, REFRESH_MS);
});
