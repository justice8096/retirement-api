/**
 * Tests the REAL memberSchema exported from routes/household.ts (the
 * validation.test.ts copies are deliberate replicas). Added with
 * ssClaimAgeMonths (month-precision SS claim age).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({ default: {} }));
vi.mock('../middleware/auth.js', () => ({ requireAuth: vi.fn() }));
vi.mock('../middleware/encryption.js', () => ({ encryptField: vi.fn(), decryptField: vi.fn() }));

import { memberSchema } from '../routes/household.js';

describe('memberSchema — ssClaimAgeMonths', () => {
  it('defaults to 0 months and accepts 0-11', () => {
    const parsed = memberSchema.parse({ birthYear: 1964, ssClaimAge: 67 });
    expect(parsed.ssClaimAgeMonths).toBe(0);
    expect(memberSchema.safeParse({ birthYear: 1964, ssClaimAge: 67, ssClaimAgeMonths: 11 }).success).toBe(true);
    expect(memberSchema.safeParse({ birthYear: 1964, ssClaimAge: 67, ssClaimAgeMonths: 4 }).success).toBe(true);
  });

  it('rejects out-of-range and fractional months', () => {
    expect(memberSchema.safeParse({ birthYear: 1964, ssClaimAgeMonths: 12 }).success).toBe(false);
    expect(memberSchema.safeParse({ birthYear: 1964, ssClaimAgeMonths: -1 }).success).toBe(false);
    expect(memberSchema.safeParse({ birthYear: 1964, ssClaimAgeMonths: 4.5 }).success).toBe(false);
  });
});
