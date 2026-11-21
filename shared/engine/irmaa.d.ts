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
export declare const PART_B_STANDARD_2026 = 202.9;
/** Upper MAGI bound of each tier (tier 0 = standard). Last tier is open-ended. */
export declare const IRMAA_THRESHOLDS_2026: Record<OrdinaryFilingStatus, number[]>;
/** Monthly surcharge per person above the standard premium, by tier index 0..5. */
export declare const IRMAA_PART_B_SURCHARGE_2026: number[];
export declare const IRMAA_PART_D_SURCHARGE_2026: number[];
/** 2027 Part B standard premium and IRMAA tables, CMS fact sheet "2027 Medicare
 *  Parts A & B Premiums and Deductibles" (Nov 17 2026):
 *  https://www.cms.gov/newsroom/fact-sheets/2027-medicare-parts-b-premiums-deductibles */
export declare const IRMAA_TABLE_YEAR = 2027;
export declare const PART_B_STANDARD_2027 = 209.4;
export declare const PART_B_DEDUCTIBLE_2027 = 292;
export declare const IRMAA_THRESHOLDS_2027: Record<OrdinaryFilingStatus, number[]>;
export declare const IRMAA_PART_B_SURCHARGE_2027: number[];
export declare const IRMAA_PART_D_SURCHARGE_2027: number[];
/** Tier index (0 = no surcharge) for a MAGI, thresholds scaled by indexFactor. */
export declare function irmaaTier(magi: number, filingStatus: OrdinaryFilingStatus, indexFactor?: number): number;
/** Monthly surcharge per person for a tier, in 2027 dollars scaled by indexFactor. */
export declare function irmaaMonthlySurcharge(tier: number, includePartD?: boolean, indexFactor?: number): number;
