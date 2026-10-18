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
import { FED_BRACKETS_2026_MFJ, FED_BRACKETS_2026_SINGLE, FED_STD_DEDUCTION_2026, } from './tax-sources.js';
/** 2026 additional standard deduction per qualifying 65+ individual
 *  (Rev. Proc. 2025-32 section 3.17(2)): 1,650 married, 2,050 single. */
export const FED_ADDL_STD_DEDUCTION_65_2026 = { mfj: 1650, single: 2050 };
/** IRC 86 provisional-income thresholds (statutory, not indexed). */
export const SS_PROVISIONAL_THRESHOLDS = {
    mfj: { base: 32000, adjusted: 44000 },
    single: { base: 25000, adjusted: 34000 },
};
/**
 * Taxable portion of Social Security under IRC 86 (0 / 50 / 85 percent
 * tiers) given the other ordinary income for the year.
 */
export function taxableSocialSecurity(ssAnnual, otherOrdinary, filingStatus) {
    if (ssAnnual <= 0)
        return 0;
    const t = SS_PROVISIONAL_THRESHOLDS[filingStatus];
    const provisional = Math.max(0, otherOrdinary) + 0.5 * ssAnnual;
    if (provisional <= t.base)
        return 0;
    if (provisional <= t.adjusted) {
        return Math.min(0.5 * ssAnnual, 0.5 * (provisional - t.base));
    }
    const tier1 = Math.min(0.5 * ssAnnual, 0.5 * (t.adjusted - t.base));
    const tier2 = 0.85 * (provisional - t.adjusted);
    return Math.min(0.85 * ssAnnual, tier1 + tier2);
}
function bracketTax(taxable, filingStatus, indexFactor) {
    const brackets = filingStatus === 'mfj' ? FED_BRACKETS_2026_MFJ : FED_BRACKETS_2026_SINGLE;
    let tax = 0;
    for (const b of brackets) {
        const lo = b.min * indexFactor;
        const hi = b.max == null ? Infinity : b.max * indexFactor;
        if (taxable <= lo)
            break;
        tax += (Math.min(taxable, hi) - lo) * b.rate;
    }
    return tax;
}
/** Total federal ordinary tax for the year on the supplied inputs. */
export function ordinaryFederalTax(inp) {
    const idx = inp.indexFactor ?? 1;
    const status = inp.filingStatus;
    const taxableSs = taxableSocialSecurity(inp.ssAnnual, inp.otherOrdinary, status);
    const stdDed = FED_STD_DEDUCTION_2026[status] * idx
        + Math.max(0, Math.min(2, inp.filers65)) * FED_ADDL_STD_DEDUCTION_65_2026[status] * idx;
    const taxable = Math.max(0, Math.max(0, inp.otherOrdinary) + taxableSs - stdDed);
    return bracketTax(taxable, status, idx);
}
/** Marginal rates a fill-to-bracket Roth conversion can target. */
export const ROTH_FILL_BRACKET_CEILINGS = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35];
/**
 * Taxable income (after the standard deduction) at the TOP of the bracket
 * whose marginal rate is `ceilingRate`, indexed. Returns Infinity for the
 * open-ended top bracket and 0 for a rate the table does not contain.
 */
export function bracketTopTaxable(ceilingRate, filingStatus, indexFactor = 1) {
    const brackets = filingStatus === 'mfj' ? FED_BRACKETS_2026_MFJ : FED_BRACKETS_2026_SINGLE;
    const b = brackets.find((x) => Math.abs(x.rate - ceilingRate) < 1e-9);
    if (!b)
        return 0;
    return b.max == null ? Infinity : b.max * indexFactor;
}
/**
 * How much additional ordinary income (a Roth conversion, say) the
 * household can take this year before its taxable income crosses the top
 * of the `ceilingRate` bracket. Zero when already at or above it.
 *
 * Not linear in the answer: every extra dollar can also pull more Social
 * Security into taxable income (IRC 86 "tax torpedo"), so the taxable
 * figure is `x + taxableSS(x)`, a monotone piecewise-linear function of
 * x. Solved by bisection to within one dollar (about 40 iterations, cheap
 * enough to run per trial-year inside the Monte Carlo kernel).
 */
export function ordinaryHeadroomToBracketTop(inp, ceilingRate) {
    const idx = inp.indexFactor ?? 1;
    const status = inp.filingStatus;
    const top = bracketTopTaxable(ceilingRate, status, idx);
    if (!(top > 0))
        return 0;
    const stdDed = FED_STD_DEDUCTION_2026[status] * idx
        + Math.max(0, Math.min(2, inp.filers65)) * FED_ADDL_STD_DEDUCTION_65_2026[status] * idx;
    const base = Math.max(0, inp.otherOrdinary);
    const taxableAt = (extra) => Math.max(0, base + extra + taxableSocialSecurity(inp.ssAnnual, base + extra, status) - stdDed);
    if (taxableAt(0) >= top)
        return 0;
    if (!Number.isFinite(top))
        return Infinity;
    // taxableAt(x) >= x - stdDed, so x = top + stdDed is always past the top.
    let lo = 0;
    let hi = top + stdDed;
    for (let i = 0; i < 48 && hi - lo > 1; i++) {
        const mid = (lo + hi) / 2;
        if (taxableAt(mid) <= top)
            lo = mid;
        else
            hi = mid;
    }
    return lo;
}
/**
 * Marginal federal tax of adding `extra` ordinary income on top of the
 * household's existing position: tax(base + extra) - tax(base). Non-positive
 * `extra` returns 0.
 */
export function ordinaryTaxDelta(inp, extra) {
    if (!(extra > 0))
        return 0;
    const withExtra = ordinaryFederalTax({ ...inp, otherOrdinary: inp.otherOrdinary + extra });
    const without = ordinaryFederalTax(inp);
    return Math.max(0, withExtra - without);
}
