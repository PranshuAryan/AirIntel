import {INFILTRATION, PURIFIER_CUT} from './plan.js';
export const ACH_TARGET = 4.8; // air changes per hour behind the common "CADR >= 2/3 of floor area in ft2" purifier sizing rule
const clamp = (x, lo, hi, d) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Clean-air delivery rate a purifier needs for a room. */
export function requiredCadr({length, width, height = 2.7}) {
  const l = clamp(length, 1, 30, 4), w = clamp(width, 1, 30, 3.5), h = clamp(height, 2, 5, 2.7), volume = l * w * h;
  return {area: Math.round(l * w * 10) / 10, volume: Math.round(volume * 10) / 10, m3h: Math.round(volume * ACH_TARGET), cfm: Math.round((volume * ACH_TARGET) / 1.699)};
}
export const indoorEstimate = pm => (pm == null ? null : {closed: Math.round(pm * INFILTRATION), purified: Math.round(pm * INFILTRATION * (1 - PURIFIER_CUT))});
export const DIY_STEPS = [
  'Buy a 20-inch box fan and four 20 x 20 x 1 inch MERV-13 filters (check the airflow arrows on the filters).',
  'Tape the four filters into a cube, airflow arrows pointing inward, with the open side facing up.',
  'Place the fan on top so it pulls air through the filters, and seal the joins with strong tape.',
  'Cover any gaps in the cube with cardboard or tape so all the air goes through the filters.',
  'Run it in the room you use most, away from curtains and anything flammable, and never leave it covered.',
  'Check the filters monthly on smoggy days and replace them when visibly dark or clogged.',
];
