/**
 * Rental / real-estate income helpers — Schedule E modeling for the
 * retirement dashboard (Todos #29).
 *
 * Scope (v1):
 *   - Residential rental property only (27.5-year straight-line depreciation
 *     under IRC § 168(c)). Commercial 39-year is not modeled.
 *   - Cash flow + Schedule E taxable net per property per sim-year.
 *   - Vacancy adjustment, operating expenses, mortgage interest, depreciation.
 *   - Ownership window (start year + optional through year).
 *
 * Out of scope (deferred):
 *   - QBI 20% deduction (IRC § 199A).
 *   - Depreciation recapture on sale (Sec 1250 — needs propertySale LifeEvent).
 *   - Passive-activity loss limitations (IRC § 469).
 *   - 250-hour safe harbor / Real Estate Professional Status.
 *   - Foreign rental + foreign tax credit interplay.
 *
 * Numbers are nominal year-1 USD on the data model. Inflation is the
 * caller's responsibility — the kernel will wrap aggregate calls with a
 * cumulative-inflation factor when Stage 4b lands.
 *
 * All functions are pure: no Angular DI, no signal access, no I/O.
 * Tested in `scripts/test-monte-carlo-helpers.mts`.
 */
import { RENTAL_RESIDENTIAL_DEPRECIATION_LIFE_YEARS } from './tax-sources.js';
const ZERO_BREAKDOWN = Object.freeze({
    active: false,
    grossRent: 0,
    vacancyAdj: 0,
    effectiveRent: 0,
    propertyTax: 0,
    otherOpEx: 0,
    mortgageInterest: 0,
    depreciation: 0,
    taxableNet: 0,
    cashFlow: 0,
});
/**
 * Annual straight-line depreciation deduction.
 *
 *   - Returns 0 before depreciation has started (`simYear < startYear`).
 *   - Returns 0 once the asset is fully depreciated
 *     (`simYear − startYear ≥ life`).
 *   - Returns `basis / life` annually within the depreciation window.
 *
 * Simplifications: ignores MACRS half-year / mid-month conventions and
 * partial-year fractions for the start/end years. Adequate for retirement
 * planning — sub-thousand-dollar precision in the first/last year of the
 * 27.5-year window doesn't move the needle.
 */
export function straightLineDepreciation(basis, simYear, depreciationStartYear, life = RENTAL_RESIDENTIAL_DEPRECIATION_LIFE_YEARS) {
    if (basis <= 0 || life <= 0)
        return 0;
    const elapsed = simYear - depreciationStartYear;
    if (elapsed < 0)
        return 0;
    if (elapsed >= life)
        return 0;
    return basis / life;
}
/**
 * Schedule E breakdown for a single property in a single sim-year.
 *
 * Returns a frozen all-zero breakdown when the property is not owned
 * in this year — callers can branch on `.active` or just sum the
 * fields (zeros are no-ops).
 */
export function scheduleENetAnnual(p, simYear) {
    const ownedThrough = p.ownedThroughYear ?? Number.POSITIVE_INFINITY;
    const active = simYear >= p.ownedFromYear && simYear < ownedThrough;
    if (!active)
        return ZERO_BREAKDOWN;
    const grossRent = Math.max(0, p.monthlyGrossRent) * 12;
    const vacancyRate = Math.max(0, Math.min(100, p.vacancyRatePct)) / 100;
    // Branch on `vacancyRate > 0` to avoid IEEE-754 -0 propagating into
    // aggregate totals when the rate clamps to zero (-grossRent * 0 = -0).
    const vacancyAdj = vacancyRate > 0 ? -grossRent * vacancyRate : 0;
    const effectiveRent = grossRent + vacancyAdj;
    const propertyTax = Math.max(0, p.propertyTaxAnnual);
    const otherOpEx = Math.max(0, p.otherOpExAnnual);
    const mortgageInterest = Math.max(0, p.mortgageInterestAnnual);
    const depreciation = straightLineDepreciation(p.depreciableBasis, simYear, p.depreciationStartYear);
    const cashFlow = effectiveRent - propertyTax - otherOpEx - mortgageInterest;
    const taxableNet = cashFlow - depreciation;
    return {
        active: true,
        grossRent,
        vacancyAdj,
        effectiveRent,
        propertyTax,
        otherOpEx,
        mortgageInterest,
        depreciation,
        taxableNet,
        cashFlow,
    };
}
/**
 * Portfolio-wide Schedule E totals for a single sim-year.
 *
 * `perProperty` includes inactive properties (with zero breakdowns) so
 * the UI can render a stable row order and surface ownership-window
 * boundaries to the user.
 */
export function aggregateRentalIncome(properties, simYear) {
    let totalCashFlow = 0;
    let totalTaxableNet = 0;
    let totalDepreciation = 0;
    let totalEffectiveRent = 0;
    const perProperty = [];
    for (const p of properties) {
        const breakdown = scheduleENetAnnual(p, simYear);
        if (breakdown.active) {
            totalCashFlow += breakdown.cashFlow;
            totalTaxableNet += breakdown.taxableNet;
            totalDepreciation += breakdown.depreciation;
            totalEffectiveRent += breakdown.effectiveRent;
        }
        perProperty.push({ id: p.id, label: p.label, breakdown });
    }
    return {
        totalCashFlow,
        totalTaxableNet,
        totalDepreciation,
        totalEffectiveRent,
        perProperty,
    };
}
/** Stable-id factory for new RentalProperty rows added in the UI. */
export function newRentalPropertyId() {
    return `rental-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}
/** Default values for a freshly-added property row. */
export function defaultRentalProperty() {
    return {
        id: newRentalPropertyId(),
        label: 'Rental property',
        monthlyGrossRent: 2000,
        vacancyRatePct: 8,
        propertyTaxAnnual: 4000,
        otherOpExAnnual: 3000,
        mortgageInterestAnnual: 0,
        depreciableBasis: 200000,
        depreciationStartYear: 0,
        ownedFromYear: 0,
        ownedThroughYear: undefined,
    };
}
