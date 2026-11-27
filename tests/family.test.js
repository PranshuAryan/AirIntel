import {describe, it, expect} from 'vitest';
import {sanitizeMember, vulnerability, riskLevel, dose, assess, SAMPLE, GROUPS, loadFamily, saveFamily} from '../src/services/family.js';
import {requiredCadr, indoorEstimate} from '../src/services/indoor.js';

describe('family exposure', () => {
  const toddler = sanitizeMember({name: 'Aarav', group: 'toddler', outdoorHours: 1}), senior = sanitizeMember({group: 'senior', conditions: ['resp', 'heart']}), adult = sanitizeMember({group: 'adult'});
  it('sanitises untrusted member input', () => {
    const m = sanitizeMember({name: '<b>Bob</b>{x}'.padEnd(60, 'z'), group: 'alien', conditions: ['resp', 'hack'], outdoorHours: 99, id: '../x'});
    expect(m.name).not.toMatch(/[<>{}]/); expect(m.name.length).toBeLessThanOrEqual(24);
    expect(m.group).toBe('adult'); expect(m.conditions).toEqual(['resp']); expect(m.outdoorHours).toBe(12); expect(m.id).toMatch(/^[\w-]+$/);
    expect(sanitizeMember(null).name).toBe('Member');
  });
  it('weights vulnerability by age and conditions', () => {
    expect(vulnerability(adult)).toBe(0); expect(vulnerability(toddler)).toBe(2); expect(vulnerability(senior)).toBe(6);
  });
  it('rates the same air as riskier for vulnerable people', () => {
    expect(riskLevel(10, adult)).toBe('Low'); expect(riskLevel(30, adult)).toBe('Moderate'); expect(riskLevel(60, adult)).toBe('High'); expect(riskLevel(100, adult)).toBe('Severe');
    expect(riskLevel(30, senior)).toBe('Severe'); // same air, more vulnerable person
    expect(riskLevel(null, adult)).toBeNull();
  });
  it('computes dose as rate x concentration x time', () => {
    const d = dose(toddler, 200); // 8.5/24 m3/h x (1h x 200 + 23h x 100)
    expect(d.ug).toBe(Math.round((8.5 / 24) * (200 + 2300)));
    expect(dose(toddler, 200, {purifier: true}).ug).toBeLessThan(d.ug);
    expect(dose(toddler, 0).ug).toBe(0);
  });
  it('shows a saving when following the plan, scaling with pollution', () => {
    const a = assess(adult, 200), b = assess(adult, 50);
    expect(a.plan.ug).toBeLessThan(a.usual.ug); expect(a.savedPct).toBeGreaterThan(30); expect(a.saved).toBeGreaterThan(b.saved);
    expect(assess(adult, null)).toBeNull();
  });
  it('children and seniors inhale less in absolute terms than adults but are rated higher risk', () => {
    expect(GROUPS.toddler.m3day).toBeLessThan(GROUPS.adult.m3day);
    expect(['High', 'Severe']).toContain(assess(SAMPLE[1], 150).level);
  });
});

describe('indoor sizing', () => {
  it('sizes CADR from room volume at 4.8 air changes an hour', () => {
    const r = requiredCadr({length: 4, width: 5, height: 2.5});
    expect(r).toMatchObject({area: 20, volume: 50, m3h: 240}); expect(r.cfm).toBe(141);
  });
  it('clamps bad input to safe defaults', () => {
    expect(requiredCadr({length: -5, width: 'x', height: 999}).volume).toBeGreaterThan(0);
  });
  it('estimates indoor PM2.5', () => {
    expect(indoorEstimate(100)).toEqual({closed: 50, purified: 25}); expect(indoorEstimate(null)).toBeNull();
  });
});

describe('SAMPLE members', () => {
  it('all SAMPLE members are properly sanitized', () => {
    for (const m of SAMPLE) {
      expect(m.id).toMatch(/^[\w-]+$/);
      expect(m.name.length).toBeGreaterThan(0);
      expect(GROUPS[m.group]).toBeDefined();
      expect(m.outdoorHours).toBeGreaterThanOrEqual(0);
      expect(m.outdoorHours).toBeLessThanOrEqual(12);
    }
  });
});

describe('loadFamily / saveFamily', () => {
  it('round-trips a family list through localStorage', () => {
    const family = [
      {name: 'Child', group: 'child', conditions: [], outdoorHours: 2},
      {name: 'Elder', group: 'senior', conditions: ['resp'], outdoorHours: 1},
    ];
    saveFamily(family);
    const loaded = loadFamily();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('Child');
    expect(loaded[1].conditions).toEqual(['resp']);
  });

  it('returns an empty array when localStorage is empty or corrupt', () => {
    localStorage.clear();
    expect(loadFamily()).toEqual([]);
    localStorage.setItem('airintel.family.v1', 'NOT JSON');
    expect(loadFamily()).toEqual([]);
  });

  it('caps the saved list to 8 members', () => {
    const many = Array(12).fill({name: 'P', group: 'adult', conditions: [], outdoorHours: 2});
    saveFamily(many);
    expect(loadFamily()).toHaveLength(8);
  });
});
