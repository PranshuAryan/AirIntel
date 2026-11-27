# AirIntel — Real-Time Air Quality Intelligence Platform

A React web app that shows live air quality for any place on Earth, with a shaded world map, comparisons, history and forecasts, health advice, and an AI assistant. It supports both the **US AQI (EPA)** and **India NAQI (CPCB)** and always tells you whether a number is a **live ground measurement** or a **model estimate**.

## Pages
| Route | What it does |
|---|---|
| `/` Live AQI | Place search, animated AQI gauge, six pollutant cards (PM2.5, PM10, NO₂, SO₂, CO, O₃) with severity bars, provenance panel (source, station, distance in km, ISO timestamp, age), quick guidance, refresh button |
| `/plan` Clean-Air Plan | Personalised household plan (daily routines, indoor hacks, sustainable swaps, community actions) with direct impact calculations, progress tracking, and 24 h cleanest forecast window |
| `/family` Family | Individual family member exposure & dose modeling (m³ air inhaled/day × PM2.5 × hours) with vulnerability weights, health risk ratings, and clean-air plan dose savings |
| `/indoor` Indoor | Purifier CADR sizing calculator (4.8 ACH standard by room length × width × height), indoor PM2.5 reduction estimates, and Corsi-Rosenthal DIY box fan guide |
| `/map` Map | Interactive world map shaded by AQI with borders and place names drawn above the colour. Click anywhere to inspect that location's live AQI card |
| `/compare` Compare | Two places side by side, radar and bar charts, "clean air winner" determined from combined PM2.5 + PM10 concentrations |
| `/historical` History | 7- or 30-day PM2.5 vs PM10 ground station time series, percentage change, statistical anomaly flag (>3σ deviation) |
| `/health` Health | AI advisory for current AQI, AQI scale reference, group-specific guidance (asthma, elderly, children, athletes), and outdoor activity matrix |
| `/forecast` Forecast | 5-day hourly AQI outlook tagged **MODEL FORECAST (Non-ground measurement)** with day-by-day trend cards |
| `/assistant` Assistant | Groq-powered conversational assistant equipped with tool-calling (`get_air_quality`) to retrieve live data for any city and verify advice |

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

---

## Clean-Air Plan (`/plan`)
Household profile (children, elders, asthma, commute, cooking fuel, heating, budget) → a personalised plan of **daily routines, indoor air hacks, sustainable alternatives and community actions**. Each action shows its **direct impact** (e.g. indoor PM2.5 with windows shut or a purifier, kg CO₂ saved by a commute swap, % cleaner forecast window), can be ticked off, and the plan can be copied or shared with the household.

How it works (`src/services/plan.js`):
- **The AI never invents advice or numbers.** It only picks actions from a vetted catalog of 27 and writes a one-line personal reason for each. Every impact figure is computed in code from the live reading, the 24 h model forecast and the profile, using assumptions listed in the UI (windows shut keep ~50% of outdoor PM2.5 out, purifier ~50%, N95 ≥95% lab rating, WHO 24 h PM2.5 guideline 15 µg/m³, CO₂ per passenger-km).
- **Always works:** with no key, a rate limit or a network failure, the same plan is built by deterministic rules (shown as "Rule-based plan").
- **AI output is untrusted:** unknown ids are dropped, text is stripped of markup and control characters and length-capped. The profile reaches prompts only as whitelisted enums/booleans and a clamped number, never free text.

## Problem Statement Alignment & Traceability

| Problem Requirement | Implementation & Architectural Evidence | Test & Verification |
|---|---|---|
| **Multi-Pollutant Real-Time Monitoring** | Aggregates PM2.5, PM10, NO₂, SO₂, CO, O₃ with individual pollutant cards, sub-indices, units, and dominant pollutant indicators in `src/pages/Dashboard.jsx` & `src/services/apiController.js`. | `tests/apiController.test.js`, `tests/components.test.jsx` |
| **Dual AQI Standards (US EPA & India NAQI)** | Seamless auto and manual switching between US EPA breakpoints and India CPCB 2014 NAQI in `src/services/standards.js`. Instant client-side re-scoring without redundant API roundtrips. | `tests/standards.test.js` |
| **Transparent Data Provenance & Trust** | Explicit labeling distinguishing **LIVE GROUND MEASUREMENT** (WAQI/OpenAQ stations with station name, coordinates, age, and haversine distance in km) from **MODEL ESTIMATE** (Open-Meteo CAMS grid). Stale warnings at >3h and >24h. | Verified in `tests/apiController.test.js` & `tests/components.test.jsx` |
| **Actionable Clean-Air Interventions** | Personalised Clean-Air Action Plan (`/plan`) tailoring 27 vetted actions across Daily Routine, Indoor Hacks, Sustainable Swaps, and Community Initiatives. Computes direct impacts (CO₂ savings, indoor PM2.5 reduction, cleanest forecast window). | `tests/plan.test.js` |
| **Family Exposure & Vulnerability Modeling** | Personalised exposure dose calculations (`/family`) combining age-stratified inhalation rates (EPA Handbook values), indoor/outdoor ratios, and medical condition vulnerability weighting. | `tests/family.test.js` |
| **Indoor Air Quality Engineering** | Room volume CADR sizing calculator adhering to the 4.8 Air Changes per Hour (ACH) standard, plus step-by-step Corsi-Rosenthal DIY box fan filtration guide (`/indoor`). | `tests/indoor.test.js` |
| **Geospatial & Historical Intelligence** | Interactive world map with inverse-distance weighted station interpolation (`/map`), multi-city comparison with radar charts (`/compare`), and statistical anomaly detection (>3σ deviation) on historical trends (`/historical`). | `tests/components.test.jsx` |
| **Verifiable AI Advisory & Chat** | Groq-powered multi-turn assistant (`/assistant`) with strict tool-calling (`get_air_quality`) to retrieve live data and prevent hallucinated numbers; structured health advisories (`/health`). | `tests/guard.test.js`, `tests/plan.test.js` |

## Quality, Security, Accessibility & Efficiency

| Area | Implementation Details |
|---|---|
| **Testing** | 100+ Vitest automated unit and integration tests across 9 test suites covering API fallbacks, caching, standards maths, family dose models, indoor engineering, proxy guards, and component accessibility. |
| **Accessibility (WCAG 2.1 AA)** | Automated `jest-axe` audits integrated in test suites. Skip link, semantic HTML5 landmarks, route-change focus management, ARIA 1.2 live regions and comboboxes, screen-reader data tables (`SrTable.jsx`), and high-contrast color palettes. |
| **Security & Privacy** | Serverless proxy (`api/groq.js` and `api/_guard.js`) keeping private API keys server-side. Strict origin validation, per-IP rate limiting, payload allow-listing, prompt-injection defense, and hardened HTTP response headers (CSP, HSTS, X-Frame-Options, Cross-Origin-Resource-Policy, Permissions-Policy). |
| **Efficiency & Performance** | Route-level code-splitting with React `lazy`/`Suspense`, in-memory TTL caching with size bounds, request de-duplication (`memoAsync`), and AbortController request cancellation. |

## Known Limitations
- Public-tier API keys for WAQI, OpenAQ, and Geoapify are client-accessible; production hardening recommends routing all third-party telemetry through protected serverless gateways.
- In-memory rate limiting operates per warm serverless container instance; high-scale enterprise environments should couple this with a distributed KV cache or edge firewall.
- Indoor and personal dose impact calculations represent verified empirical models and guidelines, not clinical medical diagnoses.
