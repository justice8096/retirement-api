/**
 * Bracket-stacked federal ordinary-income tax for the Monte Carlo RMD /
 * Roth-conversion pass.
 *
 * The question the kernel needs answered each year is marginal, not total:
 * "how much extra federal tax does THIS forced RMD excess (or THIS
 * conversion) cost, given what the household already has in ordinary
 * income and Social Security?" So the helper computes
 *
 *   tax(base + extra) - tax(base)
 *
 * where both sides re-derive the taxable share of Social Security from
 * provisional income (IRC 86). That captures the "tax torpedo": an extra
 * dollar of IRA income can pull up to 85 cents of SS into taxable income
 * on top of itself.
 *
 * Constants are the 2026 tables in tax-sources.ts. Brackets and the
 * standard deduction are indexed by the caller-supplied `indexFactor`
 * (accumulated inflation since 2026); the SS provisional-income thresholds
 * are NOT indexed, matching statute (fixed since 1984 / 1994).
 *
 * Not modeled: state tax, the OBBBA 6,000 senior bonus (expires after
 * 2028 and phases out above 150k MFJ MAGI), NIIT, AMT.
 */
export type OrdinaryFilingStatus = 'mfj' | 'single';
/** 2026 additional standard deduction per qualifying 65+ individual
 *  (Rev. Proc. 2025-32 section 3.17(2)): 1,650 married, 2,050 single. */
export declare const FED_ADDL_STD_DEDUCTION_65_2026: {
    readonly mfj: 1650;
    readonly single: 2050;
};
/** IRC 86 provisional-income thresholds (statutory, not indexed). */
export declare const SS_PROVISIONAL_THRESHOLDS: {
    readonly mfj: {
        readonly base: 32000;
        readonly adjusted: 44000;
    };
    readonly single: {
        readonly base: 25000;
        readonly adjusted: 34000;
    };
};
export interface OrdinaryTaxInputs {
    /** Ordinary income other than Social Security (IRA draws, pension,
     *  part-time wages), nominal USD for the year. */
    otherOrdinary: number;
    /** Gross Social Security benefits for the year, nominal USD. */
    ssAnnual: number;
    filingStatus: OrdinaryFilingStatus;
    /** Number of filers aged 65+ this year (0, 1 or 2). Adds the additional
     *  standard deduction per person. */
    filers65: number;
    /** Multiplier applied to brackets and deductions relative to 2026
     *  (e.g. accumulated inflation). Default 1. */
    indexFactor?: number;
}
/**
 * Taxable portion of Social Security under IRC 86 (0 / 50 / 85 percent
 * tiers) given the other ordinary income for the year.
 */
export declare function taxableSocialSecurity(ssAnnual: number, otherOrdinary: number, filingStatus: OrdinaryFilingStatus): number;
/** Total federal ordinary tax for the year on the supplied inputs. */
export declare function ordinaryFederalTax(inp: OrdinaryTaxInputs): number;
/**
 * Marginal federal tax of adding `extra` ordinary income on top of the
 * household's existing position: tax(base + extra) - tax(base). Non-positive
 * `extra` returns 0.
 */
export declare function ordinaryTaxDelta(inp: OrdinaryTaxInputs, extra: number): number;
