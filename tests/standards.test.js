import {describe, it, expect} from 'vitest';
import {naqi, usIndex, concFromUs, toConc, applyStandard, setStandard, getStandard} from '../src/services/standards.js';

describe('India NAQI sub-index', () => {
  it('hits the CPCB category boundaries', () => {
    expect(naqi('pm25', 30)).toBe(50);
    expect(naqi('pm25', 60)).toBe(100);
    expect(naqi('pm25', 90)).toBe(200);
    expect(naqi('pm10', 100)).toBe(100);
    expect(naqi('pm10', 250)).toBe(200);
    expect(naqi('co', 2)).toBe(100);
  });
  it('interpolates inside a band and never exceeds 500', () => {
    expect(naqi('pm25', 100)).toBe(232);
    expect(naqi('pm25', 99999)).toBe(500);
  });
  it('returns null for missing input', () => {
    expect(naqi('pm25', null)).toBeNull();
    expect(naqi('pm25', NaN)).toBeNull();
  });
});

describe('US conversions', () => {
  it('converts a US sub-index back to a concentration and round-trips', () => {
    expect(concFromUs('pm25', 100)).toBeCloseTo(35.4, 1);
    for (const idx of [30, 80, 130, 155, 220, 320]) expect(Math.abs(usIndex('pm25', concFromUs('pm25', idx)) - idx)).toBeLessThanOrEqual(1);
  });
  it('normalises units to µg/m³ (CO in mg/m³)', () => {
    expect(toConc('pm25', 40, 'µg/m³')).toBe(40);
    expect(toConc('co', 1, 'ppm')).toBeCloseTo(1.145, 3);
    expect(toConc('no2', 100, 'ppb')).toBeCloseTo(188, 1);
    expect(toConc('co', 1500, 'µg/m³')).toBeCloseTo(1.5, 3);
  });
  it('toConc passes through µg/m³ gases unchanged', () => {
    // When unit is µg/m³ for a gas (not ppm/ppb), returns the value directly
    expect(toConc('no2', 50, 'µg/m³')).toBe(50);
    expect(toConc('so2', 80, 'µg/m³')).toBe(80);
  });
  it('toConc handles CO in ppb correctly', () => {
    // CO ppb: v * 0.001145
    expect(toConc('co', 1000, 'ppb')).toBeCloseTo(1.145, 3);
  });
  it('usIndex returns null for missing or unknown input', () => {
    expect(usIndex('pm25', null)).toBeNull();
    expect(usIndex('unknown_key', 50)).toBeNull();
  });
});

describe('setStandard / getStandard', () => {
  it('round-trips between us and in', () => {
    setStandard('in'); expect(getStandard()).toBe('in');
    setStandard('us'); expect(getStandard()).toBe('us');
  });
  it('ignores invalid values and defaults to us', () => {
    setStandard('in'); // set to in first
    setStandard('xyz'); // invalid — should default to us
    expect(getStandard()).toBe('us');
  });
});

describe('applyStandard', () => {
  const air = {source: 'OpenAQ Station', aqi: 160, pollutants: {pm25: {conc: 100, sub: 160}, pm10: {conc: 50, sub: 46}}};
  it('keeps the US reading unchanged in US mode', () => {
    setStandard('us');
    const r = applyStandard(air);
    expect(r.std).toBe('us'); expect(r.aqi).toBe(160);
  });
  it('re-scores with the worst NAQI sub-index in India mode', () => {
    setStandard('in');
    const r = applyStandard(air);
    expect(r.std).toBe('in'); expect(r.aqi).toBe(232); expect(r.dominant).toBe('pm25');
    expect(air.aqi).toBe(160); // input is not mutated
    setStandard('us');
  });
});
