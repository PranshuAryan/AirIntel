/**
 * Family exposure estimator. Deterministic and transparent: dose = breathing rate x PM2.5 x time, split into
 * outdoor and indoor hours. A planning aid, not a clinical measurement.
 */
import {INFILTRATION, PURIFIER_CUT, WHO_PM25_24H} from './plan.js';

// m3/day are rounded typical inhalation rates by age group (US EPA Exposure Factors Handbook style values); out = default outdoor hours; w = vulnerability weight
export const GROUPS = {
  toddler: {label: 'Toddler (0–5)', m3day: 8.5, out: 1, w: 2},
  child: {label: 'Child (6–12)', m3day: 11, out: 2, w: 1},
  teen: {label: 'Teen (13–17)', m3day: 14, out: 2, w: 0},
  adult: {label: 'Adult (18–64)', m3day: 16, out: 2, w: 0},
  senior: {label: 'Senior (65+)', m3day: 14, out: 1, w: 2},
};
export const CONDITIONS = {resp: ['Asthma / COPD', 2], heart: ['Heart condition', 2], pregnant: ['Pregnancy', 1]};
export const CIG_UG = 22; // rough rule of thumb: a 24 h average of 22 µg/m³ PM2.5 is often compared to one cigarette a day
export const PLAN_OUTDOOR_SHARE = 0.25; // following the plan: outdoor time cut to a quarter

const clean = (s, n) => Array.from(String(s ?? ''), ch => (ch.charCodeAt(0) < 32 || '<>{}'.includes(ch) ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim().slice(0, n);
let seq = 0;
export function sanitizeMember(m) {
  const o = m && typeof m === 'object' ? m : {}, group = GROUPS[o.group] ? o.group : 'adult', h = Number(o.outdoorHours);
  return {
    id: typeof o.id === 'string' && /^[\w-]{1,30}$/.test(o.id) ? o.id : `m${Date.now().toString(36)}${seq++}`,
    name: clean(o.name, 24) || 'Member', group,
    conditions: Array.isArray(o.conditions) ? o.conditions.filter(c => CONDITIONS[c]) : [],
    outdoorHours: Number.isFinite(h) ? Math.min(12, Math.max(0, Math.round(h * 2) / 2)) : GROUPS[group].out,
  };
}
export const SAMPLE = [
  {name: 'Aarav', group: 'toddler', conditions: [], outdoorHours: 1},
  {name: 'Grandfather', group: 'senior', conditions: ['resp', 'heart'], outdoorHours: 1},
  {name: 'Mother', group: 'adult', conditions: [], outdoorHours: 2},
  {name: 'Father', group: 'adult', conditions: [], outdoorHours: 3},
].map(sanitizeMember);

export const vulnerability = m => GROUPS[m.group].w + m.conditions.reduce((s, c) => s + CONDITIONS[c][1], 0);
export function riskLevel(pm, m) {
  if (pm == null) return null;
  const score = (pm / WHO_PM25_24H) * (1 + 0.25 * vulnerability(m));
  return score < 1 ? 'Low' : score < 2.5 ? 'Moderate' : score < 5 ? 'High' : 'Severe';
}
export function dose(m, pm, {purifier = false, plan = false} = {}) {
  const rate = GROUPS[m.group].m3day / 24, out = plan ? m.outdoorHours * PLAN_OUTDOOR_SHARE : m.outdoorHours, inn = 24 - out;
  const indoor = pm * INFILTRATION * (plan || purifier ? 1 - PURIFIER_CUT : 1);
  const ug = rate * (out * pm + inn * indoor), avg = ug / (rate * 24);
  return {ug: Math.round(ug), avg: Math.round(avg * 10) / 10, cigs: Math.round((avg / CIG_UG) * 10) / 10};
}
export function assess(m, pm, purifier = false) {
  if (pm == null) return null;
  const usual = dose(m, pm, {purifier}), plan = dose(m, pm, {plan: true});
  return {usual, plan, saved: usual.ug - plan.ug, savedPct: usual.ug ? Math.round((1 - plan.ug / usual.ug) * 100) : 0, level: riskLevel(pm, m), vuln: vulnerability(m)};
}

const KEY = 'airintel.family.v1';
export const loadFamily = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.slice(0, 8).map(sanitizeMember) : []; } catch { return []; } };
export const saveFamily = list => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8).map(sanitizeMember))); } catch { /* storage unavailable */ } };
