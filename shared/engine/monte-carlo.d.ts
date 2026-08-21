/**
 * Monte Carlo retirement simulation.
 *
 * Supports four sampling modes:
 *   - 'normal'             : Gaussian draws from (meanReturn, volReturn) + (meanInflation, volInflation)
 *   - 'bootstrap'          : random-year resample from HISTORICAL_RETURNS (return/inflation paired)
 *   - 'regime'             : 2-state Markov switching bull/bear with different means and vols
 *   - 'historical-sequence': actual annual returns starting at historicalStartYear, wrapping if needed
 *
 * Annual steps for every mode:
 *   - bal *= (1 + annReturn)
 *   - bal += income * 12 - cost * 12 * currShock * fxMult
 *   - cost *= (1 + annInfl)
 *   - income *= (1 + incGrowth)
 */
import { type RentalProperty } from './rental-income.js';
import { type LtcgFilingStatus } from './tax-sources.js';
export type ReturnMode = 'normal' | 'bootstrap' | 'regime' | 'historical-sequence';
/**
 * One-time discrete expense at a specific sim year — modelled as a balance
 * deduction in the year it hits. Use cases: car replacement every 7–8
 * years, new roof in year 12, grandchild college tuition in year 18, big
 * trip every 5 years, late-life nursing-home stay (LTC).
 *
 * The amount is in today's USD; the kernel multiplies by accumulated
 * inflation when `inflate` is true (default — true for almost everything
 * lumpy, since costs grow with CPI / vehicle / construction inflation),
 * skipping inflation only when the user has hedged in nominal dollars
 * (e.g., a fixed-price annuity payout, or a known nominal mortgage payoff).
 */
export interface OneTimeExpense {
    /** Sim year (0-based from start). 0 = today. */
    year: number;
    /** Amount in today's USD. Positive number; kernel deducts from balance. */
    amountUSD: number;
    /** Optional human-readable label (rendered in scenario passthrough only). */
    label?: string;
    /** Whether to inflate by accumulated inflation at the year. Default true. */
    inflate?: boolean;
}
/**
 * One-time discrete income at a specific sim year — modelled as a balance
 * addition in the year it hits. Use cases: inheritance, home-sale proceeds,
 * deferred-comp payout, lawsuit settlement, lottery, severance, late-life
 * gift to the children's children.
 *
 * Symmetric to `OneTimeExpense` (#31 priority 2): same shape, opposite sign
 * — kernel adds to balance instead of subtracting. Default `inflate: true`
 * matches `OneTimeExpense` semantics: amount is in today's USD, scaled by
 * accumulated inflation at the year it hits unless caller explicitly opts
 * out (e.g., a fixed-dollar life-insurance payout that doesn't grow with
 * CPI). Multiple incomes in the same year stack. Negative or zero amounts
 * are silently skipped, mirroring the expense filter.
 *
 * Tax treatment caveat: this is a pure balance add — does NOT flow into
 * MAGI or any tax pathway. For inheritance-of-IRA scenarios where the
 * heir owes ordinary income tax on distributions, use the (future)
 * `inheritedIRA` LifeEvent kind instead, which models the SECURE Act
 * 10-year forced drawdown with MAGI ripples to IRMAA. Use this kind only
 * for inflows that don't trigger tax (cash inheritance under the federal
 * estate-tax exemption, step-up-basis taxable-account inheritance, home
 * sale proceeds within IRC § 121 exclusion, life insurance, etc.).
 */
export interface OneTimeIncome {
    /** Sim year (0-based from start). 0 = today. */
    year: number;
    /** Amount in today's USD. Positive number; kernel adds to balance. */
    amountUSD: number;
    /** Optional human-readable label (rendered in scenario passthrough only). */
    label?: string;
    /** Whether to inflate by accumulated inflation at the year. Default true. */
    inflate?: boolean;
}
export interface LocationMove {
    /** Year from simulation start when this segment begins (0 = start). */
    fromYear: number;
    /** Baseline monthly cost of living at this location, in today's USD. */
    baseCost: number;
    /** Whether this location's currency is not USD. */
    isForeign: boolean;
    /** One-time move cost deducted from balance at `fromYear` (USD). */
    moveCostUSD?: number;
    /** Optional FX drift override for this segment (per-year, decimal). */
    fxDrift?: number;
    /** Optional label (for logging / future path annotations). */
    label?: string;
    /** Sum of monthlyCosts in today's $ EXCLUDING healthcare + taxes categories. */
    nonHealthcareBase?: number;
    /** Monthly income tax (today's $) — e.g. from bracket-based computation on MAGI. */
    monthlyIncomeTax?: number;
    /** US location: Medicare baseline monthly for the whole household. */
    medicareMonthly?: number;
    /** US location: unsubsidized ACA silver benchmark monthly for the whole household. */
    acaUnsubsidizedMonthly?: number;
    /** US location: ACA premium cap as fraction of MAGI (e.g. 0.085 = 8.5%). */
    acaSubsidyCapPct?: number;
    /** Foreign location: monthly healthcare from stored data (public system or local private). */
    foreignHealthcareMonthly?: number;
    /** True if this is a US location — drives Medicare eligibility. */
    isUS?: boolean;
    /**
     * Self-consistent steady-state ACA MAGI for THIS segment's location (set by
     * the runner via `decideConsistent`). The kernel uses it for the segment's
     * subsidy calc instead of the global `magiAnnual`, so a move to a cheaper /
     * pricier city reprices ACA against the moved-to location's own draw. Year 0
     * still uses `transitionMagiAnnual`. Undefined → fall back to global.
     */
    magiAnnual?: number;
}
export interface RegimeConfig {
    /** Mean/vol in the bull state (decimal fractions). */
    bullMean: number;
    bullVol: number;
    /** Mean/vol in the bear state. */
    bearMean: number;
    bearVol: number;
    /** Transition probabilities per year. */
    pBullToBear: number;
    pBearToBull: number;
}
export declare const DEFAULT_REGIME: RegimeConfig;
/** Bundled at `LifeEvent.spouseDeath.survivorOverrides`. Short field names
 *  inside the namespace; the existing flat `MonteCarloParams.survivor*`
 *  fields use the long-form prefix. */
export interface SurvivorOverrides {
    /** Monthly income after death (typically max PIA × 12 of surviving adult). */
    monthlyIncome?: number;
    /** Multiplier on the lifestyle portion of cost (default 0.75 elsewhere). */
    costRatio?: number;
    /** Single-filer monthly income tax (replaces MFJ tax line). */
    monthlyIncomeTax?: number;
    /** Single-IRMAA Medicare monthly (gated on age ≥ 65 elsewhere). */
    medicareMonthly?: number;
    /** Birth year of survivor — gates Medicare eligibility year-by-year. */
    birthYear?: number;
}
/** `label` (not `description`) on every variant — matches the existing
 *  `OneTimeExpense.label` field used by the runner / state / UI. */
export type LifeEvent = {
    kind: 'move';
    year: number;
    segment: LocationMove;
} | {
    kind: 'spouseDeath';
    year: number;
    deceasedIndex?: number;
    survivorOverrides?: SurvivorOverrides;
} | {
    kind: 'stepUpBasis';
    year: number;
    benefitUSD: number;
} | {
    kind: 'oneTimeExpense';
    year: number;
    amountUSD: number;
    label?: string;
    inflate?: boolean;
} | {
    kind: 'oneTimeIncome';
    year: number;
    amountUSD: number;
    label?: string;
    inflate?: boolean;
} | {
    kind: 'incomeChange';
    year: number;
    monthlyDelta: number;
    label?: string;
}
/** SECURE Act forced 10-year drawdown of an inherited traditional IRA
 *  (#31 priority 5). Each year of the drain window adds
 *  `(balanceUSD / drainOverYears) × cumInfl × (1 - effectiveTaxRate)` to
 *  the heir's portfolio balance. Concurrently, the gross per-year
 *  distribution is added to MAGI for that year, which ripples into the
 *  ACA-subsidy calculation when the heir is pre-65 (lower subsidy at
 *  higher MAGI). The post-65 IRMAA tier jump is NOT yet modeled — the
 *  kernel uses a pre-baked `m.medicareMonthly` set by the runner from
 *  the heir's baseline MAGI. To capture that effect, the runner would
 *  need to encode `medicareMonthlyByYear[]` per IRMAA tier crossing.
 *
 *  Defaults: `drainOverYears: 10` (SECURE Act mandate),
 *  `effectiveTaxRate: 0.22` (typical retiree's marginal bracket — 12%
 *  / 22% / 24% bracket midpoint). The user-facing simplification is
 *  ordinary income at a single flat rate; a future iteration could
 *  recompute single-filer brackets per year as the drain stacks on
 *  base income. */
 | {
    kind: 'inheritedIRA';
    year: number;
    balanceUSD: number;
    drainOverYears?: number;
    effectiveTaxRate?: number;
    label?: string;
} | {
    kind: 'careerChange';
    year: number;
    newMonthlyIncome: number;
    label?: string;
}
/**
 * Sale of a rental property in `RentalProperty[]` portfolio (Todo #35).
 *
 * In year `year`, the kernel:
 *   1. Computes accumulated depreciation = `straightLineDepreciation`
 *      summed from `depreciationStartYear` through saleYear.
 *   2. adjustedBasis = depreciableBasis − accumulatedDepreciation.
 *   3. netSalePrice = salePriceUSD − sellingExpenses.
 *   4. gain = netSalePrice − adjustedBasis (signed).
 *   5. If gain > 0: Sec 1250 recapture = min(gain, accumulatedDepreciation) × 0.25;
 *      remaining gain at LTCG rates (`ltcgFederalTax`).
 *      bal += netSalePrice − recaptureTax − ltcgTax.
 *   6. If gain ≤ 0: capital loss; bal += netSalePrice (loss not yet
 *      modeled against ordinary income — out of scope v1).
 *   7. Property is auto-zeroed from rental aggregation starting
 *      saleYear (kernel pre-trial overrides `ownedThroughYear`).
 *
 * v1 simplifications: NIIT 3.8% surtax not modeled; state tax not
 * modeled; capital-loss carryforward not modeled.
 */
 | {
    kind: 'propertySale';
    year: number;
    propertyId: string;
    salePriceUSD: number;
    sellingExpenses?: number;
    label?: string;
};
export interface MonteCarloParams {
    /** Starting portfolio balance in USD */
    portfolio: number;
    /** Monthly income in USD (SS, pension, etc.) */
    monthlyIncome: number;
    /** Baseline monthly cost-of-living in local currency */
    baseCost: number;
    /** true if location's currency is not USD */
    isForeign: boolean;
    /** Annual FX drift rate (positive = USD weakens) */
    fxDrift: number;
    /** Number of simulation runs (trials) */
    runs: number;
    /** Years to simulate */
    years: number;
    /** Mean annual return (decimal, e.g. 0.07 for 7%) */
    meanReturn: number;
    /** Return volatility (decimal, e.g. 0.15 for 15%) */
    volReturn: number;
    /** Mean inflation (decimal) */
    meanInflation: number;
    /** Inflation volatility (decimal) */
    volInflation: number;
    /** Currency volatility (decimal) */
    currVol: number;
    /** Income growth (decimal) */
    incGrowth: number;
    /** Sampling mode for returns + inflation. Default 'normal'. */
    returnMode?: ReturnMode;
    /** Regime config (only used when returnMode === 'regime'). */
    regime?: RegimeConfig;
    /** Start year for 'historical-sequence' mode. Required for that mode. */
    historicalStartYear?: number;
    /**
     * Brokerage / account fee support (A3 drift item 1). Names and units
     * mirror what `retirement-api/src/routes/fees.ts` persists so the caller
     * can pass the user's stored settings straight through — specifically,
     * `brokerageExpenseRatio` (fees.ts's ongoing annual AUM drag) and
     * `brokerageAnnualFee` (fees.ts's flat per-year account fee). fees.ts's
     * `brokerageFeePct` and `brokerageFeeFlat` are PER-TRADE fees and are
     * intentionally NOT read here — this engine has no concept of individual
     * trades, only sim years, so a per-trade fee has no yearly cadence to
     * apply against.
     *
     * Each sim year, right after the year's return is applied to `bal`, the
     * kernel deducts `bal * brokerageExpenseRatio + brokerageAnnualFee *
     * cumInfl`. Both default to 0 — absent or zero, the deduction is a no-op
     * and behavior is bit-identical to before this field existed.
     */
    /** Decimal fraction of balance taken per year (e.g. 0.002 = 0.2%/yr expense
     *  ratio / AUM fee). Matches the DB-stored decimal-fraction encoding of
     *  `brokerageExpenseRatio` in `fees.ts` (fees.ts:111, "0.002 = 0.2% annual
     *  expense ratio") — NOT `brokerageFeePct` (fees.ts:108), which fees.ts
     *  documents as a PER-TRADE fee and which this engine does not read. */
    brokerageExpenseRatio?: number;
    /**
     * Flat USD/year account-maintenance fee (matches `fees.ts`'s
     * `brokerageAnnualFee`, a per-year flat amount — distinct from
     * `brokerageFeeFlat`, which is a per-trade fee with no natural per-year
     * cadence in this engine and is intentionally NOT modeled here). Given in
     * today's USD; the kernel inflates it by accumulated inflation (`cumInfl`)
     * the same way it inflates other recurring flat annual costs (see the LTC
     * insurance premium line, `ltcInsMonthly * 12 * cumInfl`) — unlike the
     * primary-residence mortgage payment, which is intentionally nominal.
     */
    brokerageAnnualFee?: number;
    /**
     * Birth years of non-dependent adults — used to determine Medicare
     * eligibility per sim year (age ≥ 65). When absent, segments fall back to
     * their ACA baseline regardless of year.
     */
    adultBirthYears?: number[];
    /** Calendar year at sim start (y=0). Defaults to current year. */
    simStartYear?: number;
    /** MAGI for ACA subsidy calc. Held constant across the sim (v1 simplification). */
    magiAnnual?: number;
    /**
     * Transition-year MAGI override — applied in sim year 0 only. Captures the
     * spike from mid-year retirement W-2 / severance / final bonuses / year-of
     * RMDs that push MAGI above what it'll be in steady state. Year 1+ uses
     * `magiAnnual`.
     */
    transitionMagiAnnual?: number;
    /**
     * ACA subsidy regime: 'cliff' (2026 reality per Rev Proc 2025-25, sliding 2.10–9.96%
     * with hard 400% FPL cliff) or 'enhanced' (flat 8.5% of MAGI cap, no cliff).
     * Default 'enhanced' for backward compatibility with existing callers.
     */
    subsidyRegime?: 'cliff' | 'enhanced';
    /**
     * Multi-location schedule. Each entry sets a new cost-of-living baseline at
     * `fromYear` and optionally deducts a one-time move cost. When unset, the
     * sim uses the single-location `baseCost` / `isForeign` / `fxDrift` params.
     *
     * Inflation is preserved across moves: the kernel tracks accumulated
     * inflation (`cumInfl`) and applies it to each segment's baseCost on swap,
     * so you move to "$X in today's dollars" regardless of when the move happens.
     */
    moveSchedule?: LocationMove[];
    /**
     * One-time discrete expenses applied at specific sim years. Items with
     * `inflate: true` (default) scale by accumulated inflation when they hit;
     * `inflate: false` treats the amount as a nominal-dollar shock at that
     * year. Multiple expenses in the same year stack. Negative or zero
     * amounts are silently skipped. Used for lumpy realistic costs (cars,
     * roof, tuition, late-life nursing-home stay) that a recurring monthly
     * cost line can't represent.
     */
    oneTimeExpenses?: OneTimeExpense[];
    /**
     * One-time discrete income / portfolio additions at specific sim years.
     * Symmetric to `oneTimeExpenses` (#31 priority 2): same shape, opposite
     * sign — kernel adds to balance. Use cases: inheritance, home-sale
     * proceeds, deferred-comp payout, life-insurance payout, severance.
     *
     * Tax-pathway caveat: this is a pure balance add — does NOT flow into
     * MAGI / income tax / IRMAA. For inflows that DO trigger ordinary
     * income tax (e.g. inherited traditional IRA distributions under the
     * SECURE Act 10-year drain), use a future `inheritedIRA` LifeEvent
     * instead. Use this field only for tax-free or already-taxed inflows.
     */
    oneTimeIncomes?: OneTimeIncome[];
    /**
     * Deterministic spouse-death scenario. When set, at year `spouseDeathYear`
     * the sim switches to survivor parameters:
     *   - income drops to `survivorMonthlyIncome` (typically max PIA × 12)
     *   - cost multiplies by `survivorCostRatio` (default 0.75)
     *
     * Probabilistic (actuarial) mortality is a future extension.
     */
    spouseDeathYear?: number;
    /** Monthly income after spouse death (SS survivor benefit + other). */
    survivorMonthlyIncome?: number;
    /**
     * Multiplier applied to the lifestyle portion of `cost` (nonHealthcareBase
     * minus tax) at the death year. Captures that fixed costs (housing,
     * utilities) don't halve but variable costs (food, transport) do. Default
     * 0.75 — the commonly-cited survivor adjustment. Does NOT apply to the
     * tax or healthcare lines — those are swapped via the survivor overrides
     * below.
     */
    survivorCostRatio?: number;
    /**
     * Monthly income-tax line for the survivor phase, computed by the caller
     * using single-filer brackets (MFJ brackets are ~2× wider, so survivor tax
     * usually goes UP even as income goes down). When set, replaces the
     * segment's `monthlyIncomeTax` in all years after `spouseDeathYear`. When
     * null, survivor tax stays at the pre-death MFJ value — an undertaxation
     * that historically made this a ~$50–200K under-projection over a 15–25
     * year survivor horizon.
     */
    survivorMonthlyIncomeTax?: number;
    /**
     * Monthly Medicare + IRMAA for the survivor — caller recomputes using
     * single-filer IRMAA thresholds (which are ~half of MFJ, so a surviving
     * spouse with unchanged MAGI can jump into a higher surcharge tier).
     * Only applied when `survivorBirthYear` indicates the survivor has
     * reached Medicare eligibility (age ≥ 65) at the current sim year.
     * For US segments before survivor age 65, the kernel falls back to the
     * single-adult ACA path. For foreign segments, this is ignored
     * entirely — `foreignHealthcareMonthly` continues to apply.
     */
    survivorMedicareMonthly?: number;
    /**
     * Birth year of the surviving spouse — used to gate
     * `survivorMedicareMonthly` on Medicare eligibility (age ≥ 65 at current
     * sim year). When unset and a survivor phase is active, the kernel
     * conservatively assumes Medicare-eligible (preserves the previous
     * behaviour of immediately swapping to survivorMedicareMonthly).
     */
    survivorBirthYear?: number;
    /**
     * One-time portfolio bump applied at `spouseDeathYear` to reflect the
     * stepped-up cost basis on jointly-held taxable accounts. Surviving
     * spouse can realize up to this dollar amount in capital gains tax-free
     * (the basis resets to fair market value at death). Caller computes as
     *   `taxableBalanceAtDeath × unrealizedGainRatio × effectiveLtcgRate`
     * and passes the resulting dollar benefit. Default 0 (no stepped-up
     * basis credit).
     */
    survivorStepUpBenefitUSD?: number;
    /**
     * Optional location swap that fires the year `spouseDeathYear` triggers,
     * not at a fixed `fromYear`. #31 priority 4 — "if my spouse dies, I'd
     * downsize / move closer to family / relocate to a cheaper city". The
     * supplied `LocationMove` is the new active segment (cost / FX / breakdown
     * fields), with kernel-set `fromYear = spouseDeathYear` injected at
     * dispatch time. Mutations at the death year mirror a regular move:
     *   - `cost` / `costHealthcare` recomputed from the relocate segment
     *      (with survivor flag set, since survivorPhase is true by this point)
     *   - `curIsForeign` / `curDrift` swapped to the new segment's values
     *   - `fxMult` reset to 1 (new currency baseline)
     *   - optional `moveCostUSD` deducted from balance
     * The relocation is sticky: the trial-local schedule is extended with
     * the relocate segment so subsequent age-transition cost recomputes
     * (Medicare crossover at 65) read from the relocate segment, not the
     * pre-death active segment.
     *
     * Year-based moves on `moveSchedule` whose `fromYear > spouseDeathYear`
     * still fire after the relocation, so the user can still pre-plan a
     * later move (e.g. "move at year 25 regardless of spouse status").
     * Year-based moves whose `fromYear ≤ spouseDeathYear` are unaffected.
     */
    survivorRelocate?: LocationMove;
    /**
     * Phase 3b — foreign inheritance tax hit at the spouse-death year.
     * Indexed by sim year (0..years-1). Each entry describes the active
     * location's spouse-effective tax rate and USD-baseline exemption.
     *
     * Caller (MonteCarloRunnerService) pre-computes per year:
     *   - effectiveRate: 0 for `'full'` spouse exemption (US, France,
     *     Portugal, Ireland, etc.); `topRate` for `'none'` (Colombia);
     *     `directFamilyEffectiveRate ?? topRate` for `'partial'` (Spain,
     *     Italy, Ecuador, Greece, Malta).
     *   - exemptionUSDBaseline: `exemptionLocal × USDperLocal` at the
     *     location's seed FX rate.
     *
     * Kernel applies at deathYear:
     *   deceasedShareUSD = bal × 0.5
     *   exemptionUSD     = exemptionUSDBaseline × per-trial FX multiplier
     *   hit              = max(0, deceasedShareUSD − exemptionUSD) × rate
     *   bal             −= hit
     *
     * The 50% deceased-share assumption is a community-property
     * approximation. Per-trial FX (segment-drift × shocks × year-random)
     * means in trials where the local currency strengthens, the exemption's
     * USD value goes up — realistic for cross-border planning.
     *
     * For US locations (full marital deduction → effectiveRate 0) and zero-tax
     * countries (topRate 0 → effectiveRate 0), the hit is silently zero.
     */
    inheritanceTaxByYear?: ({
        effectiveRate: number;
        exemptionUSDBaseline: number;
    } | undefined)[];
    /**
     * Part-time / Barista-FIRE income that runs for a bounded number of years
     * then cliffs to zero. Models the common Coast / Barista pattern where a
     * retiree works a low-stress job for 3–10 years to bridge to full SS claim
     * age. Inflates at the same `incGrowth` rate as the base `monthlyIncome`.
     *
     * Default 0: no part-time income.
     */
    partTimeMonthlyIncome?: number;
    /**
     * Sim year at which part-time income stops (exclusive — year
     * `partTimeEndYear` is the first year at $0). Common case: user plans
     * to work part-time for 5 years, sets `partTimeEndYear = 5`. When
     * unset or ≤ 0, part-time income is ignored entirely.
     */
    partTimeEndYear?: number;
    /**
     * Long-Term Care (LTC) self-insure mode. Each trial rolls an independent
     * Bernoulli check on `ltcProbability`; if it triggers, the simulation
     * deducts `ltcCostPerYearUSD` (today's $, inflated by cumInfl) for
     * `ltcDurationYears` consecutive years starting at a uniformly-sampled
     * age in `[ltcStartAgeMin, ltcStartAgeMax]`. Defaults reflect the US
     * Genworth Cost-of-Care 2024 medians: 70% lifetime probability of needing
     * any LTC at 65+, 2.4-year median duration, $108K/yr median nursing-home
     * private-room cost.
     *
     * Anchored on the OLDEST adult's birth year (the more likely first to need
     * LTC). Caller supplies birth year via `adultBirthYears`.
     *
     * When `ltcSelfInsureEnabled` is false, no per-trial roll happens.
     * Insurance mode (recurring premium) is captured via `ltcInsuranceMonthly`
     * below — the two modes are independent and can stack if the user wants
     * to test "insurance covers part, self-insure the rest".
     */
    ltcSelfInsureEnabled?: boolean;
    ltcProbability?: number;
    ltcCostPerYearUSD?: number;
    ltcDurationYears?: number;
    ltcStartAgeMin?: number;
    ltcStartAgeMax?: number;
    /**
     * Medicaid spend-down (Todo #21). When enabled, US-segment LTC drains
     * are clamped so portfolio balance can't drop below the asset
     * threshold — once the household has spent down to the threshold,
     * Medicaid covers the remaining nursing-home cost. Default false to
     * preserve byte-identical legacy behavior.
     *
     * v1 simplifications (documented in UI):
     *   - Federal floor only — actual state thresholds vary $2K..$15K
     *   - Home equity exemption not modeled (most states exempt up to
     *     $713K equity in primary residence; doesn't affect liquid bal)
     *   - Look-back period (5-year asset transfer rule per IRC § 1396p(c))
     *     not modeled — sim just clamps at the threshold each year
     *   - Couple vs individual threshold not modeled — caller passes
     *     the household-appropriate value
     *   - Foreign segments: Medicaid doesn't apply abroad. Drain proceeds
     *     unclamped during foreign-segment LTC years.
     */
    medicaidSpendDownEnabled?: boolean;
    medicaidAssetThresholdUSD?: number;
    /**
     * Long-Term Care insurance premium — flat monthly $ deducted from balance
     * once the oldest adult reaches `ltcInsuranceStartAge`. Independent of the
     * self-insure roll; can stack. Default 0 (no insurance modelled).
     */
    ltcInsuranceMonthly?: number;
    ltcInsuranceStartAge?: number;
    /**
     * Health Savings Account (HSA) — triple-tax-advantaged medical-expense
     * fund. Tracked as a parallel accumulator to the main portfolio `bal`,
     * so qualified medical withdrawals come out tax-free (and don't tap the
     * regular balance for healthcare costs in the year). Triple-tax-advantage
     * realization in this model:
     *   - Growth: tax-free (HSA balance grows by `hsaAnnualReturnRate`,
     *     deterministic — HSAs are typically conservatively allocated; not
     *     stochastic like the main portfolio)
     *   - Withdrawals for medical: tax-free (deducted from healthcare line of
     *     `cost`, never run through the tax pipeline)
     *   - Contributions: pre-tax (modeled via `hsaAnnualContribution` while
     *     within the window — typical retiree case is 0 since you can't
     *     contribute without earned income + HDHP coverage)
     *
     * When `hsaInitialBalance` is unset or 0 AND no contributions, behavior
     * is identical to pre-#33 (no HSA path executes).
     */
    hsaInitialBalance?: number;
    /** Deterministic annual return rate on HSA balance (decimal, e.g. 0.04). Default 0.04. */
    hsaAnnualReturnRate?: number;
    /** Annual HSA contribution while within the contribution window (USD/year). Default 0. */
    hsaAnnualContribution?: number;
    /**
     * Sim year at which HSA contributions stop (exclusive — year
     * `hsaContributionEndYear` is the first year at $0). Mirrors the
     * `partTimeEndYear` pattern. When unset or ≤ 0, contributions are
     * ignored entirely (typical for retirees with no earned income).
     */
    hsaContributionEndYear?: number;
    /**
     * FX stress test — a one-time abrupt currency move at `fxShockYear`.
     * Distinct from `fxDrift` (ongoing per-year drift) and `currVol` (annual
     * random shock per year). This shock is deterministic: if you set
     * +0.10, the USD weakens 10% in a single year against the local
     * currency, raising all foreign-cost-of-living deductions by ~10%
     * thereafter. Negative values represent USD strengthening.
     *
     * The shock fires at `fxShockYear` regardless of which segment is active
     * (a USD repricing happens whether or not the user is abroad that year)
     * and persists across subsequent moves — only its application to cost is
     * gated on `curIsForeign`. Useful for asking "what if EUR/USD goes from
     * 0.93 to 1.05 in a recession?"
     *
     * Default: no shock applied.
     */
    fxShockYear?: number;
    fxShockPct?: number;
    /**
     * Optional unified event list, projected via `compileLifeEvents` together
     * with the legacy fields (`moveSchedule`, `spouseDeathYear`,
     * `survivorStepUpBenefitUSD`, `oneTimeExpenses`). Caller-supplied entries
     * are NOT deduped against legacy fields — supply one or the other for a
     * given event, not both.
     */
    lifeEvents?: LifeEvent[];
    /**
     * Optional per-year override of the household-wide Medicare monthly cost.
     * Sparse array: index `y` may be `undefined`, which falls through to the
     * active segment's `m.medicareMonthly`. Set entries are used instead of
     * `m.medicareMonthly` when the active segment is US + non-survivor phase.
     *
     * Use case (#31 priority 5 follow-up): inherited-IRA SECURE Act 10-year
     * drain spikes MAGI for the drain years. Pre-65 effects ripple through
     * the ACA-subsidy branch of `segmentCostAtYear` already (via
     * `magiAugmentByYear`). Post-65 effects didn't ripple because Medicare
     * + IRMAA premium was a fixed `m.medicareMonthly` scalar. The runner
     * now pre-computes this override using the IRMAA bracket table for
     * years where MAGI is augmented past a tier boundary.
     *
     * Survivor phase bypasses this override entirely — `p.survivorMedicareMonthly`
     * is the survivor-specific single-IRMAA premium and is read directly.
     * Foreign segments don't read `m.medicareMonthly` at all, so the
     * override is naturally inert when the heir is abroad.
     */
    medicareMonthlyByYear?: (number | undefined)[];
    /**
     * Per-year household pet cost — annual USD in today's dollars, index =
     * sim year. Sparse: missing / undefined / non-positive entries deduct
     * nothing. Inflated by accumulated inflation (cumInfl) at deduction
     * time — USD baseline with NO per-trial FX, same convention as
     * ltcCostPerYearUSD and rental cash flows. Built by `buildPetCostByYear`
     * (household-costs.ts) from household pets (birth year + expected
     * lifespan) and the active location's petCare/petDaycare/petGrooming
     * monthly costs.
     *
     * IMPORTANT: when supplying this, the caller must EXCLUDE the pet cost
     * categories from segment baseCost — the curve replaces the flat
     * inclusion (otherwise pets double-count). Absent → no code path
     * executes (byte-identical legacy behavior).
     */
    petCostByYear?: number[];
    /**
     * Per-year dependent (children / adult dependents) cost — annual USD in
     * today's dollars. Purely additive: the flat baseCost never included
     * dependent-specific costs. Same sparse + cumInfl semantics as
     * petCostByYear. Built by `buildDependentCostByYear`.
     */
    dependentCostByYear?: number[];
    /**
     * Optional rental property portfolio (Todo #34, Stage 4b of #29).
     *
     * For each year in horizon the kernel pre-computes Schedule E aggregates
     * via `aggregateRentalIncome`, then in the year loop:
     *
     *   - Adds `cashFlow × cumInfl` to balance (the actual cash hitting the
     *     bank from rents net of operating expenses + mortgage interest).
     *   - Subtracts `max(0, taxableNet) × cumInfl × rentalEffectiveTaxRate`
     *     as the household's tax bill on the Schedule E line. The clamp at 0
     *     means a paper loss does NOT credit household tax — only its MAGI
     *     ripple flows through (see below). Avoids double-counting the
     *     depreciation shield against income that the segment's pre-baked
     *     monthlyIncomeTax already taxes.
     *   - Augments `magiAugmentByYear[y]` with `taxableNet × cumInfl` so
     *     ACA subsidy calc sees the correct Schedule E impact (positive
     *     pushes MAGI up; negative paper loss correctly reduces it).
     *
     * Ownership window respected: years before `ownedFromYear` or at/after
     * `ownedThroughYear` produce zero contribution. Depreciation rolls off
     * after 27.5 years per `straightLineDepreciation`.
     *
     * Empty/undefined array = no rental income (legacy callers byte-identical).
     */
    rentalProperties?: RentalProperty[];
    /**
     * Effective marginal tax rate applied to rental Schedule E taxable
     * income (decimal, e.g. 0.22 = 22%). Default 0.22. Mirrors the
     * `effectiveTaxRate` field on inheritedIRA events. Single rate is a
     * v1 simplification — actual rates step through brackets year-to-year.
     */
    rentalEffectiveTaxRate?: number;
    /**
     * Filing status for LTCG bracket lookup on propertySale events
     * (Todo #35). Defaults to 'mfj'. Single-filer households should
     * pass 'single'. Drives the `ltcgFederalTax` stacked-on-ordinary
     * computation; the ordinary-income stack is approximated as
     * `monthlyIncome × 12` of the trial.
     */
    propertySaleFilingStatus?: LtcgFilingStatus;
    /**
     * Primary-residence mortgage P+I per month, USD (Todo #28). Sticky —
     * the kernel does NOT multiply this by `cumInfl` because mortgage
     * payments are nominal (the whole point of fixed-rate mortgages, and
     * the planning lever the todo flags around payoff timing).
     *
     * Deducted each year `y < mortgageEndYear` as `mortgageMonthlyPayment × 12`.
     * 0 (or undefined) means no mortgage — dormant code path.
     *
     * Early payoff is modeled by the caller: set `mortgageEndYear` to the
     * payoff year and add a `oneTimeExpense` LifeEvent for the remaining
     * principal in that year. No new LifeEvent kind needed.
     */
    mortgageMonthlyPayment?: number;
    /** Exclusive sim-year cutoff for mortgage payments. 0 = no mortgage. */
    mortgageEndYear?: number;
    /**
     * Optional deterministic-seed RNG. When provided, all kernel-internal
     * random draws (Gaussian return/inflation samples, regime-switch coin
     * flips, currency shocks, LTC start-age + occurrence rolls) consume
     * this function instead of `Math.random`. Defaults to `Math.random`
     * for production use.
     *
     * Use `mulberry32(seed)` to construct a seeded function:
     *   const params = { ..., seededRandom: mulberry32(42) };
     *
     * Two `runMonteCarlo` calls with the same seed and otherwise-identical
     * params produce byte-identical results / paths arrays — which is
     * exactly what kernel-refactor PRs need to prove "no behavior change"
     * without relying on algebraic reduction proofs in commit bodies.
     * Pre-existing legacy callers that don't supply this field continue
     * to use Math.random and remain bit-for-bit identical to pre-PR runs.
     */
    seededRandom?: () => number;
}
export interface MonteCarloResult {
    /** Ending balances for every run, sorted ascending */
    results: number[];
    /** Up to 50 sample portfolio paths (length = years + 1) */
    paths: number[][];
    /** Fraction of runs ending above $0 (0..1) */
    successRate: number;
    /** 50th percentile ending balance */
    median: number;
    p5: number;
    p25: number;
    p75: number;
    p95: number;
}
/**
 * Mulberry32 seeded PRNG factory. Returns a function that produces a
 * deterministic stream of `Math.random()`-compatible values in `[0, 1)`
 * from the supplied 32-bit integer seed.
 *
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 * Quality: passes most BigCrush statistical tests; ~2-3x faster than
 * `Math.random` in modern V8; fine for simulation use, NOT for crypto.
 *
 * Pair with `MonteCarloParams.seededRandom` to make trial trajectories
 * deterministic across runs:
 *   runMonteCarlo({ ..., seededRandom: mulberry32(42) })
 * Same seed → byte-identical `results[]` and `paths[][]`.
 */
export declare function mulberry32(seed: number): () => number;
export declare function runMonteCarlo(p: MonteCarloParams): MonteCarloResult;
/**
 * Compute per-category weighted-average inflation from a location's monthlyCosts.
 * Falls back to 0.025 (2.5%) if no data is present.
 */
export declare function weightedInflationFromLocation(monthlyCosts: Record<string, {
    typical?: number;
    annualInflation?: number;
}> | null | undefined): number;
/**
 * Per-category inflation breakdown for a location's monthlyCosts. Same
 * weighting math as `weightedInflationFromLocation` but returns the full
 * structure so a UI panel (#25) can show *which* categories drive the
 * average.
 *
 * Categories are sorted by `weight` descending, so the heaviest cost
 * lines (rent, healthcare, groceries) appear first. The `weight` field
 * is the share of each category in the total monthly spend (0..1); the
 * `contribution` field is `weight * annualInflation` — the share each
 * category contributes to the weighted average. The sum of all
 * `contribution` values equals `weightedAverage`.
 *
 * Falls back to an empty `categories` array + 0.025 weighted average
 * when no data is present, matching `weightedInflationFromLocation`'s
 * default behavior.
 */
export interface InflationCategoryContribution {
    /** Category key from the location's monthlyCosts (e.g. 'rent', 'healthcare'). */
    key: string;
    /** Monthly cost in local currency (typical value from the seed data). */
    typical: number;
    /** Annual inflation rate as a decimal fraction (0.045 = 4.5%/year). */
    annualInflation: number;
    /** Share of total monthly spend (0..1). Higher = heavier weight in the average. */
    weight: number;
    /** Contribution to weighted average = weight × annualInflation. */
    contribution: number;
}
export interface InflationBreakdown {
    categories: InflationCategoryContribution[];
    /** Weighted-average annual inflation, sum of all `contribution` values. */
    weightedAverage: number;
    /** Total monthly spend across all categories (denominator of `weight`). */
    totalMonthly: number;
}
export declare function inflationBreakdownFromLocation(monthlyCosts: Record<string, {
    typical?: number;
    annualInflation?: number;
}> | null | undefined): InflationBreakdown;
/**
 * Project legacy `MonteCarloParams` fields + any caller-supplied
 * `lifeEvents` into a unified, year-sorted `LifeEvent[]`. The output is
 * filtered to `[0, p.years)` so it matches the kernel's actual execution
 * horizon — events outside that range are silently dropped, mirroring
 * the kernel's own expense filter at the inner loop.
 */
export declare function compileLifeEvents(p: MonteCarloParams): LifeEvent[];
