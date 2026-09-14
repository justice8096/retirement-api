import { describe, it, expect } from 'vitest';
import { irmaaTier, irmaaMonthlySurcharge } from '../../engine/irmaa.js';

describe('irmaaTier (2026 CMS thresholds)', () => {
  it('maps MAGI to tiers for joint and single filers', () => {
    expect(irmaaTier(218_000, 'mfj')).toBe(0);
    expect(irmaaTier(218_001, 'mfj')).toBe(1);
    expect(irmaaTier(342_000, 'mfj')).toBe(2);
    expect(irmaaTier(750_001, 'mfj')).toBe(5);
    expect(irmaaTier(109_000, 'single')).toBe(0);
    expect(irmaaTier(200_000, 'single')).toBe(3);
  });
  it('scales thresholds by the index factor', () => {
    expect(irmaaTier(400_000, 'mfj', 2)).toBe(0);
    expect(irmaaTier(440_000, 'mfj', 2)).toBe(1);
  });
});

describe('irmaaMonthlySurcharge', () => {
  it('adds Part B and Part D surcharges per tier', () => {
    expect(irmaaMonthlySurcharge(0)).toBe(0);
    expect(irmaaMonthlySurcharge(1)).toBeCloseTo(95.70, 6);
    expect(irmaaMonthlySurcharge(1, false)).toBeCloseTo(81.20, 6);
    expect(irmaaMonthlySurcharge(3, true, 2)).toBeCloseTo(770, 6);
    expect(irmaaMonthlySurcharge(99)).toBeCloseTo(578, 6);
  });
});