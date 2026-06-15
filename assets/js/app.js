const API_URL =
  "https://api.allorigins.win/raw?url=" +
  encodeURIComponent("https://mapavdv.kr-vysocina.cz/Ajax/GetPoints");

const REFRESH_MS = 15000;

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const refreshBtn = document.getElementById("refreshBtn");

// Inicializace Leaflet mapy – Kraj Vysocina
const map = L.map("map", {
  zoomControl: true,
}).setView([49.394, 15.591], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Vrstva pro markery – daji se hromadne mazat
const markersLayer = L.layerGroup().addTo(map);

function setStatus(text, isError = false) {
  statusText.textContent = text;
  if (isError) {
    statusDot.style.background = "#f97373";
    statusDot.style.boxShadow = "0 0 18px #f97373";
  } else {
    statusDot.style.background = "#36d399";
    statusDot.style.boxShadow = "0 0 18px #36d399";
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}

function normalizePoints(data) {
  const items = Array.isArray(data)
    ? data
    : data?.points || data?.data || data?.items || [];

  return items
    .map((item) => {
      const lat = Number(
        item.lat ??
          item.latitude ??
          item.y ??
          item.Y ??
          item.position?.lat ??
          item.Position?.Lat
      );
      const lng = Number(
        item.lng ??
          item.lon ??
          item.longitude ??
          item.x ??
          item.X ??
          item.position?.lng ??
          item.Position?.Lon
      );
      const name = String(
        item.name ??
          item.LineName ??
          item.line ??
          item.route ??
          item.trip ??
          item.title ??
          "Spoj"
      ).trim();
      return { lat, lng, name };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function renderPoints(points) {
  markersLayer.clearLayers();
  points.forEach((p) => {
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 8,
      color: "#7aa2ff",
      weight: 2,
      fillColor: "#0ea5e9",
      fillOpacity: 0.9,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(p.name)}</strong><br>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
    );
    marker.addTo(markersLayer);
  });
  if (points.length) {
    map.fitBounds(markersLayer.getBounds().pad(0.18));
  }
}

async function loadData() {
  try {
    setStatus("Nacitam aktualni polohy...");
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const points = normalizePoints(json);
    renderPoints(points);
    if (points.length) {
      setStatus(`Nacteno ${points.length} pozic`);
    } else {
      setStatus("Zadna data v odpovedi");
    }
  } catch (err) {
    console.error(err);
    setStatus("Chyba nacteni dat", true);
  }
}

refreshBtn.addEventListener("click", () => {
  loadData();
});

loadData();
setInterval(loadData, REFRESH_MS);
