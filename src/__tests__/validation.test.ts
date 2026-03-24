import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests for Zod validation schemas used across routes.
 * These test the schemas in isolation (no database or server needed).
 */

// Replicate schemas from routes for isolated testing
const financialSchema = z.object({
  portfolioBalance: z.number().min(0).max(100_000_000).optional(),
  fxDriftEnabled: z.boolean().optional(),
  fxDriftAnnualRate: z.number().min(-0.1).max(0.2).optional(),
  ssCutEnabled: z.boolean().optional(),
  ssCutYear: z.number().int().min(2025).max(2050).optional(),
  ssCola: z.number().min(0).max(10).optional(),
}).strict();

const memberSchema = z.object({
  role: z.enum(['primary', 'spouse', 'dependent']).default('primary'),
  name: z.string().max(100).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2030),
  ssPia: z.number().min(0).max(50000).nullable().optional(),
  ssFra: z.number().int().min(62).max(70).nullable().optional(),
  ssClaimAge: z.number().int().min(62).max(75).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

const scenarioSchema = z.object({
  name: z.string().min(1).max(200),
  scenarioData: z.record(z.unknown()),
}).strict();

describe('financialSchema', () => {
  it('accepts valid partial update', () => {
    const result = financialSchema.safeParse({ portfolioBalance: 750000 });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = financialSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative portfolio balance', () => {
    const result = financialSchema.safeParse({ portfolioBalance: -1000 });
    expect(result.success).toBe(false);
  });

  it('rejects portfolio over 100M', () => {
    const result = financialSchema.safeParse({ portfolioBalance: 200_000_000 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    const result = financialSchema.safeParse({ portfolioBalance: 1000, hackerField: true });
    expect(result.success).toBe(false);
  });

  it('validates ssCutYear range', () => {
    expect(financialSchema.safeParse({ ssCutYear: 2024 }).success).toBe(false);
    expect(financialSchema.safeParse({ ssCutYear: 2033 }).success).toBe(true);
    expect(financialSchema.safeParse({ ssCutYear: 2051 }).success).toBe(false);
  });

  it('validates fxDriftAnnualRate range', () => {
    expect(financialSchema.safeParse({ fxDriftAnnualRate: -0.2 }).success).toBe(false);
    expect(financialSchema.safeParse({ fxDriftAnnualRate: 0.01 }).success).toBe(true);
    expect(financialSchema.safeParse({ fxDriftAnnualRate: 0.3 }).success).toBe(false);
  });
});

describe('memberSchema', () => {
  it('accepts valid member', () => {
    const result = memberSchema.safeParse({
      role: 'primary',
      name: 'John',
      birthYear: 1966,
      ssPia: 2400,
      ssFra: 67,
      ssClaimAge: 67,
    });
    expect(result.success).toBe(true);
  });

  it('rejects birth year before 1920', () => {
    const result = memberSchema.safeParse({ birthYear: 1900 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = memberSchema.safeParse({ role: 'child', birthYear: 2000 });
    expect(result.success).toBe(false);
  });

  it('accepts null optional fields', () => {
    const result = memberSchema.safeParse({
      birthYear: 1966,
      ssPia: null,
      ssFra: null,
      name: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects ssPia over 50000', () => {
    const result = memberSchema.safeParse({ birthYear: 1966, ssPia: 60000 });
    expect(result.success).toBe(false);
  });

  it('validates ssClaimAge range 62-75', () => {
    expect(memberSchema.safeParse({ birthYear: 1966, ssClaimAge: 61 }).success).toBe(false);
    expect(memberSchema.safeParse({ birthYear: 1966, ssClaimAge: 62 }).success).toBe(true);
    expect(memberSchema.safeParse({ birthYear: 1966, ssClaimAge: 75 }).success).toBe(true);
    expect(memberSchema.safeParse({ birthYear: 1966, ssClaimAge: 76 }).success).toBe(false);
  });
});

describe('scenarioSchema', () => {
  it('accepts valid scenario', () => {
    const result = scenarioSchema.safeParse({
      name: 'Optimistic',
      scenarioData: { returnRate: 0.07, inflationRate: 0.025 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = scenarioSchema.safeParse({ name: '', scenarioData: {} });
    expect(result.success).toBe(false);
  });

  it('rejects name over 200 chars', () => {
    const result = scenarioSchema.safeParse({ name: 'x'.repeat(201), scenarioData: {} });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    const result = scenarioSchema.safeParse({
      name: 'Test',
      scenarioData: {},
      extra: 'field',
    });
    expect(result.success).toBe(false);
  });

  it('accepts complex nested scenarioData', () => {
    const result = scenarioSchema.safeParse({
      name: 'Full scenario',
      scenarioData: {
        monteCarlo: { runs: 10000, returnMean: 0.07 },
        events: [
          { year: 2030, type: 'ss-cut', amount: 0.23 },
          { year: 2035, type: 'market-crash', severity: 'moderate' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});
