# VDV Bus Tracker

Jednoduchá webová aplikace pro sledování autobusů VDV v Kraji Vysočina na živé mapě.

## Funkce

- Zobrazení živých poloh autobusů na mapě
- Dark mode design
- Automatická aktualizace každých 15 sekund
- Tlačítko pro ruční obnovení
- Responzivní design (funguje i na mobilu)

## Technologie

- **Leaflet.js** – interaktivní mapa (CDN)
- **OpenStreetMap** – podkladová mapa
- **AllOrigins proxy** – řeší CORS pro API volání
- Čistý HTML/CSS/JS – žádný backend, žádný build step

## Struktura projektu

```
vdv_bus/
├─ index.html
└─ assets/
   ├─ css/
   │  └─ styles.css
   └─ js/
      └─ app.js
```

## Spuštění lokálně

Stačí otevřít `index.html` v prohlížeči nebo použít jednoduchý HTTP server:

```bash
python -m http.server 8080
```

## Nasazení na GitHub Pages

1. Nahraj obsah tohoto repozitáře na GitHub
2. Jdi do **Settings → Pages**
3. Vyber branch `main` a složku `/root`
4. Po chvíli bude aplikace dostupná na adrese od GitHubu

## Stažení ZIP

Klikni na zelené tlačítko **Code → Download ZIP** na hlavní stránce repozitáře.

## Data

Data jsou stahována z API Kraje Vysočina:
`https://mapavdv.kr-vysocina.cz/Ajax/GetPoints`

Kvůli CORS je použita veřejná proxy AllOrigins.
