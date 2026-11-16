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
export type CatastrophicPathway = 'national-mandatory' | 'national-voluntary' | 'private-required' | 'us-aca-medicare';
export type CatastrophicPriceStatus = 'priced' | 'in-healthcare-line' | 'unpriced';
export type CatastrophicConfidence = 'researched' | 'single-source' | 'unverified';
/** Premium per adult per month (today's $) from `fromAge` until the next band. */
export interface CatastrophicAgeBand {
    fromAge: number;
    monthlyPerAdult: number;
}
/** The `catastrophicCoverage` block stored in each location.json. */
export interface CatastrophicCoverage {
    pathway: CatastrophicPathway;
    /** Name of the plan or system that carries the catastrophic risk. */
    plan: string;
    /** Whether accident and cancer care are covered, as far as sources state. */
    coversAccident: boolean;
    coversCancer: boolean | 'unstated';
    /**
     * 'priced'             : `ageBands` hold the premium and REPLACE the flat
     *                        monthlyCosts.healthcare line in the kernel.
     * 'in-healthcare-line' : the existing monthlyCosts.healthcare line is the
     *                        cost of the public pathway; no extra premium.
     * 'unpriced'           : requirement known, no sourced premium yet; the
     *                        kernel keeps the flat healthcare line and callers
     *                        should surface a warning.
     */
    priceStatus: CatastrophicPriceStatus;
    ageBands?: CatastrophicAgeBand[];
    confidence: CatastrophicConfidence;
    asOf: string;
    notes?: string;
    sources?: string[];
}
export declare const CATASTROPHIC_PATHWAYS: readonly CatastrophicPathway[];
/** Sort a band list ascending by fromAge without mutating the input. */
export declare function normalizeBands(bands: readonly CatastrophicAgeBand[]): CatastrophicAgeBand[];
/**
 * Premium for one adult of the given age. Uses the last band whose fromAge
 * is <= age. An adult younger than the first band pays the first band (the
 * data describes retirees; there is no cheaper tier to fall back to).
 */
export declare function bandMonthlyForAge(bands: readonly CatastrophicAgeBand[] | undefined, age: number): number;
/** Household premium: sum of each adult's band premium. */
export declare function catastrophicMonthly(bands: readonly CatastrophicAgeBand[] | undefined, adultAges: readonly number[]): number;
/**
 * Medicare Part B kept as a US fallback while living abroad: charged per
 * adult from `fromAge` (default 65). Medicare pays nothing outside the US,
 * so this is purely the cost of keeping the option to return for care.
 */
export declare function medicareFallbackMonthly(monthlyPerAdult: number | undefined, adultAges: readonly number[], fromAge?: number): number;
export interface ResolvedForeignHealthcare {
    /** Flat monthly healthcare line the kernel should keep (today's $). */
    foreignHealthcareMonthly: number;
    /** Age bands the kernel should add on top, when the pathway is priced. */
    foreignCatastrophicAgeBands?: CatastrophicAgeBand[];
    /** True when the requirement is declared but has no sourced premium. */
    unpriced: boolean;
    /** True when the location declares no catastrophic pathway at all. */
    missing: boolean;
}
/**
 * Map a location's stored healthcare line + catastrophicCoverage block to
 * the kernel's segment inputs. Single source of truth for every runner so
 * the dashboard, the API and the MCP cannot drift.
 */
export declare function resolveForeignHealthcare(healthcareLineMonthly: number, coverage: CatastrophicCoverage | undefined | null): ResolvedForeignHealthcare;
/** Structural validation used by the data-integrity test and admin tooling. */
export declare function validateCatastrophicCoverage(c: unknown): string[];
