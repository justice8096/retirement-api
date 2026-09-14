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
export declare const PART_B_STANDARD_2026 = 202.9;
/** Upper MAGI bound of each tier (tier 0 = standard). Last tier is open-ended. */
export declare const IRMAA_THRESHOLDS_2026: Record<OrdinaryFilingStatus, number[]>;
/** Monthly surcharge per person above the standard premium, by tier index 0..5. */
export declare const IRMAA_PART_B_SURCHARGE_2026: number[];
export declare const IRMAA_PART_D_SURCHARGE_2026: number[];
/** Tier index (0 = no surcharge) for a MAGI, thresholds scaled by indexFactor. */
export declare function irmaaTier(magi: number, filingStatus: OrdinaryFilingStatus, indexFactor?: number): number;
/** Monthly surcharge per person for a tier, in 2026 dollars scaled by indexFactor. */
export declare function irmaaMonthlySurcharge(tier: number, includePartD?: boolean, indexFactor?: number): number;
