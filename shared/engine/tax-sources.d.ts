import type { Source, TaxBracket } from './types.js';
/**
 * 2026 US federal bracket tables — mirrors `FED_BRACKETS_2026_MFJ` /
 * `_SINGLE` in retirement-api/shared/taxes.js. Used by TaxService as a
 * fallback when a US location's seed data doesn't carry federal
 * brackets (most US locations don't — they ship a single monthly
 * stored value). Keep both sides in sync.
 */
export declare const FED_BRACKETS_2026_MFJ: TaxBracket[];
export declare const FED_BRACKETS_2026_SINGLE: TaxBracket[];
/** 2026 standard deduction by filing status (Rev. Proc. 2025-32 § 3.17). */
export declare const FED_STD_DEDUCTION_2026: {
    readonly mfj: 32200;
    readonly single: 16100;
    readonly hoh: 24150;
};
/**
 * Structured citations for the 2026 US federal tax constants used on
 * the taxes screen and in Monte Carlo.
 *
 * NOTE — mirrors the equivalent exports in `retirement-api/shared/taxes.js`
 * (`FED_BRACKETS_2026_SOURCES`, `FED_STD_DEDUCTION_2026_SOURCES`,
 * `OBBBA_SENIOR_SOURCES`). The dashboard and API don't share a workspace
 * package today, so these are copied. Keep both sides in sync when
 * updating URLs or adding years.
 */
export declare const FED_BRACKETS_2026_SOURCES: Source[];
export declare const FED_STD_DEDUCTION_2026_SOURCES: Source[];
export declare const OBBBA_SENIOR_SOURCES: Source[];
/** Social Security Trust Fund depletion projection. */
export declare const SS_CUT_SOURCES: Source[];
/**
 * 2026 LTCG / qualified-dividend bracket thresholds. Mirrors
 * `LTCG_BRACKETS_2026` in retirement-api/shared/taxes.js. The 0%
 * bracket is the harvesting opportunity surfaced by the panel
 * on the Roth screen — early retirees in the Roth-conversion
 * phase often leave $10–30k of headroom on the table each year.
 */
export declare const LTCG_BRACKETS_2026: {
    readonly single: {
        readonly zeroTop: 49450;
        readonly fifteenTop: 545500;
    };
    readonly mfj: {
        readonly zeroTop: 98900;
        readonly fifteenTop: 613700;
    };
    readonly mfs: {
        readonly zeroTop: 49450;
        readonly fifteenTop: 306850;
    };
    readonly hoh: {
        readonly zeroTop: 66200;
        readonly fifteenTop: 579600;
    };
};
export type LtcgFilingStatus = keyof typeof LTCG_BRACKETS_2026;
export declare const LTCG_BRACKETS_2026_SOURCES: Source[];
export interface LtcgHarvestingSummary {
    filingStatus: LtcgFilingStatus;
    zeroTop: number;
    fifteenTop: number;
    alreadyPreferential: number;
    zeroBracketHeadroom: number;
    fifteenBracketHeadroom: number;
    currentMarginalRate: 0 | 0.15 | 0.20;
}
/**
 * Dollars of LTCG/QDI realizable at 0% federal tax this year, given
 * the household's ordinary taxable income and any preferential
 * income already realized. Returns 0 when ordinary alone already
 * exceeds the 0% bracket top.
 *
 * Mirrors `ltcgZeroBracketHeadroom` in retirement-api/shared/taxes.js.
 */
export declare function ltcgZeroBracketHeadroom(ordinaryTaxableIncome: number, filingStatus: LtcgFilingStatus, alreadyPreferential?: number): number;
/**
 * Structured snapshot for the harvesting advisor: how much room
 * remains in each LTCG bracket and what rate applies to the next $1.
 *
 * Mirrors `ltcgHarvestingSummary` in retirement-api/shared/taxes.js.
 */
export declare function ltcgHarvestingSummary(ordinaryTaxableIncome: number, filingStatus: LtcgFilingStatus, alreadyPreferential?: number): LtcgHarvestingSummary;
/**
 * Federal LTCG tax on a long-term capital gain, given filing status and
 * ordinary taxable income. Stacked-on-ordinary semantics per IRC § 1(h):
 * the gain `L` sits on top of ordinary income `O`, and the LTCG bracket
 * tops apply to the combined stack.
 *
 *   - 0% bracket: portion of L that fits below `zeroTop − O`
 *   - 20% bracket: portion of L that pushes the combined above `fifteenTop`
 *   - 15% bracket: the remainder
 *
 * Mirrors `ltcgFederalTax` in retirement-api/shared/taxes.js. Returns 0
 * for non-positive gain. Does NOT include NIIT (separate 3.8% surtax) or
 * state-level LTCG.
 */
export declare function ltcgFederalTax(ltcgIncome: number, ordinaryTaxableIncome: number, filingStatus: LtcgFilingStatus): number;
/** SECURE 2.0 RMD start ages. */
export declare const RMD_AGE_SOURCES: Source[];
/**
 * Residential rental real property — straight-line depreciation life
 * under MACRS (IRC § 168(c)). Commercial real property is 39-year and
 * is not modeled in v1 of Todo #29.
 *
 * Used by `rental-income.ts` helpers; surfaced as a citation on the
 * Schedule E breakdown panel.
 */
export declare const RENTAL_RESIDENTIAL_DEPRECIATION_LIFE_YEARS = 27.5;
export declare const RENTAL_DEPRECIATION_SOURCES: Source[];
export declare const RENTAL_SCHEDULE_E_SOURCES: Source[];
