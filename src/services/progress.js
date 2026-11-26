/** Local-only tracking of completed clean-air actions: daily record, streak, running totals. */
const KEY = 'airintel.progress.v1';
const empty = () => ({days: {}});

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prevKey = key => { const [y, m, d] = key.split('-').map(Number); return todayKey(new Date(y, m - 1, d - 1)); };

export function loadProgress() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && typeof s.days === 'object' && s.days ? s : empty();
  } catch { return empty(); }
}
export const saveProgress = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

/** Immutable update: store the ids done on `key` (an empty list removes the day). */
export function recordDay(store, key, ids, co2 = 0) {
  const days = {...store.days};
  if (ids.length) days[key] = {done: [...new Set(ids)], co2: Math.max(0, Number(co2) || 0)}; else delete days[key];
  const keep = Object.keys(days).sort().slice(-120); // bounded history
  return {days: Object.fromEntries(keep.map(k => [k, days[k]]))};
}

/** Streak counts consecutive active days ending today (or yesterday, so an unfinished today doesn't reset it). */
export function stats(store, today = todayKey()) {
  const days = store.days || {};
  let streak = 0, k = days[today]?.done?.length ? today : prevKey(today);
  while (days[k]?.done?.length) { streak++; k = prevKey(k); }
  const vals = Object.values(days);
  return {
    streak, daysActive: vals.filter(v => v.done?.length).length,
    totalActions: vals.reduce((s, v) => s + (v.done?.length || 0), 0),
    totalCo2: Math.round(vals.reduce((s, v) => s + (v.co2 || 0), 0) * 10) / 10,
  };
}
