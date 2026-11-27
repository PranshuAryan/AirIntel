import {describe, it, expect} from 'vitest';
import {requiredCadr, indoorEstimate, DIY_STEPS, ACH_TARGET} from '../src/services/indoor.js';

describe('requiredCadr', () => {
  it('computes area, volume, m3h and cfm for a standard room', () => {
    const r = requiredCadr({length: 4, width: 5, height: 2.5});
    expect(r).toMatchObject({area: 20, volume: 50, m3h: 240});
    expect(r.cfm).toBe(141); // Math.round(240 / 1.699)
  });

  it('uses default height of 2.7 m when not provided', () => {
    const r = requiredCadr({length: 4, width: 4});
    expect(r.volume).toBeCloseTo(4 * 4 * 2.7, 1);
  });

  it('clamps bad input (negative, non-numeric, out-of-range) to safe defaults', () => {
    const r = requiredCadr({length: -5, width: 'x', height: 999});
    // -5 → clamped to 1; 'x' → clamped to 3.5 (default w); 999 → clamped to 5 (max height)
    expect(r.volume).toBeGreaterThan(0);
    expect(r.volume).toBeLessThanOrEqual(30 * 30 * 5); // within max bounds
  });

  it('respects the max bound (30 m) for length and width', () => {
    const r = requiredCadr({length: 999, width: 999, height: 2.7});
    expect(r.area).toBe(900); // 30 * 30
  });

  it('ACH_TARGET drives the m3h calculation', () => {
    const r = requiredCadr({length: 4, width: 5, height: 2.5});
    expect(r.m3h).toBe(Math.round(r.volume * ACH_TARGET));
  });

  it('cfm converts correctly from volume and ACH_TARGET (÷ 1.699)', () => {
    const r = requiredCadr({length: 3, width: 3, height: 3});
    expect(r.cfm).toBe(Math.round((r.volume * ACH_TARGET) / 1.699));
  });
});

describe('indoorEstimate', () => {
  it('estimates closed-window and purified indoor PM2.5 from outdoor PM2.5', () => {
    // INFILTRATION=0.5, PURIFIER_CUT=0.5: closed=pm*0.5, purified=pm*0.5*0.5
    expect(indoorEstimate(100)).toEqual({closed: 50, purified: 25});
    expect(indoorEstimate(0)).toEqual({closed: 0, purified: 0});
  });

  it('returns null for null input', () => {
    expect(indoorEstimate(null)).toBeNull();
    expect(indoorEstimate(undefined)).toBeNull();
  });

  it('rounds the estimates to whole numbers', () => {
    const r = indoorEstimate(37);
    expect(Number.isInteger(r.closed)).toBe(true);
    expect(Number.isInteger(r.purified)).toBe(true);
  });
});

describe('DIY_STEPS', () => {
  it('is an array of non-empty instruction strings', () => {
    expect(Array.isArray(DIY_STEPS)).toBe(true);
    expect(DIY_STEPS.length).toBeGreaterThan(0);
    for (const step of DIY_STEPS) {
      expect(typeof step).toBe('string');
      expect(step.length).toBeGreaterThan(10);
    }
  });

  it('covers the key assembly steps (fan, filter, tape)', () => {
    const all = DIY_STEPS.join(' ').toLowerCase();
    expect(all).toMatch(/fan/);
    expect(all).toMatch(/filter/);
    expect(all).toMatch(/tape/);
  });
});
