/**
 * Medicare IRMAA (Income-Related Monthly Adjustment Amount) for the
 * Monte Carlo RMD pass.
 *
 * 2027 tiers (CMS fact sheet, Nov 17 2026: premium year 2027, based on 2025
 * MAGI) drive the kernel; the 2026 tables stay exported for reference. Thresholds are
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

/** 2027 Part B standard premium and IRMAA tables, CMS fact sheet "2027 Medicare
 *  Parts A & B Premiums and Deductibles" (Nov 17 2026):
 *  https://www.cms.gov/newsroom/fact-sheets/2027-medicare-parts-b-premiums-deductibles */
export const IRMAA_TABLE_YEAR = 2027;
export const PART_B_STANDARD_2027 = 209.40;
export const PART_B_DEDUCTIBLE_2027 = 292;
export const IRMAA_THRESHOLDS_2027: Record<OrdinaryFilingStatus, number[]> = {
  mfj:    [224000, 282000, 354000, 424000, 750000],
  single: [112000, 141000, 177000, 212000, 500000],
};
export const IRMAA_PART_B_SURCHARGE_2027 = [0, 83.70, 209.40, 335.00, 460.60, 502.40];
export const IRMAA_PART_D_SURCHARGE_2027 = [0, 15.40, 39.70, 64.00, 88.30, 96.40];

/** Tier index (0 = no surcharge) for a MAGI, thresholds scaled by indexFactor. */
export function irmaaTier(magi: number, filingStatus: OrdinaryFilingStatus, indexFactor = 1): number {
  const t = IRMAA_THRESHOLDS_2027[filingStatus];
  for (let i = 0; i < t.length; i++) {
    if (magi <= t[i] * indexFactor) return i;
  }
  return t.length;
}

/** Monthly surcharge per person for a tier, in 2027 dollars scaled by indexFactor. */
export function irmaaMonthlySurcharge(tier: number, includePartD = true, indexFactor = 1): number {
  const i = Math.max(0, Math.min(tier, IRMAA_PART_B_SURCHARGE_2027.length - 1));
  const b = IRMAA_PART_B_SURCHARGE_2027[i];
  const d = includePartD ? IRMAA_PART_D_SURCHARGE_2027[i] : 0;
  return (b + d) * indexFactor;
}