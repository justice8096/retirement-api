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
  dependentType: z.enum(['adult', 'child']).nullable().optional(),
  name: z.string().max(100).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2030),
  ssPia: z.number().min(0).max(50000).nullable().optional(),
  ssFra: z.number().int().min(62).max(70).nullable().optional(),
  ssClaimAge: z.number().int().min(62).max(75).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.role === 'dependent') return data.dependentType != null;
    return data.dependentType == null || data.dependentType === undefined;
  },
  { message: 'dependentType is required for dependents and must be null/omitted for non-dependents' }
);

const petSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  type: z.enum(['dog', 'cat', 'bird', 'rabbit', 'fish', 'horse', 'reptile']).default('dog'),
  breed: z.string().max(100).nullable().optional(),
  size: z.enum(['small', 'medium', 'large']).nullable().optional(),
  weight: z.number().int().min(1).max(2500).nullable().optional(),
  feedingMode: z.enum(['commercial', 'homemade']).nullable().optional(),
  birthYear: z.number().int().min(2000).max(2030),
  expectedLifespan: z.number().int().min(1).max(50).default(12),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.feedingMode != null) return data.type === 'dog' || data.type === 'cat';
    return true;
  },
  { message: 'feedingMode is only supported for dogs and cats' }
);

const scenarioSchema = z.object({
  name: z.string().min(1).max(200),
  scenarioData: z.record(z.unknown()),
}).strict();

// ─── Weight tier derivation (replicated from household.ts) ───────────────
function deriveWeightTier(type: string, weight: number | null | undefined): string | null {
  if (type !== 'dog' || !weight) return null;
  if (weight < 25) return 'small';
  if (weight <= 50) return 'medium';
  if (weight <= 100) return 'large';
  return 'giant';
}

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

  // ─── Dependent type tests ───────────────────────────────────────────
  it('accepts dependent with dependentType=adult', () => {
    const result = memberSchema.safeParse({
      role: 'dependent',
      dependentType: 'adult',
      name: 'Mom',
      birthYear: 1940,
    });
    expect(result.success).toBe(true);
  });

  it('accepts dependent with dependentType=child', () => {
    const result = memberSchema.safeParse({
      role: 'dependent',
      dependentType: 'child',
      name: 'Junior',
      birthYear: 2010,
    });
    expect(result.success).toBe(true);
  });

  it('rejects dependent without dependentType', () => {
    const result = memberSchema.safeParse({
      role: 'dependent',
      name: 'Unknown',
      birthYear: 1990,
    });
    expect(result.success).toBe(false);
  });

  it('rejects primary with dependentType set', () => {
    const result = memberSchema.safeParse({
      role: 'primary',
      dependentType: 'adult',
      birthYear: 1966,
    });
    expect(result.success).toBe(false);
  });

  it('rejects spouse with dependentType set', () => {
    const result = memberSchema.safeParse({
      role: 'spouse',
      dependentType: 'child',
      birthYear: 1966,
    });
    expect(result.success).toBe(false);
  });

  it('accepts primary without dependentType (backward compat)', () => {
    const result = memberSchema.safeParse({
      role: 'primary',
      birthYear: 1966,
      ssPia: 2400,
    });
    expect(result.success).toBe(true);
  });
});

describe('petSchema', () => {
  it('accepts dog with weight and name', () => {
    const result = petSchema.safeParse({
      name: 'Luna',
      type: 'dog',
      breed: 'Bernese Mountain Dog',
      weight: 110,
      birthYear: 2022,
      expectedLifespan: 11,
    });
    expect(result.success).toBe(true);
  });

  it('accepts cat without weight', () => {
    const result = petSchema.safeParse({
      name: 'Milo',
      type: 'cat',
      birthYear: 2023,
      expectedLifespan: 16,
    });
    expect(result.success).toBe(true);
  });

  it('accepts legacy payload (no name, no weight, no sortOrder)', () => {
    const result = petSchema.safeParse({
      type: 'dog',
      breed: 'Labrador',
      size: 'large',
      birthYear: 2020,
      expectedLifespan: 12,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all 7 pet types', () => {
    for (const type of ['dog', 'cat', 'bird', 'rabbit', 'fish', 'horse', 'reptile']) {
      expect(petSchema.safeParse({ type, birthYear: 2020 }).success).toBe(true);
    }
  });

  it('rejects unknown pet type', () => {
    const result = petSchema.safeParse({
      type: 'parrot',
      birthYear: 2020,
    });
    expect(result.success).toBe(false);
  });

  it('rejects weight below 1', () => {
    const result = petSchema.safeParse({
      type: 'dog',
      weight: 0,
      birthYear: 2020,
    });
    expect(result.success).toBe(false);
  });

  it('rejects weight above 2500', () => {
    const result = petSchema.safeParse({
      type: 'horse',
      weight: 2501,
      birthYear: 2020,
    });
    expect(result.success).toBe(false);
  });

  it('accepts weight at boundaries', () => {
    expect(petSchema.safeParse({ type: 'dog', weight: 1, birthYear: 2020 }).success).toBe(true);
    expect(petSchema.safeParse({ type: 'horse', weight: 2500, birthYear: 2020 }).success).toBe(true);
  });

  it('accepts horse with high weight and long lifespan', () => {
    const result = petSchema.safeParse({
      type: 'horse',
      weight: 1200,
      birthYear: 2015,
      expectedLifespan: 30,
    });
    expect(result.success).toBe(true);
  });

  it('accepts lifespan up to 50', () => {
    expect(petSchema.safeParse({ type: 'bird', birthYear: 2020, expectedLifespan: 50 }).success).toBe(true);
    expect(petSchema.safeParse({ type: 'bird', birthYear: 2020, expectedLifespan: 51 }).success).toBe(false);
  });

  it('accepts feedingMode for dogs and cats', () => {
    expect(petSchema.safeParse({ type: 'dog', feedingMode: 'homemade', birthYear: 2020 }).success).toBe(true);
    expect(petSchema.safeParse({ type: 'dog', feedingMode: 'commercial', birthYear: 2020 }).success).toBe(true);
    expect(petSchema.safeParse({ type: 'cat', feedingMode: 'homemade', birthYear: 2020 }).success).toBe(true);
  });

  it('rejects feedingMode for non-dog/cat types', () => {
    expect(petSchema.safeParse({ type: 'bird', feedingMode: 'commercial', birthYear: 2020 }).success).toBe(false);
    expect(petSchema.safeParse({ type: 'horse', feedingMode: 'homemade', birthYear: 2020 }).success).toBe(false);
    expect(petSchema.safeParse({ type: 'fish', feedingMode: 'commercial', birthYear: 2020 }).success).toBe(false);
  });

  it('accepts null feedingMode for any type', () => {
    expect(petSchema.safeParse({ type: 'bird', feedingMode: null, birthYear: 2020 }).success).toBe(true);
    expect(petSchema.safeParse({ type: 'dog', feedingMode: null, birthYear: 2020 }).success).toBe(true);
  });

  it('defaults type to dog when omitted', () => {
    const result = petSchema.safeParse({ birthYear: 2022 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('dog');
    }
  });

  it('defaults expectedLifespan to 12 when omitted', () => {
    const result = petSchema.safeParse({ birthYear: 2022 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedLifespan).toBe(12);
    }
  });
});

describe('deriveWeightTier', () => {
  it('returns null for non-dog types', () => {
    expect(deriveWeightTier('cat', 10)).toBeNull();
    expect(deriveWeightTier('horse', 1000)).toBeNull();
    expect(deriveWeightTier('bird', 2)).toBeNull();
  });

  it('returns null for dogs without weight', () => {
    expect(deriveWeightTier('dog', null)).toBeNull();
    expect(deriveWeightTier('dog', undefined)).toBeNull();
  });

  it('maps weight boundaries correctly', () => {
    expect(deriveWeightTier('dog', 1)).toBe('small');
    expect(deriveWeightTier('dog', 24)).toBe('small');
    expect(deriveWeightTier('dog', 25)).toBe('medium');
    expect(deriveWeightTier('dog', 50)).toBe('medium');
    expect(deriveWeightTier('dog', 51)).toBe('large');
    expect(deriveWeightTier('dog', 100)).toBe('large');
    expect(deriveWeightTier('dog', 101)).toBe('giant');
    expect(deriveWeightTier('dog', 200)).toBe('giant');
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
