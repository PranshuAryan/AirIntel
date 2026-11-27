/**
 * API Controller service for air quality data ingestion, geocoding, multi-provider fallbacks, and caching.
 * Supported providers: WAQI (ground stations), OpenAQ v3 (ground sensors), Open-Meteo CAMS (model grid).
 */

import {applyStandard, toConc, concFromUs, naqi, usIndex, getStandard} from './standards.js';
import {ttlCache, memoAsync} from './cache.js';

const env = import.meta.env;
const WAQI_TOKEN = env.VITE_WAQI_TOKEN || 'demo';
const GEOAPIFY_KEY = env.VITE_GEOAPIFY_KEY;
const OPENAQ_KEY = env.VITE_OPENAQ_KEY;
const OPEN_METEO_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Primary tracked air pollutants */
export const KEYS = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];

/**
 * Calculates great-circle distance between two coordinates in kilometers using the Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in km, rounded to 1 decimal place
 */
export const km = (lat1, lon1, lat2, lon2) => {
  const toRad = deg => (deg * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const hav =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return Number((12742 * Math.asin(Math.sqrt(hav))).toFixed(1));
};

/**
 * Internal helper to fetch JSON without browser caching.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {cache: 'no-store', ...options});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** US EPA PM2.5 AQI breakpoints [C_low, C_high, I_low, I_high] */
const PM25_BREAKPOINTS = [
  [0, 12, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

/**
 * Calculates US EPA AQI for PM2.5 concentration.
 * @param {number} concentration
 * @returns {number}
 */
export const pm25Aqi = concentration => {
  const band = PM25_BREAKPOINTS.find(b => concentration <= b[1]) || PM25_BREAKPOINTS[5];
  const [cLow, cHigh, iLow, iHigh] = band;
  return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow);
};

/**
 * Autocomplete search for places/cities using Geoapify API.
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{label: string, lat: number, lon: number, cc: string}>>}
 */
export async function geocode(query, signal) {
  if (!GEOAPIFY_KEY) throw new Error('Set VITE_GEOAPIFY_KEY in .env');
  const data = await fetchJson(
    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=6&apiKey=${GEOAPIFY_KEY}`,
    {signal}
  );
  return data.features.map(f => ({
    label: f.properties.formatted,
    lat: f.properties.lat,
    lon: f.properties.lon,
    cc: f.properties.country_code,
  }));
}

/** Computes age of a timestamp in hours */
const hoursAgo = timestamp => {
  const diffHours = (Date.now() - new Date(timestamp)) / 36e5;
  return isNaN(diffHours) || diffHours < -1 ? Infinity : Math.max(0, diffHours);
};

/** Extracts ISO timestamp from WAQI time object */
const extractTimestamp = stationData => {
  const time = stationData.time || {};
  if (time.v) return new Date(time.v * 1000).toISOString();
  if (time.iso) return time.iso;
  if (time.s && time.tz) return time.s.replace(' ', 'T') + time.tz;
  return time.s;
};

const isWaqiOk = data => data.status === 'ok' && typeof data.data?.aqi === 'number';

/**
 * Fetches ground station readings from WAQI.
 * Tries the coordinate-nearest station first; if stale (>3 h), searches bounds for a fresher station.
 */
async function waqi(lat, lon) {
  let stationData = null;
  try {
    const res = await fetchJson(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`);
    if (isWaqiOk(res)) stationData = res.data;
  } catch {
    // Ignore network error; fallback bounds search below
  }

  // Nearest station is stale or missing: look for a fresher one nearby
  if (!stationData || hoursAgo(extractTimestamp(stationData)) > 3) {
    try {
      const bounds = await fetchJson(
        `https://api.waqi.info/v2/map/bounds?latlng=${lat - 1},${lon - 1},${lat + 1},${lon + 1}&networks=all&token=${WAQI_TOKEN}`
      );
      const candidates = (bounds.data || [])
        .filter(s => !isNaN(+s.aqi) && hoursAgo(s.station.time) <= 3)
        .map(s => ({...s, distance: km(lat, lon, s.lat, s.lon)}))
        .sort((a, b) => a.distance - b.distance);

      const freshest = candidates[0];
      if (freshest) {
        const feed = await fetchJson(`https://api.waqi.info/feed/@${freshest.uid}/?token=${WAQI_TOKEN}`);
        if (isWaqiOk(feed)) stationData = feed.data;
      }
    } catch {
      // Continue to station check
    }
  }

  if (!stationData) throw new Error('no station data');

  const iaqi = stationData.iaqi || {};
  const pollutants = {};
  KEYS.forEach(k => {
    if (iaqi[k]) {
      pollutants[k] = {
        value: iaqi[k].v,
        unit: 'AQI idx',
        sub: iaqi[k].v,
        conc: concFromUs(k, iaqi[k].v),
      };
    }
  });

  const [stationLat, stationLon] = stationData.city.geo;
  const dist = km(lat, lon, stationLat, stationLon);
  if (dist > 100) throw new Error(`nearest station is ${dist} km away`);

  return {
    source: 'WAQI Station',
    type: 'MEASUREMENT',
    station: stationData.city.name,
    distanceKm: dist,
    updated: extractTimestamp(stationData),
    aqi: stationData.aqi,
    pollutants,
    coords: [stationLat, stationLon],
  };
}

/**
 * Fetches sensor readings from OpenAQ v3 within 25 km radius.
 */
async function openaq(lat, lon) {
  if (!OPENAQ_KEY) throw new Error('key missing');
  const headers = {headers: {'X-API-Key': OPENAQ_KEY}};

  const locations = await fetchJson(
    `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=25000&limit=1`,
    headers
  );
  const location = locations.results?.[0];
  if (!location) throw new Error('none within 25 km');

  const sensorParamMap = {};
  location.sensors.forEach(s => {
    sensorParamMap[s.id] = s.parameter;
  });

  const latest = await fetchJson(
    `https://api.openaq.org/v3/locations/${location.id}/latest`,
    headers
  );
  const pollutants = {};

  latest.results.forEach(r => {
    const param = sensorParamMap[r.sensorsId];
    if (param && KEYS.includes(param.name)) {
      pollutants[param.name] = {
        value: r.value,
        unit: param.units,
        sub: null,
        conc: toConc(param.name, r.value, param.units),
      };
    }
  });

  if (!pollutants.pm25) throw new Error('no PM2.5');
  pollutants.pm25.sub = pm25Aqi(pollutants.pm25.value);

  const coords = [location.coordinates.latitude, location.coordinates.longitude];
  return {
    source: 'OpenAQ Station',
    type: 'MEASUREMENT',
    station: location.name,
    distanceKm: km(lat, lon, ...coords),
    updated: latest.results.map(r => r.datetime.utc).sort().at(-1),
    aqi: pollutants.pm25.sub,
    pollutants,
    coords,
  };
}

const finalizeReport = (report, errors) => ({
  ...report,
  errors,
  fetchedAt: new Date().toISOString(),
});

/**
 * Open-Meteo CAMS atmospheric model grid estimate (last resort fallback, explicitly tagged MODEL).
 */
async function model(lat, lon) {
  const data = await fetchJson(
    `${OPEN_METEO_API}?latitude=${lat}&longitude=${lon}&timezone=GMT&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide,us_aqi_ozone`
  );
  const current = data.current;
  if (!current || typeof current.us_aqi !== 'number') throw new Error('no model data');

  const paramMap = {
    pm25: ['pm2_5', 'us_aqi_pm2_5', 1],
    pm10: ['pm10', 'us_aqi_pm10', 1],
    no2: ['nitrogen_dioxide', 'us_aqi_nitrogen_dioxide', 1],
    so2: ['sulphur_dioxide', 'us_aqi_sulphur_dioxide', 1],
    co: ['carbon_monoxide', 'us_aqi_carbon_monoxide', 0.001],
    o3: ['ozone', 'us_aqi_ozone', 1],
  };

  const pollutants = {};
  KEYS.forEach(k => {
    const [attr, subAttr, factor] = paramMap[k];
    if (current[attr] != null) {
      pollutants[k] = {
        value: current[attr],
        unit: 'µg/m³',
        sub: current[subAttr] ?? null,
        conc: +(current[attr] * factor).toFixed(3),
      };
    }
  });

  return {
    source: 'Open-Meteo CAMS model',
    type: 'MODEL',
    station: 'Model grid cell at this location',
    distanceKm: 0,
    updated: current.time.length === 16 ? current.time + ':00Z' : current.time,
    aqi: current.us_aqi,
    pollutants,
    coords: [lat, lon],
  };
}

/**
 * Multi-tier air quality lookup: WAQI -> OpenAQ -> Model fallback.
 */
async function rawAir(lat, lon) {
  const errors = [];
  let bestStale = null;

  for (const [providerName, fetcher] of [
    ['WAQI', waqi],
    ['OpenAQ', openaq],
  ]) {
    try {
      const report = await fetcher(lat, lon);
      const age = hoursAgo(report.updated);
      if (age <= 3) return finalizeReport(report, errors);
      errors.push(`${providerName}: last report ${isFinite(age) ? age.toFixed(1) + ' h ago' : 'time unavailable'}`);
      if (!bestStale || new Date(report.updated) > new Date(bestStale.updated)) {
        bestStale = report;
      }
    } catch (e) {
      errors.push(`${providerName}: ${e.message}`);
    }
  }

  if (bestStale && hoursAgo(bestStale.updated) <= 24) {
    return finalizeReport({...bestStale, stale: true}, errors);
  }

  try {
    return finalizeReport(await model(lat, lon), errors);
  } catch (e) {
    errors.push(`Model: ${e.message}`);
  }

  throw new Error('Could not get air quality for this location. ' + errors.join(' · '));
}

const airCache = ttlCache(6e4, 50);

/**
 * Retrieves the current air quality report for coordinates, applying caching and active standard.
 * @param {number} lat
 * @param {number} lon
 * @param {{force?: boolean}} [options]
 * @returns {Promise<object>}
 */
export async function getAirQuality(lat, lon, {force = false} = {}) {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  let pendingPromise = force ? null : airCache.get(cacheKey);

  if (!pendingPromise) {
    pendingPromise = rawAir(lat, lon);
    airCache.set(cacheKey, pendingPromise);
    pendingPromise.catch(() => airCache.delete(cacheKey));
  }

  return applyStandard(await pendingPromise);
}

/**
 * Fetches station locations within bounds for map rendering.
 */
export async function stations(south, west, north, east) {
  const data = await fetchJson(
    `https://api.waqi.info/v2/map/bounds?latlng=${Math.max(-90, south)},${Math.max(-180, west)},${Math.min(90, north)},${Math.min(180, east)}&networks=all&token=${WAQI_TOKEN}`
  );
  return (data.data || [])
    .filter(x => !isNaN(+x.aqi) && (!x.station.time || hoursAgo(x.station.time) < 24))
    .map(x => ({
      lat: x.lat,
      lon: x.lon,
      aqi: +x.aqi,
      name: x.station.name,
      time: x.station.time,
    }));
}

export const tileUrl = `https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=${WAQI_TOKEN}`;

const computeAverage = arr => {
  const valid = arr.filter(x => x != null);
  return valid.length ? Math.round((valid.reduce((sum, v) => sum + v, 0) / valid.length) * 10) / 10 : null;
};

const computeDayAqi = dayData => {
  if (getStandard() !== 'in') return computeAverage(dayData.a);
  const avgPm25 = computeAverage(dayData.p);
  const avgPm10 = computeAverage(dayData.q);
  const candidates = [
    avgPm25 != null ? naqi('pm25', avgPm25) : null,
    avgPm10 != null ? naqi('pm10', avgPm10) : null,
  ].filter(x => x != null);
  return candidates.length ? Math.max(...candidates) : null;
};

const formatDate = (dateStr, options) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', options);

/**
 * Fetches historical or forecast daily series using Open-Meteo.
 */
export async function series(lat, lon, {past = 0, future = 1}) {
  const data = await fetchJson(
    `${OPEN_METEO_API}?latitude=${lat}&longitude=${lon}&hourly=us_aqi,pm2_5,pm10&past_days=${past}&forecast_days=${future}`
  );
  const byDate = {};

  data.hourly.time.forEach((t, i) => {
    const dateKey = t.slice(0, 10);
    const dayEntry = (byDate[dateKey] ??= {a: [], p: [], q: []});
    dayEntry.a.push(data.hourly.us_aqi[i]);
    dayEntry.p.push(data.hourly.pm2_5[i]);
    dayEntry.q.push(data.hourly.pm10[i]);
  });

  return Object.entries(byDate).map(([date, values]) => ({
    date: formatDate(date, {day: 'numeric', month: 'short'}),
    day: formatDate(date, {weekday: 'short'}),
    aqi: computeDayAqi(values),
    pm25: computeAverage(values.p),
    pm10: computeAverage(values.q),
  }));
}

/**
 * Extracts and aligns the next `hours` hourly PM2.5 values from an Open-Meteo response.
 * @param {object} data
 * @param {number} [now]
 * @param {number} [hours=24]
 */
export function nextHours(data, now = Date.now(), hours = 24) {
  const offsetMs = (data.utc_offset_seconds || 0) * 1000;
  const times = data.hourly?.time || [];
  const pm25Values = data.hourly?.pm2_5 || [];
  const results = [];

  for (let i = 0; i < times.length && results.length < hours; i++) {
    const timestamp = Date.parse(times[i] + 'Z') - offsetMs;
    if (timestamp >= now - 36e5 && pm25Values[i] != null) {
      results.push({
        ts: timestamp,
        hour: +times[i].slice(11, 13),
        pm25: pm25Values[i],
      });
    }
  }
  return results;
}

/**
 * Memoized hourly PM2.5 forecast retrieval (cached for 30 minutes).
 */
export const hourlyForecast = memoAsync(
  async (lat, lon, hours = 24) => {
    const data = await fetchJson(
      `${OPEN_METEO_API}?latitude=${lat}&longitude=${lon}&hourly=pm2_5&forecast_days=2&timezone=auto`
    );
    return nextHours(data, Date.now(), hours);
  },
  18e5,
  (lat, lon, h) => `${lat.toFixed(1)},${lon.toFixed(1)},${h}`
);

/**
 * Reverse geocodes coordinates to a place label and country code.
 */
export async function reverseGeocode(lat, lon) {
  const res = await fetchJson(
    `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_KEY}`
  );
  const props = res.features[0].properties;
  return {
    label: [props.city || props.county || props.name, props.state, props.country].filter(Boolean).join(', ') || props.formatted,
    cc: props.country_code,
  };
}

/**
 * Retrieves measured historical daily PM series from OpenAQ sensor stations.
 */
export async function measuredSeries(lat, lon, days) {
  if (!OPENAQ_KEY) throw new Error('OpenAQ key missing');
  const headers = {headers: {'X-API-Key': OPENAQ_KEY}};

  const locationsData = await fetchJson(
    `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=25000&limit=20`,
    headers
  );
  const locations = locationsData.results || [];
  const hasParam = (loc, paramName) => loc.sensors.some(s => s.parameter.name === paramName);

  const bestStation =
    locations.find(l => hasParam(l, 'pm25') && hasParam(l, 'pm10')) ||
    locations.find(l => hasParam(l, 'pm25'));

  if (!bestStation) throw new Error('no OpenAQ station with PM data within 25 km');

  const fromDate = new Date(Date.now() - (days + 1) * 864e5).toISOString();
  const toDate = new Date().toISOString();

  const fetchSensorDays = async paramName => {
    const sensor = bestStation.sensors.find(s => s.parameter.name === paramName);
    if (!sensor) return {};
    const sensorData = await fetchJson(
      `https://api.openaq.org/v3/sensors/${sensor.id}/days?datetime_from=${fromDate}&datetime_to=${toDate}&limit=100`,
      headers
    );
    return Object.fromEntries(
      (sensorData.results || [])
        .filter(r => r.value != null && r.period?.datetimeFrom)
        .map(r => [
          (r.period.datetimeFrom.local || r.period.datetimeFrom.utc).slice(0, 10),
          r.value,
        ])
    );
  };

  const [pm25ByDay, pm10ByDay] = await Promise.all([
    fetchSensorDays('pm25'),
    fetchSensorDays('pm10'),
  ]);

  const isIndiaStandard = getStandard() === 'in';
  const allDates = [...new Set([...Object.keys(pm25ByDay), ...Object.keys(pm10ByDay)])].sort();

  const rows = allDates.map(dateKey => {
    const pm25Val = pm25ByDay[dateKey] ?? null;
    const pm10Val = pm10ByDay[dateKey] ?? null;
    const subIndices = (
      isIndiaStandard
        ? [naqi('pm25', pm25Val), naqi('pm10', pm10Val)]
        : [usIndex('pm25', pm25Val), usIndex('pm10', pm10Val)]
    ).filter(x => x != null);

    return {
      date: formatDate(dateKey, {day: 'numeric', month: 'short'}),
      day: formatDate(dateKey, {weekday: 'short'}),
      aqi: subIndices.length ? Math.max(...subIndices) : null,
      pm25: pm25Val != null ? +pm25Val.toFixed(1) : null,
      pm10: pm10Val != null ? +pm10Val.toFixed(1) : null,
    };
  });

  if (!rows.length) throw new Error('the station has no recent daily data');

  return {
    rows,
    station: bestStation.name,
    dist: km(lat, lon, bestStation.coordinates.latitude, bestStation.coordinates.longitude),
  };
}
