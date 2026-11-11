# AirIntel — Real-Time Air Quality Intelligence Platform

A React web app that shows live air quality for any place on Earth, with a shaded world map, comparisons, history and forecasts, health advice, and an AI assistant. It supports both the **US AQI (EPA)** and **India NAQI (CPCB)** and always tells you whether a number is a **live ground measurement** or a **model estimate**.

## Pages
| Route | What it does |
|---|---|
| `/` Live AQI | Place search, animated AQI gauge, six pollutant cards (PM2.5, PM10, NO₂, SO₂, CO, O₃) with severity bars, a provenance panel (source, station, distance in km, ISO timestamp, age), quick guidance, a refresh button |
| `/map` Map | World map shaded by AQI with borders and place names drawn above the colour. Click anywhere to get that place's AQI card |
| `/compare` Compare | Two places side by side, radar and bar charts, "clean air winner" from combined PM2.5 + PM10 |
| `/historical` History | 7- or 30-day PM2.5 vs PM10 chart, percentage change, anomaly flag |
| `/health` Health | AI advisory for the current AQI, AQI scale, advice for asthma / elderly / children / athletes, outdoor activity matrix |
| `/forecast` Forecast | 5-day AQI outlook, tagged **MODEL FORECAST (Non-ground measurement)** |
| `/assistant` Assistant | Groq-powered chatbot that can look up the AQI of any place and explain pollutants |

## Data sources and resources
| Resource | Used for | Key needed |
|---|---|---|
| **WAQI** (api.waqi.info) | Primary live station readings (`/feed/geo:lat;lon`, plus `/map/bounds` to find a fresher nearby station) and the map's station shading | `VITE_WAQI_TOKEN` |
| **OpenAQ v3** | Secondary station readings (raw concentrations) and measured daily history | `VITE_OPENAQ_KEY` |
| **Open-Meteo Air Quality** (CAMS model) | 5-day forecast only — the one modelled dataset in the app (history can optionally be switched to it on request) | none |
| **Geoapify** | Autocomplete search, reverse geocoding (place names, country) | `VITE_GEOAPIFY_KEY` |
| **Groq** (`openai/gpt-oss-120b`, fallbacks `gpt-oss-20b`, `qwen3.8-27b`) | Assistant chat with tool calling, Health advisory | `GROQ_API_KEY` (server) |
| **Esri** Light Gray Base + World Boundaries and Places tiles | Map background, borders, labels | none |
| Libraries | React 18, React Router 6, Vite 5, Tailwind CSS 3, Leaflet + react-leaflet, Recharts, Lucide icons | — |

## How it works
**Live data (`src/services/apiController.js`).** Only real ground-station measurements are used for current values: WAQI (nearest station within 100 km, or a fresher nearby station found through the map endpoint), then OpenAQ (within 25 km). A reading older than 3 hours is treated as stale; the freshest station is shown with a warning up to 24 hours, and beyond that the app says no live reading is available instead of guessing. There is no model fallback. Distance is the haversine distance to the station. Requests bypass the browser cache, and the app re-checks every 10 minutes, when you return to the tab, and on Refresh.

**Two AQI standards (`src/services/standards.js`).** A dropdown in the header chooses Auto, US AQI or India NAQI. Auto uses NAQI when the place is in India. NAQI uses CPCB breakpoints per pollutant; the overall value is the worst sub-index. Open-Meteo and OpenAQ give concentrations directly; WAQI only gives US-scale sub-indices, so those are converted back to concentrations first (flagged as estimated).

**Map.** Live station readings in view are loaded from WAQI and interpolated (inverse-distance weighting) onto a canvas under a separate tile layer holding borders and labels. Colour fades out away from stations, so areas with no station are left uncoloured. Clicking runs the normal live-data lookup for that point. In India NAQI mode the shading is approximated from station values; the click card is exact.

**History and anomalies.** Daily PM2.5 and PM10 means are measured at the nearest OpenAQ station. If no station history exists, the page says so and offers an optional, clearly labelled modelled history (Open-Meteo CAMS). Change % = (today − past) ÷ past × 100. An anomaly is flagged when a day's PM2.5 is more than 3 standard deviations above the mean of the previous 7 days.

**AI.** The assistant sends the conversation and the current location's data to Groq and can call a `get_air_quality` tool to fetch live data for any place. The Health page asks Groq for structured JSON advice based on the current readings. In production the key stays on the server (`api/groq.js`).

## Project structure
```
api/groq.js                  Vercel serverless proxy for Groq
src/App.jsx                  layout, routing, global state, auto-refresh
src/lib.js                   AQI scales, colours, time helpers
src/services/apiController.js  providers, fallback, geocoding, history/forecast
src/services/standards.js    NAQI/US conversions
src/services/groq.js         chat + advisory
src/components/SearchBox.jsx Geoapify autocomplete
src/pages/                   Dashboard, InteractiveMap, Compare, Historical, Health, Forecast, AIAssistant
```

## Run locally
```
cp .env.example .env     # fill in the keys
npm install
npm run dev              # http://localhost:5173
```
`.env`: `VITE_WAQI_TOKEN`, `VITE_GEOAPIFY_KEY`, `VITE_OPENAQ_KEY`, and for local use only `VITE_GROQ_KEY`.

## Deploy (GitHub → Vercel)
1. Push to GitHub (`.env` is git-ignored).
2. Import the repo in Vercel (preset: Vite).
3. Add environment variables: the three `VITE_` keys (type **Config**, they ship to the browser) and `GROQ_API_KEY` (type **Secret**, no `VITE_` prefix). Do not set `VITE_GROQ_KEY` in production.
4. Deploy; redeploy after changing variables. `vercel.json` makes page refreshes work.

## Limits and notes
- Only the Forecast page (and the optional modelled history) uses model data (Open-Meteo, free tier about 10,000 requests per day).
- Places with no monitoring station within range show no live value.
- WAQI, OpenAQ and Geoapify keys are visible in the browser; restrict Geoapify to your domain.
- Time shown is when the station last reported, not when the app checked. Some stations report with delays.
- Health text is general guidance, not medical advice.

## Attribution
Air quality data: World Air Quality Index Project, OpenAQ, Open-Meteo (contains Copernicus Atmosphere Monitoring Service information), map tiles © Esri, © OpenStreetMap contributors, geocoding by Geoapify, AI by Groq.
