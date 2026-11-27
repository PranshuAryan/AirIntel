/**
 * AQI scales, classification levels, formatting utilities, and pollutant constants.
 */

/** US EPA AQI breakpoints, category labels, badge colors, and health guidance text */
const US_LEVELS = [
  [50, 'Good', '#00e400', 'Air quality is satisfactory.', '#15803d'],
  [100, 'Moderate', '#ffff00', 'Unusually sensitive people should limit prolonged exertion.', '#a16207'],
  [150, 'Unhealthy for Sensitive Groups', '#ff7e00', 'Sensitive groups may feel effects.', '#c2410c'],
  [200, 'Unhealthy', '#ff0000', 'Everyone may begin to feel effects.', '#b91c1c'],
  [300, 'Very Unhealthy', '#8f3f97', 'Health alert: serious effects for everyone.', '#7e22ce'],
  [Infinity, 'Hazardous', '#7e0023', 'Emergency conditions: avoid all outdoor exertion.', '#7e0023'],
];

/** India CPCB NAQI breakpoints, category labels, badge colors, and health advisory text */
const IN_LEVELS = [
  [50, 'Good', '#00b050', 'Minimal impact.', '#166534'],
  [100, 'Satisfactory', '#8bc34a', 'Minor breathing discomfort to sensitive people.', '#4d7c0f'],
  [200, 'Moderate', '#f5d90a', 'Breathing discomfort to people with lung or heart disease, children and older adults.', '#a16207'],
  [300, 'Poor', '#f58220', 'Breathing discomfort to most people on prolonged exposure.', '#c2410c'],
  [400, 'Very Poor', '#e53935', 'Respiratory illness on prolonged exposure.', '#b91c1c'],
  [Infinity, 'Severe', '#8b1a1a', 'Affects healthy people and seriously impacts those with existing illness.', '#7f1d1d'],
];

export let LV = US_LEVELS;
export let SCALE = 'us';

/**
 * Configure the active AQI scale ('in' for India NAQI, 'us' for US EPA).
 * @param {'in' | 'us'} standard
 */
export const setScale = standard => {
  SCALE = standard === 'in' ? 'in' : 'us';
  LV = SCALE === 'in' ? IN_LEVELS : US_LEVELS;
};

export const getScale = () => SCALE;

/**
 * Returns the classification details (name, color, note, text color) for a given AQI value.
 * @param {number} aqi
 * @returns {{name: string, color: string, note: string, text: string}}
 */
export const lv = aqi => {
  const level = LV.find(item => aqi <= item[0]) || LV[5];
  return {
    name: level[1],
    color: level[2],
    note: level[3],
    text: level[4],
  };
};

/** Pollutant key to standard chemical symbol mapping */
export const NAMES = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  o3: 'O₃',
};

/**
 * Formats an ISO date string into human-readable relative time (e.g. '5 min ago').
 * @param {string} iso
 * @returns {string}
 */
export const ago = iso => {
  const diffMinutes = Math.round((Date.now() - new Date(iso)) / 60000);
  if (isNaN(diffMinutes)) return '';
  if (diffMinutes < -60) return 'time unverified';
  const minutes = Math.max(0, diffMinutes);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours} h ${remMinutes} min ago`;
  }
  return `${Math.floor(minutes / 1440)} d ago`;
};

/**
 * Formats an ISO date string into a localized short date and time.
 * @param {string} iso
 * @returns {string}
 */
export const fmt = iso => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return String(iso);
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};
