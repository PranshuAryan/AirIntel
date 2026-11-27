import {setScale} from '../lib.js';

/**
 * India NAQI (CPCB 2014) Breakpoints:
 * Concentration in µg/m³ (CO in mg/m³) -> Sub-index [C_low, C_high, I_low, I_high].
 * The overall NAQI is the maximum sub-index across measured pollutants.
 */
const IN_BREAKPOINTS = {
  pm25: [[0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500]],
  pm10: [[0, 50, 0, 50], [51, 100, 51, 100], [101, 250, 101, 200], [251, 350, 201, 300], [351, 430, 301, 400], [431, 600, 401, 500]],
  no2: [[0, 40, 0, 50], [41, 80, 51, 100], [81, 180, 101, 200], [181, 280, 201, 300], [281, 400, 301, 400], [401, 500, 401, 500]],
  so2: [[0, 40, 0, 50], [41, 80, 51, 100], [81, 380, 101, 200], [381, 800, 201, 300], [801, 1600, 301, 400], [1601, 2000, 401, 500]],
  o3: [[0, 50, 0, 50], [51, 100, 51, 100], [101, 168, 101, 200], [169, 208, 201, 300], [209, 748, 301, 400], [749, 900, 401, 500]],
  co: [[0, 1, 0, 50], [1.1, 2, 51, 100], [2.1, 10, 101, 200], [10.1, 17, 201, 300], [17.1, 34, 301, 400], [34.1, 50, 401, 500]],
};

/**
 * US EPA Breakpoints:
 * Units: µg/m³ for PM, ppb for NO2/SO2, ppm for O3/CO.
 * Used for US AQI calculation and for inverting WAQI US-scale sub-indices back to concentrations.
 */
const US_BREAKPOINTS = {
  pm25: [[0, 12, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 150.4, 151, 200], [150.5, 250.4, 201, 300], [250.5, 350.4, 301, 400], [350.5, 500.4, 401, 500]],
  pm10: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 504, 301, 400], [505, 604, 401, 500]],
  no2: [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150], [361, 649, 151, 200], [650, 1249, 201, 300], [1250, 1649, 301, 400], [1650, 2049, 401, 500]],
  so2: [[0, 35, 0, 50], [36, 75, 51, 100], [76, 185, 101, 150], [186, 304, 151, 200], [305, 604, 201, 300], [605, 804, 301, 400], [805, 1004, 401, 500]],
  o3: [[0, 0.054, 0, 50], [0.055, 0.07, 51, 100], [0.071, 0.085, 101, 150], [0.086, 0.105, 151, 200], [0.106, 0.2, 201, 300], [0.201, 0.404, 301, 400], [0.405, 0.604, 401, 500]],
  co: [[0, 4.4, 0, 50], [4.5, 9.4, 51, 100], [9.5, 12.4, 101, 150], [12.5, 15.4, 151, 200], [15.5, 30.4, 201, 300], [30.5, 40.4, 301, 400], [40.5, 50.4, 401, 500]],
};

const GAS_MULTIPLIERS = {pm25: 1, pm10: 1, no2: 1.88, so2: 2.62, o3: 1960, co: 1.145};
const CONVERSION_FACTORS = {no2: 1.88, so2: 2.62, o3: 1.96, co: 1.145};
const POLLUTANT_KEYS = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];

/**
 * Calculates India NAQI sub-index for a given pollutant and concentration.
 * @param {string} key - Pollutant key ('pm25', 'pm10', etc.)
 * @param {number} concentration - Measured concentration
 * @returns {number | null} - Sub-index from 0 to 500
 */
export const naqi = (key, concentration) => {
  if (concentration == null || isNaN(concentration)) return null;
  const breakpoints = IN_BREAKPOINTS[key];
  if (!breakpoints) return null;
  const band = breakpoints.find(b => concentration <= b[1]) || breakpoints[breakpoints.length - 1];
  const [cLow, cHigh, iLow, iHigh] = band;
  const subIndex = Math.round(((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow);
  return Math.min(500, Math.max(0, subIndex));
};

/**
 * Inverts a US AQI sub-index into an estimated raw concentration in µg/m³ (CO in mg/m³).
 * @param {string} key - Pollutant key
 * @param {number} subIndex - US AQI sub-index
 * @returns {number | null} - Estimated concentration
 */
export function concFromUs(key, subIndex) {
  const breakpoints = US_BREAKPOINTS[key];
  if (!breakpoints || subIndex == null) return null;
  const band = breakpoints.find(b => subIndex <= b[3]) || breakpoints[breakpoints.length - 1];
  const [cLow, cHigh, iLow, iHigh] = band;
  const baseConc = ((subIndex - iLow) / (iHigh - iLow)) * (cHigh - cLow) + cLow;
  const multiplier = GAS_MULTIPLIERS[key] || 1;
  return Number((baseConc * multiplier).toFixed(2));
}

/**
 * Normalizes raw sensor readings with various units into standard units: µg/m³ (CO in mg/m³).
 * @param {string} key - Pollutant key
 * @param {number} value - Raw sensor reading value
 * @param {string} unit - Measurement unit ('ppm', 'ppb', 'µg/m³', etc.)
 * @returns {number}
 */
export function toConc(key, value, unit) {
  const u = (unit || '').toLowerCase();
  if (key === 'pm25' || key === 'pm10') return value;
  if (key === 'co') {
    if (u.includes('ppm')) return value * 1.145;
    if (u.includes('ppb')) return value * 0.001145;
    return value / 1000;
  }
  const factor = CONVERSION_FACTORS[key] || 1;
  if (u.includes('ppm')) return value * 1000 * factor;
  if (u.includes('ppb')) return value * factor;
  return value;
}

let activeStandard = 'us';

/** Get current active AQI standard */
export const getStandard = () => activeStandard;

/**
 * Set current active AQI standard ('in' for India NAQI, 'us' for US EPA).
 * @param {string} standard
 */
export const setStandard = standard => {
  activeStandard = standard === 'in' ? 'in' : 'us';
  setScale(activeStandard);
};

/**
 * Applies the active standard (US or India NAQI) to a standardized air report object.
 * Re-scores the overall AQI without requiring any new network calls.
 * @param {object} airReport
 * @returns {object} - Updated report with active AQI, standard, and sub-indices
 */
export function applyStandard(airReport) {
  const altNaqi = (() => {
    let maxSub = null;
    POLLUTANT_KEYS.forEach(key => {
      const pollutant = airReport.pollutants[key];
      if (pollutant && pollutant.conc != null) {
        const subIndex = naqi(key, pollutant.conc);
        if (subIndex != null && (maxSub == null || subIndex > maxSub)) {
          maxSub = subIndex;
        }
      }
    });
    return maxSub;
  })();

  if (activeStandard !== 'in') {
    return {
      ...airReport,
      std: 'us',
      usAqi: airReport.aqi,
      naqiAqi: altNaqi,
    };
  }

  const pollutants = {};
  let dominant = null;

  POLLUTANT_KEYS.forEach(key => {
    const pollutant = airReport.pollutants[key];
    if (!pollutant || pollutant.conc == null) return;
    const sub = naqi(key, pollutant.conc);
    pollutants[key] = {
      value: Number(pollutant.conc.toFixed(key === 'co' ? 2 : 1)),
      unit: key === 'co' ? 'mg/m³' : 'µg/m³',
      sub,
      conc: pollutant.conc,
    };
    if (sub != null && (!dominant || sub > dominant.sub)) {
      dominant = {key, sub};
    }
  });

  if (!dominant) {
    return {...airReport, std: 'us'};
  }

  return {
    ...airReport,
    std: 'in',
    usAqi: airReport.aqi,
    naqiAqi: dominant.sub,
    pollutants,
    aqi: dominant.sub,
    dominant: dominant.key,
    converted: Boolean(airReport.source && airReport.source.startsWith('WAQI')),
  };
}

/**
 * Calculates US EPA AQI index for a given pollutant and concentration.
 * @param {string} key - Pollutant key
 * @param {number} concentration - Pollutant concentration
 * @returns {number | null} - US EPA index from 0 to 500
 */
export const usIndex = (key, concentration) => {
  const breakpoints = US_BREAKPOINTS[key];
  if (concentration == null || !breakpoints) return null;
  const band = breakpoints.find(b => concentration <= b[1]) || breakpoints[breakpoints.length - 1];
  const [cLow, cHigh, iLow, iHigh] = band;
  const index = Math.round(((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow);
  return Math.min(500, Math.max(0, index));
};
