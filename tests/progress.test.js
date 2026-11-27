import {describe, it, expect} from 'vitest';
import {recordDay, stats, todayKey, loadProgress, saveProgress} from '../src/services/progress.js';

describe('progress tracking', () => {
  it('formats local dates', () => { expect(todayKey(new Date(2026, 10, 5))).toBe('2026-11-05'); });
  it('counts consecutive days as a streak, including across a month boundary', () => {
    let s = {days: {}};
    for (const d of ['2026-10-30', '2026-10-31', '2026-11-01']) s = recordDay(s, d, ['a'], 2);
    expect(stats(s, '2026-11-01').streak).toBe(3);
  });
  it('keeps the streak alive until today is done, but breaks it after a missed day', () => {
    const s = recordDay(recordDay({days: {}}, '2026-11-01', ['a']), '2026-11-02', ['a']);
    expect(stats(s, '2026-11-03').streak).toBe(2);
    expect(stats(s, '2026-11-04').streak).toBe(0);
  });
  it('totals actions and CO2, de-duplicates ids and drops emptied days', () => {
    let s = recordDay({days: {}}, '2026-11-01', ['a', 'a', 'b'], 2.4);
    s = recordDay(s, '2026-11-02', ['c'], 1.1);
    expect(stats(s, '2026-11-02')).toMatchObject({totalActions: 3, totalCo2: 3.5, daysActive: 2});
    expect(Object.keys(recordDay(s, '2026-11-02', []).days)).toEqual(['2026-11-01']);
  });
  it('bounds stored history', () => {
    let s = {days: {}};
    for (let i = 1; i <= 150; i++) s = recordDay(s, `2026-01-${String(i).padStart(3, '0')}`, ['a']);
    expect(Object.keys(s.days)).toHaveLength(120);
  });
  it('does not mutate its input', () => {
    const s = {days: {}}; recordDay(s, '2026-11-01', ['a']); expect(s.days).toEqual({});
  });
});

describe('loadProgress / saveProgress', () => {
  it('returns an empty store when localStorage has no data', () => {
    localStorage.clear();
    const s = loadProgress();
    expect(s).toMatchObject({days: {}});
  });

  it('returns an empty store for corrupt JSON in localStorage', () => {
    localStorage.setItem('airintel.progress.v1', 'BROKEN{{{');
    expect(loadProgress()).toMatchObject({days: {}});
  });

  it('returns an empty store when days is not an object', () => {
    localStorage.setItem('airintel.progress.v1', JSON.stringify({days: 'bad'}));
    expect(loadProgress()).toMatchObject({days: {}});
  });

  it('round-trips a store through saveProgress and loadProgress', () => {
    localStorage.clear();
    let s = {days: {}};
    s = recordDay(s, '2026-11-01', ['mask_n95', 'close_windows'], 1.2);
    saveProgress(s);
    const loaded = loadProgress();
    expect(loaded.days['2026-11-01'].done).toEqual(['mask_n95', 'close_windows']);
    expect(loaded.days['2026-11-01'].co2).toBeCloseTo(1.2, 1);
  });
});
