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

---

## Clean-Air Plan (`/plan`)
Household profile (children, elders, asthma, commute, cooking fuel, heating, budget) → a personalised plan of **daily routines, indoor air hacks, sustainable alternatives and community actions**. Each action shows its **direct impact** (e.g. indoor PM2.5 with windows shut or a purifier, kg CO₂ saved by a commute swap, % cleaner forecast window), can be ticked off, and the plan can be copied or shared with the household.

How it works (`src/services/plan.js`):
- **The AI never invents advice or numbers.** It only picks actions from a vetted catalog of 27 and writes a one-line personal reason for each. Every impact figure is computed in code from the live reading, the 24 h model forecast and the profile, using assumptions listed in the UI (windows shut keep ~50% of outdoor PM2.5 out, purifier ~50%, N95 ≥95% lab rating, WHO 24 h PM2.5 guideline 15 µg/m³, CO₂ per passenger-km).
- **Always works:** with no key, a rate limit or a network failure, the same plan is built by deterministic rules (shown as "Rule-based plan").
- **AI output is untrusted:** unknown ids are dropped, text is stripped of markup and control characters and length-capped. The profile reaches prompts only as whitelisted enums/booleans and a clamped number, never free text.

## Quality, security, accessibility, efficiency
| Area | What is in place |
|---|---|
| Testing | `npm test`: 91 Vitest tests covering AQI maths, cache, the plan engine (selection, impact formulas, AI validation, fallback, prompt injection), proxy guard + handler, API caching, and component tests with **axe accessibility audits** |
| Lint | `npm run lint` (ESLint + jsx-a11y + react-hooks). `npm run check` = lint + test + build |
| Security | Groq key server-side only (the dev-only key is stripped from production builds). Proxy allow-lists fields and models, caps sizes, clamps numbers, checks same-origin, rate-limits per IP, times out at 25 s and trims upstream errors. `vercel.json` adds CSP, HSTS, nosniff, frame-ancestors none, Referrer-Policy and Permissions-Policy |
| Accessibility | Skip link, landmarks, focus and announcement on route change, ARIA 1.2 combobox search, labelled fieldsets, chart text alternatives (sr-only tables), AA contrast pass, reduced-motion support, live regions |
| Efficiency | Route code-splitting and vendor chunks (landing JS ~64 KB app + 163 KB React vs 811 KB single chunk before), live lookups cached and de-duplicated (switching US/NAQI needs no refetch), AI advice/plan cached 30 min, stale search requests aborted |

## Known limitations
- WAQI, OpenAQ and Geoapify keys are visible in the browser (public-tier keys). Restrict Geoapify to your domain; moving them behind the serverless proxy is the next hardening step.
- The proxy rate limit is per warm serverless instance (best effort); use Vercel Firewall or a KV-backed limiter for strict limits.
- Impact figures are typical estimates, not measurements of your home. Not medical advice.


## Clean-Air Plan (`/plan`)
Household profile -> personalised routines, indoor air hacks, sustainable swaps and community actions, each with a computed **direct impact**. The AI only picks actions from a vetted catalog and words them; all numbers come from code (reading, 24 h forecast, profile). Falls back to deterministic rules if AI is unavailable. AI output is validated and sanitised.

## Quality
- `npm test` (91 Vitest tests incl. axe a11y), `npm run lint` (ESLint + jsx-a11y), `npm run check` = lint + test + build
- Security: Groq key server-side only; proxy allow-lists fields/models, size caps, same-origin check, rate limit, timeout; CSP/HSTS/nosniff headers in `vercel.json`
- Accessibility: skip link, landmarks, focus on route change, ARIA combobox search, chart text tables, AA contrast
- Efficiency: lazy routes + vendor chunks (landing JS ~225 KB vs 811 KB), cached/de-duplicated lookups (switching US/NAQI needs no refetch), cached AI results

## Known limits
- WAQI/OpenAQ/Geoapify keys are visible in the browser; restrict Geoapify to your domain.
- Proxy rate limit is per warm serverless instance (best effort).
- Impact figures are typical estimates, not measurements.
