import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {getAirQuality, nextHours} from '../src/services/apiController.js';
import {setStandard} from '../src/services/standards.js';

// the mock station sits exactly where the app asks, so the 100 km station-distance guard is satisfied
const feed = url => { const [lat, lon] = decodeURIComponent(String(url).match(/geo:([^/?]+)/)?.[1] || '0;0').split(';').map(Number); return {status: 'ok', data: {aqi: 160, iaqi: {pm25: {v: 160}, pm10: {v: 90}}, city: {name: 'Test Station', geo: [lat, lon]}, time: {iso: new Date().toISOString()}}}; };
let fetchMock;
beforeEach(() => { fetchMock = vi.fn(async url => ({ok: true, json: async () => feed(url)})); vi.stubGlobal('fetch', fetchMock); setStandard('us'); });
afterEach(() => { vi.unstubAllGlobals(); setStandard('us'); });

describe('getAirQuality caching', () => {
  it('reuses a recent lookup and shares concurrent ones', async () => {
    const [a, b] = await Promise.all([getAirQuality(28.61, 77.21), getAirQuality(28.61, 77.21)]);
    expect(a.aqi).toBe(160); expect(b.aqi).toBe(160);
    await getAirQuality(28.61, 77.21);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('switching the AQI standard needs no new network call', async () => {
    await getAirQuality(19.07, 72.87);
    const calls = fetchMock.mock.calls.length;
    setStandard('in');
    const r = await getAirQuality(19.07, 72.87);
    expect(r.std).toBe('in'); expect(r.aqi).not.toBe(160);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
  it('force:true bypasses the cache', async () => {
    await getAirQuality(22.57, 88.36);
    await getAirQuality(22.57, 88.36, {force: true});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not cache failures', async () => {
    fetchMock.mockResolvedValue({ok: false, status: 500, json: async () => ({})});
    await expect(getAirQuality(13.08, 80.27)).rejects.toThrow();
    fetchMock.mockImplementation(async url => ({ok: true, json: async () => feed(url)}));
    expect((await getAirQuality(13.08, 80.27)).aqi).toBe(160);
  });
});

describe('nextHours', () => {
  const d = {utc_offset_seconds: 19800, hourly: {time: ['2026-11-21T06:00', '2026-11-21T07:00', '2026-11-21T08:00', '2026-11-21T09:00'], pm2_5: [10, 20, null, 40]}};
  it('converts location-local times with the UTC offset and skips past/null hours', () => {
    const now = Date.parse('2026-11-21T07:10:00+05:30');
    const rows = nextHours(d, now, 24);
    expect(rows.map(r => r.hour)).toEqual([7, 9]); // 06:00 is over an hour old, 08:00 has no value
    expect(rows[0].ts).toBe(Date.parse('2026-11-21T07:00:00+05:30'));
  });
  it('respects the requested number of hours and empty input', () => {
    expect(nextHours(d, 0, 2)).toHaveLength(2);
    expect(nextHours({}, 0, 5)).toEqual([]);
  });
});
