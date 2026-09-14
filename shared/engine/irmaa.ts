/**
 * Medicare IRMAA (Income-Related Monthly Adjustment Amount) for the
 * Monte Carlo RMD pass.
 *
 * 2026 tiers (CMS, premium year 2026, based on 2024 MAGI). Thresholds are
 * indexed to inflation by statute (the top tier's 500k / 750k line is
 * frozen through 2027 and indexed from 2028; treated as indexed here).
 * Surcharge dollar amounts track Part B premium growth, which the caller
 * approximates with the same index factor.
 *
 * MAGI for IRMAA = AGI + tax-exempt interest, and CMS looks back two tax
 * years. The kernel supplies the AGI proxy it already tracks (ordinary
 * income + conversions + forced RMD excess + taxable Social Security).
 */

import type { OrdinaryFilingStatus } from './ordinary-tax.js';

export const PART_B_STANDARD_2026 = 202.90;

/** Upper MAGI bound of each tier (tier 0 = standard). Last tier is open-ended. */
export const IRMAA_THRESHOLDS_2026: Record<OrdinaryFilingStatus, number[]> = {
  mfj:    [218000, 274000, 342000, 410000, 750000],
  single: [109000, 137000, 171000, 205000, 500000],
};

/** Monthly surcharge per person above the standard premium, by tier index 0..5. */
export const IRMAA_PART_B_SURCHARGE_2026 = [0, 81.20, 202.90, 324.60, 446.30, 487.00];
export const IRMAA_PART_D_SURCHARGE_2026 = [0, 14.50, 37.50, 60.40, 83.30, 91.00];

/** Tier index (0 = no surcharge) for a MAGI, thresholds scaled by indexFactor. */
export function irmaaTier(magi: number, filingStatus: OrdinaryFilingStatus, indexFactor = 1): number {
  const t = IRMAA_THRESHOLDS_2026[filingStatus];
  for (let i = 0; i < t.length; i++) {
    if (magi <= t[i] * indexFactor) return i;
  }
  return t.length;
}

/** Monthly surcharge per person for a tier, in 2026 dollars scaled by indexFactor. */
export function irmaaMonthlySurcharge(tier: number, includePartD = true, indexFactor = 1): number {
  const i = Math.max(0, Math.min(tier, IRMAA_PART_B_SURCHARGE_2026.length - 1));
  const b = IRMAA_PART_B_SURCHARGE_2026[i];
  const d = includePartD ? IRMAA_PART_D_SURCHARGE_2026[i] : 0;
  return (b + d) * indexFactor;
}