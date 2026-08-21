/**
 * Per-year household cost curves — pets and dependents.
 *
 * Pure builders that turn household composition (pets with lifespans,
 * dependent members with birth years) plus per-location pet cost data into
 * the sparse per-year arrays consumed by the Monte Carlo kernel
 * (`MonteCarloParams.petCostByYear` / `dependentCostByYear`). All amounts
 * are ANNUAL USD in today's dollars — the kernel applies cumulative
 * inflation at deduction time.
 *
 * Design: docs/superpowers/specs/2026-08-21-pet-dependent-cost-curves-design.md
 */
/** The location.json monthlyCosts categories that describe pet costs.
 *  Callers that enable a pet curve must EXCLUDE these from the flat
 *  segment baseCost — the curve replaces them. */
export declare const PET_COST_CATEGORY_KEYS: readonly ["petCare", "petDaycare", "petGrooming"];
/** Vet/care costs rise for senior pets — applied to a pet's share during
 *  its senior window (the last quarter of expected lifespan). */
export declare const SENIOR_PET_UPLIFT = 1.25;
export declare const SENIOR_PET_FRACTION = 0.75;
export declare const DEFAULT_CHILD_SUPPORT_UNTIL_AGE = 22;
export declare const DEFAULT_DEPENDENT_MONTHLY_COST = 1000;
export interface PetForCurve {
    /** 'dog' | 'cat' | ... — labeling only in v1; costs are an even split. */
    type?: string | null;
    birthYear: number;
    /** Expected lifespan in years. */
    expectedLifespan: number;
}
export interface DependentForCurve {
    /** 'child' dependents age out at childSupportUntilAge; 'adult'
     *  dependents are supported for the whole horizon. null/undefined is
     *  treated as child. */
    dependentType?: string | null;
    birthYear: number;
}
export interface PetCurveOptions {
    years: number;
    simStartYear: number;
    /** Total household pet monthly cost (sum of PET_COST_CATEGORY_KEYS
     *  `typical` values, today's USD) at the location active in sim year y. */
    petMonthlyTotalAtYear: (y: number) => number;
    /** When true, a pet's base share continues after its expected death —
     *  modeling a successor pet (no senior uplift for the successor). */
    replacePets?: boolean;
}
export interface DependentCurveOptions {
    years: number;
    simStartYear: number;
    monthlyCostPerDependent: number;
    childSupportUntilAge?: number;
}
/** Annual USD pet cost per sim year. Even split of the household total
 *  across the pets supplied; each share runs while its pet is alive,
 *  senior-uplifted in the last quarter of expected lifespan, and ends at
 *  expected death (or continues at base rate with replacePets). A pet
 *  already past its expectancy still gets sim year 0 — it exists. */
export declare function buildPetCostByYear(pets: PetForCurve[], opts: PetCurveOptions): number[];
/** Annual USD dependent cost per sim year. Children age out the year they
 *  turn childSupportUntilAge; adult dependents run the whole horizon. */
export declare function buildDependentCostByYear(dependents: DependentForCurve[], opts: DependentCurveOptions): number[];
