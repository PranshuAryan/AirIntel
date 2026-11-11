# AQI Intelligence Platform
Setup: `cp .env.example .env` (add keys) → `npm i` → `npm run dev`.
Data chain: WAQI station (≤100 km) → OpenAQ station (≤25 km) → Open-Meteo CAMS model. Every reading is badged MEASUREMENT or MODEL, with station name, distance (haversine km) and ISO timestamp.
Open-Meteo also drives history (past_days) and the 5-day forecast (model, not ground truth). Map overlay: WAQI tiles + live station markers (zoom-aggregated). Anomaly = latest PM2.5 > mean + 3σ of trailing 7 days. WAQI pollutant values are AQI sub-indices; OpenAQ/Open-Meteo show µg/m³ with sub-index for severity. Assistant is an on-device rules engine fed with live AQI (no key needed; swap `respond()` for an LLM call server-side).

## Deploy (GitHub → Vercel)
1. `git init && git add . && git commit -m "init" && git branch -M main && git remote add origin <your-repo-url> && git push -u origin main` (`.env` is git-ignored).
2. Vercel → Add New → Project → import the repo (Vite is auto-detected; `vercel.json` handles page refreshes).
3. Environment Variables: `VITE_WAQI_TOKEN`, `VITE_GEOAPIFY_KEY`, `VITE_OPENAQ_KEY`, and `GROQ_API_KEY` (no VITE_ prefix: used only by `api/groq.js`, never sent to the browser). Do NOT set VITE_GROQ_KEY in production.
4. Deploy. Changing env vars later requires a redeploy.
