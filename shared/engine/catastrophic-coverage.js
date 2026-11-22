/**
 * Catastrophic health coverage (accident + cancer) as a planning requirement.
 *
 * Every location must declare HOW a retired household is protected against a
 * catastrophic medical event:
 *   - 'national-mandatory' : residents must join a public system that covers it
 *   - 'national-voluntary' : residents may buy into a public system that covers it
 *   - 'private-required'   : no public pathway; a private major-medical policy is needed
 *   - 'us-aca-medicare'    : US location; the ACA / Medicare model in the kernel covers it
 *
 * Private premiums rise with age, so they are stored as per-adult age bands
 * (today's dollars) instead of a single flat number. The Monte Carlo kernel
 * evaluates the bands per adult, per simulated year.
 *
 * Pure functions only; no I/O. Consumed by monte-carlo.ts and by runners that
 * build LocationMove segments from location.json.
 */
export const CATASTROPHIC_PATHWAYS = [
    'national-mandatory',
    'national-voluntary',
    'private-required',
    'us-aca-medicare',
];
/** Sort a band list ascending by fromAge without mutating the input. */
export function normalizeBands(bands) {
    return [...bands].sort((a, b) => a.fromAge - b.fromAge);
}
/**
 * Premium for one adult of the given age. Uses the last band whose fromAge
 * is <= age. An adult younger than the first band pays the first band (the
 * data describes retirees; there is no cheaper tier to fall back to).
 */
export function bandMonthlyForAge(bands, age) {
    if (!bands || bands.length === 0)
        return 0;
    const sorted = normalizeBands(bands);
    let monthly = sorted[0].monthlyPerAdult;
    for (const b of sorted) {
        if (age >= b.fromAge)
            monthly = b.monthlyPerAdult;
        else
            break;
    }
    return monthly;
}
/** Household premium: sum of each adult's band premium. */
export function catastrophicMonthly(bands, adultAges) {
    if (!bands || bands.length === 0)
        return 0;
    let total = 0;
    for (const age of adultAges)
        total += bandMonthlyForAge(bands, age);
    return total;
}
/**
 * Medicare Part B kept as a US fallback while living abroad: charged per
 * adult from `fromAge` (default 65). Medicare pays nothing outside the US,
 * so this is purely the cost of keeping the option to return for care.
 */
export function medicareFallbackMonthly(monthlyPerAdult, adultAges, fromAge = 65) {
    if (!monthlyPerAdult || monthlyPerAdult <= 0)
        return 0;
    return adultAges.filter((a) => a >= fromAge).length * monthlyPerAdult;
}
/**
 * Map a location's stored healthcare line + catastrophicCoverage block to
 * the kernel's segment inputs. Single source of truth for every runner so
 * the dashboard, the API and the MCP cannot drift.
 */
export function resolveForeignHealthcare(healthcareLineMonthly, coverage) {
    const line = Number.isFinite(healthcareLineMonthly) ? Math.max(0, healthcareLineMonthly) : 0;
    if (!coverage) {
        return { foreignHealthcareMonthly: line, unpriced: false, missing: true };
    }
    if (coverage.priceStatus === 'priced' && coverage.ageBands && coverage.ageBands.length > 0) {
        // Bands replace the flat line: the stored `typical` already equals the
        // current-age band for two adults, so adding both would double count.
        return {
            foreignHealthcareMonthly: 0,
            foreignCatastrophicAgeBands: normalizeBands(coverage.ageBands),
            unpriced: false,
            missing: false,
        };
    }
    return {
        foreignHealthcareMonthly: line,
        unpriced: coverage.priceStatus === 'unpriced',
        missing: false,
    };
}
/** Structural validation used by the data-integrity test and admin tooling. */
export function validateCatastrophicCoverage(c) {
    const errs = [];
    if (!c || typeof c !== 'object')
        return ['catastrophicCoverage block is missing'];
    const cov = c;
    if (!cov.pathway || !CATASTROPHIC_PATHWAYS.includes(cov.pathway))
        errs.push('invalid pathway');
    if (!cov.plan || typeof cov.plan !== 'string')
        errs.push('plan is required');
    if (typeof cov.coversAccident !== 'boolean')
        errs.push('coversAccident must be boolean');
    if (typeof cov.coversCancer !== 'boolean' && cov.coversCancer !== 'unstated')
        errs.push('coversCancer must be boolean or "unstated"');
    if (!cov.priceStatus || !['priced', 'in-healthcare-line', 'unpriced'].includes(cov.priceStatus))
        errs.push('invalid priceStatus');
    if (!cov.confidence || !['researched', 'single-source', 'unverified'].includes(cov.confidence))
        errs.push('invalid confidence');
    if (!cov.asOf || !/^\d{4}-\d{2}-\d{2}$/.test(cov.asOf))
        errs.push('asOf must be YYYY-MM-DD');
    if (cov.priceStatus === 'priced') {
        if (!Array.isArray(cov.ageBands) || cov.ageBands.length === 0) {
            errs.push('priced coverage needs ageBands');
        }
        else {
            for (const b of cov.ageBands) {
                if (typeof b.fromAge !== 'number' || b.fromAge < 0)
                    errs.push('band fromAge must be >= 0');
                if (typeof b.monthlyPerAdult !== 'number' || b.monthlyPerAdult <= 0)
                    errs.push('band monthlyPerAdult must be > 0');
            }
            const ages = cov.ageBands.map((b) => b.fromAge);
            if (new Set(ages).size !== ages.length)
                errs.push('band fromAge values must be unique');
        }
    }
    if (cov.pathway === 'us-aca-medicare' && cov.priceStatus === 'priced')
        errs.push('US locations are priced by the ACA/Medicare model, not bands');
    return errs;
}
