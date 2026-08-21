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
import { HISTORICAL_RETURNS, bootstrapYear } from './historical-returns.js';
import { aggregateRentalIncome, straightLineDepreciation } from './rental-income.js';
import { ltcgFederalTax } from './tax-sources.js';
export const DEFAULT_REGIME = {
    bullMean: 0.12,
    bullVol: 0.12,
    bearMean: -0.12,
    bearVol: 0.22,
    pBullToBear: 0.15,
    pBearToBull: 0.45,
};
/* ─── ACA subsidy helpers ────────────────────────────────────────────
 * Imported from the shared `lib/aca-constants` module so the Monte
 * Carlo kernel can't drift from `HealthcareService`. Rev Proc 2025-25
 * 2026 applicable-percentage values (2.10-9.96%) and HHS 2026 FPL
 * ($15,960 / $5,600) live there. */
import { fpl2026 as fplMc, applicablePctCliff2026 as applicablePctCliffMc } from './aca-constants.js';
function segmentCostAtYear(m, y, p, survivorPhase = false, magiAugment = 0) {
    if (m.nonHealthcareBase == null)
        return { total: m.baseCost, healthcare: 0 };
    // Survivor-phase overrides: single-filer tax, single-IRMAA Medicare, and a
    // ratio applied to the non-tax / non-healthcare lifestyle portion.
    const lifestyleRatio = survivorPhase ? (p.survivorCostRatio ?? 0.75) : 1;
    const tax = survivorPhase && p.survivorMonthlyIncomeTax != null
        ? p.survivorMonthlyIncomeTax
        : (m.monthlyIncomeTax ?? 0);
    let healthcare = 0;
    // Survivor Medicare swap is only valid when (a) US segment AND (b) survivor
    // is Medicare-eligible (age ≥ 65 at the current sim year). The caller's
    // single-filer IRMAA computation is US-specific — applying it to a
    // foreign segment, or applying it before age 65, materially distorts cost.
    const calYear = (p.simStartYear ?? new Date().getFullYear()) + y;
    const survivorMedicareEligible = survivorPhase
        && p.survivorMedicareMonthly != null
        && m.isUS
        && (p.survivorBirthYear == null || (calYear - p.survivorBirthYear) >= 65);
    if (m.isUS) {
        const adults = p.adultBirthYears ?? [];
        const nAdults = Math.max(1, adults.length || 2);
        // Per-year IRMAA override (#31 priority 5 follow-up). When the runner
        // pre-computed `p.medicareMonthlyByYear[y]` (e.g. for an inherited-IRA
        // drain year that pushes MAGI past an IRMAA tier boundary), use that
        // value instead of the segment's flat `m.medicareMonthly`. Survivor
        // phase bypasses the override (`survivorMedicareMonthly` branch above
        // already returned), so the override only applies to non-survivor +
        // US + age-aware household paths below.
        const medicareTotal = p.medicareMonthlyByYear?.[y] ?? m.medicareMonthly ?? 0;
        if (survivorMedicareEligible) {
            // Survivor phase + age 65+ + US: use the IRMAA-adjusted single-filer
            // premium from the caller (pre-computed for 1 adult, so use as-is).
            healthcare = p.survivorMedicareMonthly;
        }
        else if (!adults.length) {
            // Unknown ages → assume all Medicare-eligible (conservative lower bound).
            healthcare = medicareTotal;
        }
        else {
            // Standard age-aware mix. In survivor phase but pre-65, this still runs
            // and naturally treats the survivor as 1 adult on ACA — except
            // adultBirthYears still includes the deceased spouse, which over-counts
            // adults for the post-death years. Effect is small (ACA per-adult halved
            // when survivor's pre-65 share gets calculated against nAdults=2) but
            // worth noting as a future refinement: drop the deceased birth year
            // from `adults` once survivorPhase is true.
            const medicareCount = adults.filter(by => (calYear - by) >= 65).length;
            const acaCount = nAdults - medicareCount;
            const medicarePerAdult = medicareTotal / nAdults;
            const acaFullPerAdult = (m.acaUnsubsidizedMonthly ?? 0) / nAdults;
            // Year-aware MAGI: transition value in year 0, steady state thereafter.
            // Plus optional caller-supplied augmentation for inherited-IRA drain
            // years (#31 priority 5) — the per-year distribution from a SECURE Act
            // 10-year drain spikes MAGI in the drain window, lowering the ACA
            // subsidy cap below.
            // Per-segment MAGI: after a move, the ACA subsidy must reflect the
            // active location's own self-consistent draw (a cheaper city needs
            // smaller withdrawals → lower MAGI → may qualify where the prior one
            // didn't). `m.magiAnnual` is set per segment by the runner; falls back
            // to the global `p.magiAnnual`. Year 0 still uses the transition spike.
            const baseMagi = (y === 0 && p.transitionMagiAnnual != null)
                ? p.transitionMagiAnnual
                : (m.magiAnnual ?? p.magiAnnual ?? 0);
            const magi = baseMagi + magiAugment;
            const regime = p.subsidyRegime ?? 'enhanced';
            // Annual subsidy cap — regime-dependent:
            //   enhanced: flat cap × MAGI (default 8.5%)
            //   cliff:    sliding applicable-pct by FPL bucket; null above 400% FPL
            let annualCap;
            if (regime === 'cliff') {
                const fplPct = magi > 0 ? (magi / fplMc(nAdults)) * 100 : 0;
                const pct = applicablePctCliffMc(fplPct);
                annualCap = pct != null ? magi * pct : Number.POSITIVE_INFINITY; // above cliff → no subsidy
            }
            else {
                const cap = m.acaSubsidyCapPct ?? 0.085;
                annualCap = magi * cap;
            }
            const acaPerAdult = acaCount > 0 && magi > 0 && isFinite(annualCap)
                ? Math.min(acaFullPerAdult, (annualCap / 12) / acaCount)
                : acaFullPerAdult; // above cliff (or zero MAGI) → full sticker
            healthcare = medicareCount * medicarePerAdult + acaCount * acaPerAdult;
        }
    }
    else {
        // Foreign segment: survivor Medicare swap does NOT apply — that's a
        // US-specific IRMAA calc, not a foreign-healthcare equivalent. Keep the
        // foreign healthcare baseline (caller may scale it down if desired by
        // adjusting `foreignHealthcareMonthly` directly per segment, or via the
        // lifestyle ratio on `nonHealthcareBase` — but not here).
        healthcare = m.foreignHealthcareMonthly ?? 0;
    }
    // Lifestyle ratio scales the non-tax / non-healthcare portion only —
    // housing, food, transport, utilities. Tax + healthcare are already
    // swapped to their survivor values above; scaling them again would
    // double-count the reduction.
    return {
        total: m.nonHealthcareBase * lifestyleRatio + tax + healthcare,
        healthcare,
    };
}
/** Whether any adult crosses 65 exactly at calendar year (simStartYear + y). */
function ageTransitionAtYear(y, p) {
    const adults = p.adultBirthYears;
    if (!adults?.length)
        return false;
    const calYear = (p.simStartYear ?? new Date().getFullYear()) + y;
    return adults.some(by => calYear === by + 65);
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
export function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Box-Muller transform: standard normal sample, threading a caller-supplied
 *  RNG so the same seed produces a reproducible Gaussian stream. */
function normalRandom(rand) {
    let u = 0;
    let v = 0;
    while (u === 0)
        u = rand();
    while (v === 0)
        v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/**
 * Resolve the year-(return, inflation) pair for a single simulation step,
 * given the sampling mode. Encapsulates the mode-specific logic so the
 * core sim loop stays flat.
 */
function sampleYear(mode, y, p, regimeState, rand) {
    switch (mode) {
        case 'bootstrap': {
            return bootstrapYear(rand);
        }
        case 'regime': {
            const cfg = p.regime ?? DEFAULT_REGIME;
            if (regimeState.inBear) {
                if (rand() < cfg.pBearToBull)
                    regimeState.inBear = false;
            }
            else {
                if (rand() < cfg.pBullToBear)
                    regimeState.inBear = true;
            }
            const mean = regimeState.inBear ? cfg.bearMean : cfg.bullMean;
            const vol = regimeState.inBear ? cfg.bearVol : cfg.bullVol;
            const ret = mean + vol * normalRandom(rand);
            const inf = Math.max(0, p.meanInflation + p.volInflation * normalRandom(rand));
            return { ret, inf };
        }
        case 'historical-sequence': {
            const start = p.historicalStartYear ?? HISTORICAL_RETURNS[0].year;
            const startIdx = HISTORICAL_RETURNS.findIndex(r => r.year === start);
            const idx = (startIdx >= 0 ? startIdx : 0) + y;
            const row = HISTORICAL_RETURNS[idx % HISTORICAL_RETURNS.length];
            return { ret: row.sp500, inf: row.cpi };
        }
        case 'normal':
        default: {
            const ret = p.meanReturn + p.volReturn * normalRandom(rand);
            const inf = Math.max(0, p.meanInflation + p.volInflation * normalRandom(rand));
            return { ret, inf };
        }
    }
}
export function runMonteCarlo(p) {
    const { portfolio, monthlyIncome, baseCost, isForeign, fxDrift, runs, years, currVol, incGrowth, } = p;
    const mode = p.returnMode ?? 'normal';
    // RNG resolution. When `p.seededRandom` is unset (the default — every
    // production caller today), `rand` is `Math.random` and trial trajectories
    // are non-deterministic across runs as before. When set (test harnesses
    // and any caller wanting reproducibility), every kernel-internal random
    // draw routes through the supplied function — same seed → byte-identical
    // results / paths arrays. Pair with `mulberry32(seed)` for tests.
    const rand = p.seededRandom ?? Math.random;
    // Historical-sequence is deterministic per start year, so a single "run"
    // is the only meaningful output. Clamp runs to 1 to avoid identical dupes.
    const effectiveRuns = mode === 'historical-sequence' ? 1 : runs;
    const drift = fxDrift || 0;
    const results = [];
    const paths = [];
    const deathYear = p.spouseDeathYear;
    const survivorIncome = p.survivorMonthlyIncome ?? null;
    const survivorRatio = p.survivorCostRatio ?? 0.75;
    // Build the segment schedule. `schedule` is still needed for trial
    // initialisation (`initial = schedule[0]`) and for `activeSegmentAt(y)`
    // — the per-year segment-cost recompute that fires on age transitions
    // and the spouse-death branch. Move *triggering* (the location swap at
    // year y) is now driven by `eventsByYear` below, so we no longer need
    // the year-keyed `movesByYear` map.
    //
    // If no schedule is provided, synthesize a single "year 0" segment from
    // the legacy scalar baseCost / isForeign / fxDrift params. `isUS` is
    // derived as the negation of `isForeign` so kernel paths that gate on
    // `m.isUS` (Medicaid spend-down, US-specific Medicare swap) work for
    // legacy callers without forcing them to provide a full LocationMove.
    const schedule = p.moveSchedule?.length
        ? [...p.moveSchedule].sort((a, b) => a.fromYear - b.fromYear)
        : [{ fromYear: 0, baseCost, isForeign, isUS: !isForeign, fxDrift: drift }];
    const initial = schedule[0];
    // Unified Life Events timeline (#31 steps 2a + 2b + 2c).
    // `compileLifeEvents` projects legacy fields (oneTimeExpenses,
    // spouseDeathYear + survivorStepUpBenefitUSD, moveSchedule) plus any
    // caller-supplied `lifeEvents` into a single year-sorted list,
    // already filtered to the kernel's [0, years) horizon. Indexed by
    // year for O(1) per-year dispatch lookup. Multiple events in the same
    // year stack via array.
    //
    // The kernel now dispatches six event kinds from this map: the four
    // legacy-projected (`move`, `spouseDeath`, `stepUpBasis`,
    // `oneTimeExpense`) plus `oneTimeIncome` (#31 priority 2 —
    // inheritance / home-sale proceeds / payouts) plus `inheritedIRA`
    // (#31 priority 5 — SECURE Act 10-year drain with pre-65 ACA-subsidy
    // MAGI ripple via `magiAugmentByYear`). The `spouseDeath` dispatcher
    // (step 2c) only triggers the survivor-phase transition; the per-year
    // survivor-specific reads of `p.survivor*` fields elsewhere
    // (segmentCostAtYear, the inheritance-tax branch) still run as
    // before, preserving byte-identity. The remaining LifeEvent kinds
    // (`careerChange`, `incomeChange`) have no kernel implementation yet
    // — caller-supplied events of those kinds pass through
    // `compileLifeEvents` into `eventsByYear` but are silently no-op'd
    // in the year loop.
    //
    // Post-65 IRMAA tier ripple (#31 priority 5 follow-up — closed): the
    // runner now pre-computes `p.medicareMonthlyByYear[]` for years where
    // the inherited-IRA drain pushes MAGI past an IRMAA tier boundary.
    // `segmentCostAtYear` reads the override (when set) instead of the
    // flat `m.medicareMonthly`, so the post-65 IRMAA jump materialises in
    // both the household-Medicare branch and the mixed-age ACA + Medicare
    // branch. Survivor phase still bypasses the override; foreign segments
    // never read `m.medicareMonthly` so the override is naturally inert
    // when the heir is abroad.
    const eventsByYear = new Map();
    // Pre-extracted inheritedIRA events for the per-year drain dispatcher
    // (#31 priority 5). Stored separately because their effect spans
    // `drainOverYears` years from the event's `year`, not just the single
    // year the event lives in eventsByYear. The trial loop iterates this
    // list every year and applies the drain when `y` is in the window.
    const inheritedIRAEvents = [];
    // Pre-extracted propertySale events (Todo #35). Indexed by propertyId
    // for O(1) lookup during pre-trial ownership-window override and during
    // the year-loop dispatcher.
    const propertySaleByPropertyId = new Map();
    for (const ev of compileLifeEvents(p)) {
        const list = eventsByYear.get(ev.year) ?? [];
        list.push(ev);
        eventsByYear.set(ev.year, list);
        if (ev.kind === 'inheritedIRA')
            inheritedIRAEvents.push(ev);
        if (ev.kind === 'propertySale')
            propertySaleByPropertyId.set(ev.propertyId, ev);
    }
    // Pre-compute the per-year MAGI augmentation from inherited-IRA drains
    // (#31 priority 5). Year `y`'s augment is the sum of gross per-year
    // distributions from any inheritedIRA event whose drain window covers
    // year `y`. Consumed by `segmentCostAtYear` in the ACA-subsidy branch
    // (pre-65 heirs only — post-65 IRMAA ripple is a documented limitation).
    const magiAugmentByYear = new Array(years).fill(0);
    for (const ev of inheritedIRAEvents) {
        const drainYears = Math.max(1, ev.drainOverYears ?? 10);
        const annualDistribution = ev.balanceUSD / drainYears;
        for (let dy = 0; dy < drainYears; dy++) {
            const y = ev.year + dy;
            if (y >= 0 && y < years)
                magiAugmentByYear[y] += annualDistribution;
        }
    }
    // Pre-compute per-year rental Schedule E aggregates (Todo #34, Stage 4b).
    // Empty/undefined rentalProperties → zeroed arrays → byte-identical to
    // legacy callers (no allocation/perf impact beyond the two arrays).
    // The taxableNet contribution feeds magiAugmentByYear here (today's $);
    // the year-loop applies cumulative inflation when reading.
    //
    // Todo #35: a propertySale event for a property auto-zeros its rental
    // income from the sale year onward — implemented by overriding the
    // property's `ownedThroughYear` to min(existing, saleYear). Per
    // `scheduleENetAnnual`, ownedThroughYear is exclusive, so simYear ===
    // saleYear is already inactive (consistent with the dispatcher firing
    // at year start before the year's rental income would have accrued).
    const rawRentalProps = p.rentalProperties ?? [];
    const rentalProps = propertySaleByPropertyId.size
        ? rawRentalProps.map((rp) => {
            const sale = propertySaleByPropertyId.get(rp.id);
            if (!sale)
                return rp;
            const existingThrough = rp.ownedThroughYear ?? Number.POSITIVE_INFINITY;
            return { ...rp, ownedThroughYear: Math.min(existingThrough, sale.year) };
        })
        : rawRentalProps;
    const rentalEffTaxRate = p.rentalEffectiveTaxRate ?? 0.22;
    const propertySaleFilingStatus = p.propertySaleFilingStatus ?? 'mfj';
    const rentalCashByYear = new Array(years).fill(0);
    const rentalTaxableByYear = new Array(years).fill(0);
    if (rentalProps.length) {
        for (let y = 0; y < years; y++) {
            const agg = aggregateRentalIncome(rentalProps, y);
            rentalCashByYear[y] = agg.totalCashFlow;
            rentalTaxableByYear[y] = agg.totalTaxableNet;
            // Schedule E flows directly into AGI/MAGI per IRC § 62(a)(4).
            // Negative (paper-loss years from depreciation) correctly reduces
            // ACA MAGI for the year — the same direction the user sees on
            // the Sankey diagram's tax-base reduction.
            magiAugmentByYear[y] += agg.totalTaxableNet;
        }
    }
    // Per-year active-segment lookup (input schedule is sorted ascending by
    // fromYear). Parametric on `sched` (#31 priority 4 — survivor
    // relocation): each trial may extend its own schedule when a survivor-
    // triggered relocation fires, so this function reads from the supplied
    // array rather than the outer `schedule`. Steady-state callers (no
    // relocation) pass the outer `schedule`; mid-trial callers (after a
    // relocation fires) pass the trial-local extended schedule.
    const activeSegmentAt = (y, sched = schedule) => {
        let active = sched[0];
        for (const s of sched) {
            if (s.fromYear <= y)
                active = s;
            else
                break;
        }
        return active;
    };
    const partTimeBase = Math.max(0, p.partTimeMonthlyIncome ?? 0);
    const partTimeEndYear = Math.max(0, p.partTimeEndYear ?? 0);
    // Primary-residence mortgage (Todo #28). Both 0 = no mortgage, dormant
    // code path — byte-identical to legacy callers. Pre-extracted at trial
    // setup; the per-year deduction is a single `if` in the cost line below.
    const mortgageMonthlyPayment = Math.max(0, p.mortgageMonthlyPayment ?? 0);
    const mortgageEndYear = Math.max(0, p.mortgageEndYear ?? 0);
    // HSA setup (#33 item 3). Active iff hsaInitialBalance > 0 OR contributions
    // are configured. When inactive, the per-year HSA path is a no-op — the
    // hsaBal accumulator stays at 0, the draw is 0, and `cost` is deducted in
    // full from the regular balance exactly as before.
    const hsaInitial = Math.max(0, p.hsaInitialBalance ?? 0);
    const hsaReturn = p.hsaAnnualReturnRate ?? 0.04;
    const hsaContribution = Math.max(0, p.hsaAnnualContribution ?? 0);
    const hsaContribEndYear = Math.max(0, p.hsaContributionEndYear ?? 0);
    const hsaActive = hsaInitial > 0 || hsaContribution > 0;
    // LTC self-insure setup. Anchor on the OLDEST adult — most likely first
    // to need LTC. simStartYear + sim-year y === calendar year; LTC start
    // year (in sim-year terms) = max(0, ltcStartAge - oldestAdultAge0).
    const ltcSelfInsure = !!p.ltcSelfInsureEnabled;
    const ltcProbability = Math.min(1, Math.max(0, p.ltcProbability ?? 0.70));
    const ltcCostUSD = Math.max(0, p.ltcCostPerYearUSD ?? 108000);
    const ltcDurationY = Math.max(0.1, p.ltcDurationYears ?? 2.4);
    const ltcStartAgeMin = Math.max(50, p.ltcStartAgeMin ?? 78);
    const ltcStartAgeMax = Math.max(ltcStartAgeMin, p.ltcStartAgeMax ?? 88);
    // Medicaid spend-down (Todo #21). When enabled + segment.isUS, clamps
    // each LTC drain so bal can't fall below the threshold. Both fields
    // default to disabled / 2000 for byte-identical legacy when caller
    // doesn't opt in.
    const medicaidEnabled = !!p.medicaidSpendDownEnabled;
    const medicaidThreshold = Math.max(0, p.medicaidAssetThresholdUSD ?? 2000);
    const ltcInsMonthly = Math.max(0, p.ltcInsuranceMonthly ?? 0);
    const ltcInsStartAge = Math.max(0, p.ltcInsuranceStartAge ?? 60);
    const calStart = p.simStartYear ?? new Date().getFullYear();
    const oldestBirthYear = (p.adultBirthYears && p.adultBirthYears.length)
        ? Math.min(...p.adultBirthYears)
        : null;
    const oldestAge0 = oldestBirthYear != null ? (calStart - oldestBirthYear) : null;
    // Single-run modes (historical-sequence) can't average across trials, so a
    // per-trial coin flip would make identical inputs flip between "LTC happened"
    // / "didn't" — unstable success rate and percentiles. In those modes we
    // switch to an expected-value LTC: always-on at the midpoint start age,
    // scaled by ltcProbability. Cross-trial average of the random mode equals
    // the per-year EV deduction, so this preserves intent without the noise.
    const ltcUseExpectedValue = effectiveRuns === 1;
    for (let r = 0; r < effectiveRuns; r++) {
        let bal = portfolio;
        // Parallel HSA accumulator. Stays at 0 when HSA is inactive; otherwise
        // grows deterministically by `hsaReturn` and is drawn against annual
        // healthcare cost each year (#33 item 3).
        let hsaBal = hsaInitial;
        let income = monthlyIncome;
        // Part-time income tracked separately so it can cliff to zero at
        // `partTimeEndYear` without disturbing the base income (SS + pension)
        // stream. Inflates at the same `incGrowth` rate as income.
        let partTime = partTimeBase;
        // Initial cost uses the segment-aware calc if the breakdown is present,
        // otherwise the legacy flat `baseCost`. `costHealthcare` tracks the
        // healthcare-only portion of `cost` in parallel — used for HSA draw
        // each year (#33 item 3).
        let { total: cost, healthcare: costHealthcare } = segmentCostAtYear(initial, 0, p, false, magiAugmentByYear[0] ?? 0);
        let curIsForeign = initial.isForeign;
        let curDrift = initial.fxDrift ?? drift;
        let fxMult = 1;
        // Trial-local schedule starts as a reference to the outer `schedule`
        // and is replaced with an extended copy if a survivor-relocation
        // fires this trial (#31 priority 4). Reading via this binding keeps
        // post-relocation age-transition cost recomputes pointing at the
        // relocate segment instead of the pre-death active segment.
        let trialSchedule = schedule;
        // Survivor-relocation FX swap is deferred until AFTER the death-year
        // inheritance-tax calculation. See the spouseDeath dispatcher comment
        // for rationale (Codex P1 on PR #107). Set in the dispatcher; cleared
        // by the apply-pending-swap block after the IHT line.
        let pendingRelocateSwap = null;
        // Durable across moves: a one-time FX shock is a global USD repricing
        // and survives segment changes, unlike per-segment drift in fxMult.
        // Only applied to cost when in a foreign segment.
        let fxShockMult = 1;
        let cumInfl = 1; // accumulated inflation from year 0 — used to re-baseline cost on moves
        let survivorPhase = false;
        const regimeState = { inBear: false };
        const path = [bal];
        // Per-trial LTC roll. Resolves once at trial start; deterministic across
        // years within the trial. willNeedLtc: 70% of 65+ Americans by Genworth.
        //
        // Single-run modes (historical-sequence, effectiveRuns === 1) can't
        // average across trials, so a per-trial coin flip would make identical
        // inputs flip between "LTC happened" / "LTC didn't" — unstable result.
        // Switch to expected-value mode: per-year occupancy weighted by the
        // start-age distribution. ltcStartSimYear/ltcEndSimYear are not used
        // in EV mode — see ltcEvWeightForYear inside the year loop.
        let ltcStartSimYear = -1;
        let ltcEndSimYear = -1;
        if (ltcSelfInsure && oldestAge0 != null && !ltcUseExpectedValue
            && rand() < ltcProbability) {
            const ltcStartAge = ltcStartAgeMin + rand() * (ltcStartAgeMax - ltcStartAgeMin);
            ltcStartSimYear = Math.max(0, Math.floor(ltcStartAge - oldestAge0));
            ltcEndSimYear = ltcStartSimYear + Math.max(1, Math.round(ltcDurationY));
        }
        for (let y = 0; y < years; y++) {
            // Hoisted from the step-2a position to the top of the year loop —
            // the move dispatch (#31 step 2b) needs to consult this map BEFORE
            // the age-transition / spouse-death branches, so all three event
            // dispatches share one O(1) Map lookup.
            const eventsThisYear = eventsByYear.get(y);
            // Inherited-IRA MAGI augmentation for this year (#31 priority 5).
            // Pre-computed at trial start; pulled here so all per-year cost
            // recomputes (move / age-transition / spouse-death branches below)
            // see the same effective MAGI. Pre-65 ACA-subsidy is the only path
            // that consumes it (post-65 IRMAA tier ripple is a documented
            // limitation — see segmentCostAtYear's medicareMonthly handling).
            const magiAugmentY = magiAugmentByYear[y] ?? 0;
            // Move dispatch (#31 step 2b). Replaces the legacy
            // `movesByYear.has(y)` lookup. The `y > 0` guard preserves legacy
            // behavior: a moveSchedule[0] entry at fromYear=0 is the trial's
            // initial location (already consumed via `initial = schedule[0]`),
            // not a move event the kernel re-applies.
            //
            // Last-write-wins on duplicates: legacy `movesByYear.set(...)`
            // overwrote duplicate-year entries, so the LAST move event for the
            // year is the one that takes effect. Iterate forward and keep
            // updating `moveEvent` so we end on the last match — byte-identical
            // to the legacy Map semantics for callers using `moveSchedule`.
            let moveEvent = null;
            if (y > 0 && eventsThisYear) {
                for (const ev of eventsThisYear) {
                    if (ev.kind === 'move')
                        moveEvent = ev;
                }
            }
            const ageTransition = ageTransitionAtYear(y, p);
            // Location swap at the start of the year: new cost = new baseCost
            // scaled by accumulated inflation so we move to "$X in today's dollars".
            // FX resets (new currency baseline). Optional one-time move cost.
            if (moveEvent) {
                const m = moveEvent.segment;
                const sc = segmentCostAtYear(m, y, p, survivorPhase, magiAugmentY);
                cost = sc.total * cumInfl;
                costHealthcare = sc.healthcare * cumInfl;
                curIsForeign = m.isForeign;
                curDrift = m.fxDrift ?? curDrift;
                fxMult = 1;
                if (m.moveCostUSD)
                    bal -= m.moveCostUSD;
            }
            else if (ageTransition) {
                // Medicare crossover or any age-65 transition in a US segment —
                // recompute the segment's cost without resetting FX. Reads from
                // `trialSchedule` so a post-spouseDeath survivor-relocation
                // (#31 priority 4) sticks across the transition.
                const active = activeSegmentAt(y, trialSchedule);
                const sc = segmentCostAtYear(active, y, p, survivorPhase, magiAugmentY);
                cost = sc.total * cumInfl;
                costHealthcare = sc.healthcare * cumInfl;
            }
            // Spouse-death dispatch (#31 step 2c). Replaces the legacy
            // `if (deathYear === y)` trigger with a scan of `eventsThisYear`
            // for a `spouseDeath` event. Mutations are unchanged: flip
            // `survivorPhase`, swap `income` to the survivor income, and
            // recompute `cost` / `costHealthcare` for the active segment with
            // the survivor flag set (which routes segmentCostAtYear through
            // the survivor-tax / survivor-Medicare / lifestyle-ratio paths
            // already plumbed at lines 469–502).
            //
            // The `!survivorPhase` guard is preserved verbatim — single-shot
            // transition, idempotent if multiple spouseDeath events somehow
            // land in the same year. Position in loop is unchanged: AFTER
            // move + age-transition cost recompute, BEFORE early-pass
            // stepUpBasis dispatch (so the basis bump still rides on top of
            // the post-survivor cost).
            //
            // The kernel still consumes survivor parameters via direct reads
            // of `p.survivor*` fields elsewhere (segmentCostAtYear, the
            // inheritance-tax branch below). The event's `survivorOverrides`
            // payload exists in the type for future work but is intentionally
            // not read here — applying it would change kernel behavior, which
            // step 2c explicitly avoids to preserve byte-identity for legacy
            // callers. A future pass could overlay `survivorOverrides` onto
            // `p` at dispatch time so the rest of the kernel sees it.
            //
            // NOTE: stepped-up basis bump previously lived in this branch as
            // an inline `bal += p.survivorStepUpBenefitUSD`. Moved to the
            // early-pass dispatcher below in step 2a (driven by `stepUpBasis`
            // events emitted by `compileLifeEvents` whenever spouseDeathYear
            // is set + survivorStepUpBenefitUSD > 0).
            let spouseDeathThisYear = false;
            if (eventsThisYear) {
                for (const ev of eventsThisYear) {
                    if (ev.kind === 'spouseDeath') {
                        spouseDeathThisYear = true;
                        break;
                    }
                }
            }
            if (!survivorPhase && spouseDeathThisYear) {
                survivorPhase = true;
                if (survivorIncome != null)
                    income = survivorIncome;
                // Survivor relocation (#31 priority 4) — if the caller supplied
                // `p.survivorRelocate`, treat the death year as a location swap
                // to that segment (mirror of regular move dispatch). Extends
                // the trial-local schedule with the relocate segment so future
                // age-transition recomputes read from it.
                //
                // Stickiness: the relocate segment is appended to `trialSchedule`
                // with `fromYear = y`, sorted ascending. Year-based moves on
                // `moveSchedule` whose `fromYear > y` still fire later (the user
                // can pre-plan a post-survivor-relocation move). Year-based moves
                // whose `fromYear ≤ y` are unaffected — they already executed.
                if (p.survivorRelocate) {
                    const relocate = { ...p.survivorRelocate, fromYear: y };
                    trialSchedule = [...trialSchedule, relocate]
                        .sort((a, b) => a.fromYear - b.fromYear);
                    const sc = segmentCostAtYear(relocate, y, p, true, magiAugmentY);
                    cost = sc.total * cumInfl;
                    costHealthcare = sc.healthcare * cumInfl;
                    // Defer the FX-state swap until AFTER the death-year inheritance-tax
                    // calculation. Codex P1 on PR #107: the runner pre-bakes
                    // `inheritanceTaxByYear[y]` from the regular move schedule (the
                    // deceased's domicile at death), so swapping FX state here would
                    // mis-denominate the exemption when the survivor relocates to a
                    // different currency on the death year. Pinning the swap until
                    // after IHT keeps `curIsForeign / fxMult / curDrift / fxShockMult`
                    // and the year-y `currShock` sample on the pre-relocation segment
                    // for the IHT line, matching the runner's pre-baked entry.
                    //
                    // The post-IHT swap restores byte-identity for non-deathYear
                    // relocate scenarios (none today — survivor relocate fires only
                    // on deathYear by construction), and for the rest of year y the
                    // cost-deduction sees the post-relo segment via `cost` /
                    // `costHealthcare` (already recomputed above) plus the new FX
                    // state. There is a small year-y artifact in `costShockMult`
                    // because `currShock` was sampled with pre-relocation
                    // `curIsForeign` — the deceased's currency volatility
                    // momentarily scales survivor's USD cost. Centered on 1 with
                    // O(currVol) variance; one-year noise. Tolerable in exchange
                    // for the much larger IHT correctness fix.
                    pendingRelocateSwap = relocate;
                    if (relocate.moveCostUSD)
                        bal -= relocate.moveCostUSD;
                }
                else {
                    // No relocation — recompute cost on the pre-death active
                    // segment with the survivor flag. Same as legacy spouseDeath.
                    const active = activeSegmentAt(y, trialSchedule);
                    // Back out cumulative inflation so segmentCostAtYear gets today's $,
                    // then re-inflate for the sim's current-year dollars.
                    const sc = segmentCostAtYear(active, y, p, true, magiAugmentY);
                    cost = sc.total * cumInfl;
                    costHealthcare = sc.healthcare * cumInfl;
                }
            }
            // Early-pass dispatch (#31 steps 2a + 2b + 2c) — handles event
            // kinds whose effect is a simple balance mutation BEFORE the
            // year's random return / inflation sampling. Currently only
            // `stepUpBasis`.
            //
            // `move` events are consumed by the move-dispatch block at the
            // top of the year loop (#31 step 2b). `spouseDeath` events are
            // consumed by the spouse-death-dispatch block above (#31 step 2c).
            // `oneTimeIncome` events are consumed by the late-pass dispatch
            // below (#31 priority 2). `inheritedIRA` events are consumed by
            // the inheritedIRA-drain loop below the late-pass dispatch (#31
            // priority 5) — they iterate the pre-extracted `inheritedIRAEvents`
            // list because their effect spans multiple years. The remaining
            // new kinds (`careerChange`, `incomeChange`) live in this map but
            // have no kernel implementation yet.
            //
            // Reuses `eventsThisYear` already looked up at the top of the loop.
            if (eventsThisYear) {
                for (const ev of eventsThisYear) {
                    if (ev.kind === 'stepUpBasis') {
                        bal += ev.benefitUSD;
                    }
                }
            }
            const { ret, inf } = sampleYear(mode, y, p, regimeState, rand);
            const currShock = curIsForeign ? 1 + currVol * normalRandom(rand) : 1;
            if (curIsForeign && curDrift)
                fxMult *= (1 + curDrift);
            // FX stress test: deterministic one-time shock at fxShockYear. Fires
            // regardless of current segment (a USD repricing happens whether or not
            // the user is abroad that year), but its multiplier is only applied to
            // cost when in a foreign segment — see the cost-deduction line below.
            if (p.fxShockYear != null && y === p.fxShockYear && p.fxShockPct) {
                fxShockMult *= (1 + p.fxShockPct);
            }
            // Phase 3b — spouse-death inheritance tax. One-time hit at the death
            // year, applied AFTER the FX state is settled for year y so the
            // exemption-in-USD reflects per-trial FX volatility (segment-drift ×
            // accumulated shocks × current-year random shock). Skipped silently
            // when the active location has spouseExemption='full' or topRate=0
            // (effectiveRate=0 — caller pre-flattened that logic).
            if (deathYear != null && y === deathYear) {
                const inhEntry = p.inheritanceTaxByYear?.[y];
                if (inhEntry && inhEntry.effectiveRate > 0) {
                    const effectiveFx = curIsForeign ? currShock * fxMult * fxShockMult : 1;
                    const exemptionUSD = inhEntry.exemptionUSDBaseline * effectiveFx;
                    const deceasedShareUSD = bal * 0.5;
                    const taxableUSD = Math.max(0, deceasedShareUSD - exemptionUSD);
                    bal -= taxableUSD * inhEntry.effectiveRate;
                }
            }
            // Apply the survivor-relocation FX swap deferred from the spouseDeath
            // dispatcher (Codex P1 on PR #107). The IHT block above has already
            // consumed the pre-relocation FX state for the deceased's exemption
            // denomination; from this point onward in year y (cost-deduction,
            // late-pass events, HSA, mortgage), the survivor's destination
            // segment governs FX behavior — matching regular-move semantics.
            if (pendingRelocateSwap) {
                curIsForeign = pendingRelocateSwap.isForeign;
                curDrift = pendingRelocateSwap.fxDrift ?? curDrift;
                fxMult = 1;
                pendingRelocateSwap = null;
            }
            // Part-time income stops at `partTimeEndYear` (exclusive — year == end is zero).
            const activePartTime = (partTimeEndYear > 0 && y < partTimeEndYear) ? partTime : 0;
            bal *= (1 + ret);
            // Brokerage / account fee (A3 drift item 1). Deducted right after the
            // year's return, before the year's income/cost cash flow. Both terms
            // default to 0 (undefined -> 0 via `??`), so an absent or all-zero
            // fee config is a bit-identical no-op — `bal -= bal * 0 + 0 * cumInfl`
            // leaves `bal` unchanged.
            bal -= bal * (p.brokerageExpenseRatio ?? 0) + (p.brokerageAnnualFee ?? 0) * cumInfl;
            const effectiveFxShock = curIsForeign ? fxShockMult : 1;
            const costShockMult = currShock * fxMult * effectiveFxShock;
            // HSA logic (#33 item 3) — runs only when HSA is active. Order:
            //   1. Apply deterministic growth to existing balance.
            //   2. Add the year's contribution (within the contribution window).
            //   3. Compute the year's annual healthcare cost with same shocks
            //      that scale total cost (FX, currVol, fxShock).
            //   4. Draw min(hsaBal, healthcareAnnual), clamped at 0 — tax-free
            //      withdrawal cannot be negative, even when costShockMult goes
            //      below 0 in degenerate trials. (Codex P2 on PR #92.)
            //   5. Reduce the regular cost deduction by the HSA draw.
            // When inactive, hsaDraw stays at 0 and the equation matches pre-#33.
            //
            // Why the Math.max floor: `costShockMult = currShock * fxMult *
            // effectiveFxShock` where `currShock = 1 + currVol * normalRandom()`
            // is unbounded below 0 in foreign segments. With high `currVol`
            // (e.g. 50%), a -2σ Gaussian draw makes currShock < 0, flipping
            // healthcareAnnual negative. Without the clamp, hsaDraw would also
            // go negative, then `hsaBal -= hsaDraw` would ADD to HSA and
            // `bal += hsaDraw` would SUBTRACT from portfolio — the opposite
            // of "withdraw up to healthcare cost." Floor at 0 to match the
            // documented "tax-free withdrawal" semantics in either edge case.
            let hsaDraw = 0;
            if (hsaActive) {
                hsaBal *= (1 + hsaReturn);
                if (hsaContribEndYear > 0 && y < hsaContribEndYear) {
                    hsaBal += hsaContribution;
                }
                const healthcareAnnual = Math.max(0, costHealthcare * 12 * costShockMult);
                hsaDraw = Math.min(hsaBal, healthcareAnnual);
                hsaBal -= hsaDraw;
            }
            // Phantom-income clamp — mirror of the HSA `healthcareAnnual` floor
            // a few lines above. `costShockMult = currShock * fxMult * effectiveFxShock`
            // where `currShock = 1 + currVol * normalRandom()` is unbounded below 0
            // in foreign segments under high currVol + a deep-negative Gaussian draw.
            // Without this floor, `bal -= cost * 12 * costShockMult` would flip into
            // a positive bal addition — fictitious income from no source. Expenses
            // can be reduced (favorable FX, costShockMult between 0 and 1) but cannot
            // fund the portfolio.
            const costAnnualWithShock = Math.max(0, cost * 12 * costShockMult);
            bal += (income + activePartTime) * 12 - costAnnualWithShock + hsaDraw;
            // Primary-residence mortgage P+I (Todo #28). Sticky — NO cumInfl
            // multiplier (mortgage payments are nominal) and NO costShockMult
            // (USD mortgage doesn't track foreign FX). Deducted as a sibling
            // line so it lands AFTER income & main cost but BEFORE the late-
            // pass event dispatcher (where a oneTimeExpense for early-payoff
            // remaining principal would land in the same year).
            if (mortgageMonthlyPayment > 0 && y < mortgageEndYear) {
                bal -= mortgageMonthlyPayment * 12;
            }
            // Late-pass dispatch (#31 step 2a + priority 2) — handles event
            // kinds whose effect is a balance mutation AFTER the year's
            // income / cost mutation. Two kinds today: `oneTimeExpense`
            // (`bal -=`) and `oneTimeIncome` (`bal +=`). Same `eventsThisYear`
            // array as the early-pass dispatch above; we iterate it twice
            // with different kind filters because the legacy ordering put
            // stepUpBasis BEFORE the random sample and one-time lumps AFTER
            // the cost deduction. Preserving that ordering keeps results
            // byte-identical for legacy callers.
            //
            // Inflation scaling: `e.inflate ?? true` matches the legacy
            // default — omitted means inflate-by-CPI. Set false for
            // nominal-dollar fixed payments (annuity payouts, mortgage
            // payoff, fixed-amount life insurance, court-ordered settlement
            // amounts in nominal dollars).
            //
            // Symmetry: oneTimeIncome and oneTimeExpense use identical
            // inflate-default semantics. An inheritance amount expressed in
            // today's dollars grows with CPI by the year it actually arrives,
            // matching how the user's expense estimates do the same.
            if (eventsThisYear) {
                for (const ev of eventsThisYear) {
                    if (ev.kind === 'oneTimeExpense') {
                        const inflated = (ev.inflate ?? true) ? ev.amountUSD * cumInfl : ev.amountUSD;
                        bal -= inflated;
                    }
                    else if (ev.kind === 'oneTimeIncome') {
                        const inflated = (ev.inflate ?? true) ? ev.amountUSD * cumInfl : ev.amountUSD;
                        bal += inflated;
                    }
                    else if (ev.kind === 'propertySale') {
                        // Property sale (Todo #35) — Sec 1250 depreciation recapture
                        // + LTCG on the gain. Sale prices in nominal year-of-sale
                        // dollars; multiply by `cumInfl` so the user can enter
                        // today-dollar estimates and have them grow with CPI.
                        //
                        // Math:
                        //   netSale       = (salePrice − sellingExpenses) × cumInfl
                        //   accDepreciation = sum_{startYr..saleYr} straightLineDepreciation
                        //   adjustedBasis = depreciableBasis − accDepreciation
                        //   gain          = netSale − adjustedBasis        (signed)
                        //   recapTaxable  = min(max(0, gain), accDepreciation)
                        //   ltcgTaxable   = max(0, gain) − recapTaxable
                        //   recaptureTax  = recapTaxable × 0.25  (Sec 1250 cap)
                        //   ltcgTax       = ltcgFederalTax(ltcgTaxable, ordinary, status)
                        //   bal          += netSale − adjustedBasis × 0  (basis is
                        //                   already-spent capital; not a current-year
                        //                   inflow) − recaptureTax − ltcgTax
                        //
                        // Equivalently the user's net cash from sale is:
                        //   bal += netSale − recaptureTax − ltcgTax
                        // (assuming no mortgage payoff at sale — out of scope v1)
                        const prop = rawRentalProps.find((rp) => rp.id === ev.propertyId);
                        if (!prop)
                            continue; // unknown propertyId — silent no-op
                        const sellingExp = ev.sellingExpenses ?? 0;
                        const netSale = Math.max(0, ev.salePriceUSD - sellingExp) * cumInfl;
                        // Accumulated depreciation in today's $ — basis is also in
                        // today's $ so they correctly offset; LTCG / recapture taxes
                        // apply to the inflated nominal gain, hence cumInfl on netSale
                        // alone. Same convention as oneTimeExpense / oneTimeIncome.
                        let accDep = 0;
                        for (let dy = prop.depreciationStartYear; dy < y; dy++) {
                            accDep += straightLineDepreciation(prop.depreciableBasis, dy, prop.depreciationStartYear);
                        }
                        const inflatedBasis = Math.max(0, prop.depreciableBasis - accDep) * cumInfl;
                        const gain = netSale - inflatedBasis;
                        let totalTax = 0;
                        if (gain > 0) {
                            const recapTaxable = Math.min(gain, accDep * cumInfl);
                            const ltcgTaxable = gain - recapTaxable;
                            const recaptureTax = recapTaxable * 0.25;
                            // Stack LTCG on top of the trial's current ordinary income
                            // (monthlyIncome × 12 × cumInfl approximates today's tax-bracket
                            // position, scaled to nominal). Survivor phase uses survivor
                            // income; same approximation.
                            const ordinaryStack = (survivorPhase
                                ? p.survivorMonthlyIncome ?? p.monthlyIncome
                                : p.monthlyIncome) * 12 * cumInfl;
                            const ltcgTax = ltcgFederalTax(ltcgTaxable, ordinaryStack, propertySaleFilingStatus);
                            totalTax = recaptureTax + ltcgTax;
                        }
                        // Capital loss (gain ≤ 0): no tax owed; full netSale to bal.
                        // Loss-against-ordinary carryforward (IRC § 1211(b) $3K/yr
                        // limit) is out of scope v1.
                        bal += netSale - totalTax;
                    }
                }
            }
            // Inherited-IRA per-year drain (#31 priority 5). Iterates all
            // inheritedIRA events (not just events at year `y`) because the
            // drain effect spans `drainOverYears` years from the event's
            // `year`. For each event whose drain window covers `y`, add the
            // post-tax distribution to balance.
            //
            // Distribution math:
            //   gross = (balanceUSD / drainYears) × cumInfl
            //   net   = gross × (1 - effectiveTaxRate)
            //   bal  += net
            //
            // The gross distribution was already added to `magiAugmentByYear[y]`
            // at trial start, so the ACA-subsidy branch in segmentCostAtYear
            // sees the elevated MAGI for cost recompute (consumed earlier this
            // tick). The post-tax `net` is what actually grows the heir's
            // portfolio.
            //
            // Tax model: flat `effectiveTaxRate` (default 22%) — the user's
            // estimate of their marginal ordinary-income rate during the
            // drain. A future iteration could recompute single-filer brackets
            // per year based on stacked income; out of scope for this pass.
            for (const ev of inheritedIRAEvents) {
                const drainYears = Math.max(1, ev.drainOverYears ?? 10);
                const yearOfDrain = y - ev.year;
                if (yearOfDrain >= 0 && yearOfDrain < drainYears) {
                    const gross = (ev.balanceUSD / drainYears) * cumInfl;
                    const taxRate = ev.effectiveTaxRate ?? 0.22;
                    bal += gross * (1 - taxRate);
                }
            }
            // Rental Schedule E cash flow + tax (Todo #34, Stage 4b of #29).
            // Cash inflow is the gross rental cashFlow (rents net of operating
            // expenses + mortgage interest, sign included). Tax is the household's
            // bill on Schedule E line 26, computed as max(0, taxableNet) × rate
            // — clamping at 0 so a paper loss does NOT credit household tax. The
            // shield's downward MAGI ripple already flowed through magiAugmentByYear
            // at trial start; this avoids double-counting it against household
            // ordinary-income tax (which is pre-baked into the segment cost).
            if (rentalProps.length) {
                const rentalCashThisYear = rentalCashByYear[y] * cumInfl;
                const rentalTaxableThisYear = rentalTaxableByYear[y] * cumInfl;
                const rentalTaxOwed = Math.max(0, rentalTaxableThisYear) * rentalEffTaxRate;
                bal += rentalCashThisYear - rentalTaxOwed;
            }
            // Long-Term Care deductions (independent of one-time expenses; see #21).
            // Self-insure: per-trial probabilistic LTC stay. Insurance: flat
            // monthly premium once the oldest adult crosses ltcInsuranceStartAge.
            //
            // Medicaid spend-down (Todo #21): when enabled AND the active
            // segment is US, the per-year drain is clamped so bal cannot
            // fall below `medicaidThreshold`. The unspent remainder is
            // implicitly covered by Medicaid (no household impact). Foreign
            // segments bypass the clamp — Medicaid doesn't apply abroad.
            if (ltcSelfInsure && oldestAge0 != null) {
                const isUSNow = medicaidEnabled
                    ? activeSegmentAt(y, trialSchedule).isUS
                    : false;
                const applyLtcDraw = (proposedDraw) => {
                    const draw = (medicaidEnabled && isUSNow)
                        ? Math.min(proposedDraw, Math.max(0, bal - medicaidThreshold))
                        : proposedDraw;
                    bal -= draw;
                };
                if (ltcUseExpectedValue) {
                    // Spread the EV across the start-age distribution, not the midpoint.
                    // Random mode: ltcStartSimYear = floor(start - oldestAge0), window
                    // covers sim years [start_y, start_y + dur). So sim year y is in
                    // some trial's window iff start ∈ [oldestAge0 + y - dur + 1,
                    // oldestAge0 + y + 1). Intersect with the user's [min, max] start
                    // range and divide by the range to get P(year y in window | LTC),
                    // then multiply by ltcProbability for the unconditional weight.
                    // Sum of occupancy across years equals `dur`, so total EV cost
                    // equals ltcProbability × cost × dur — matching random mode's
                    // cross-trial expectation.
                    //
                    // EV mode + Medicaid is an approximation: the clamp is applied
                    // to the probability-weighted draw, not to a real per-trial
                    // depletion. For accurate Medicaid-protected scenarios prefer
                    // random mode. Documented in the UI hint.
                    const dur = Math.max(1, Math.round(ltcDurationY));
                    const startRange = ltcStartAgeMax - ltcStartAgeMin;
                    let occupancy;
                    if (startRange <= 0) {
                        // Degenerate uniform (min === max): fixed start age.
                        const startSimYear = Math.max(0, Math.floor(ltcStartAgeMin - oldestAge0));
                        occupancy = (y >= startSimYear && y < startSimYear + dur) ? 1 : 0;
                    }
                    else {
                        const lowerStart = Math.max(ltcStartAgeMin, oldestAge0 + y - dur + 1);
                        const upperStart = Math.min(ltcStartAgeMax, oldestAge0 + y + 1);
                        occupancy = Math.max(0, upperStart - lowerStart) / startRange;
                    }
                    if (occupancy > 0) {
                        applyLtcDraw(ltcCostUSD * cumInfl * ltcProbability * occupancy);
                    }
                }
                else if (y >= ltcStartSimYear && y < ltcEndSimYear && ltcStartSimYear >= 0) {
                    // Random mode: per-trial roll already gated whether this trial sees
                    // LTC at all; deduct the full cost in each year of the window.
                    applyLtcDraw(ltcCostUSD * cumInfl);
                }
            }
            if (ltcInsMonthly > 0 && oldestAge0 != null && (oldestAge0 + y) >= ltcInsStartAge) {
                bal -= ltcInsMonthly * 12 * cumInfl;
            }
            cost *= (1 + inf);
            costHealthcare *= (1 + inf);
            cumInfl *= (1 + inf);
            income *= (1 + incGrowth);
            partTime *= (1 + incGrowth);
            path.push(bal);
        }
        results.push(bal);
        if (r < 50)
            paths.push(path);
    }
    results.sort((a, b) => a - b);
    const successRate = results.filter((v) => v > 0).length / effectiveRuns;
    // Percentile sampling (matches original floor-index behavior)
    const at = (q) => results[Math.floor(effectiveRuns * q)] ?? 0;
    return {
        results,
        paths,
        successRate,
        median: at(0.5),
        p5: at(0.05),
        p25: at(0.25),
        p75: at(0.75),
        p95: at(0.95),
    };
}
/**
 * Compute per-category weighted-average inflation from a location's monthlyCosts.
 * Falls back to 0.025 (2.5%) if no data is present.
 */
export function weightedInflationFromLocation(monthlyCosts) {
    if (!monthlyCosts)
        return 0.025;
    const cats = Object.values(monthlyCosts);
    const totalBase = cats.reduce((s, c) => s + (c?.typical ?? 0), 0);
    if (totalBase <= 0)
        return 0.025;
    let weighted = 0;
    for (const c of cats) {
        const w = (c?.typical ?? 0) / totalBase;
        weighted += w * (c?.annualInflation ?? 0.025);
    }
    return weighted;
}
export function inflationBreakdownFromLocation(monthlyCosts) {
    if (!monthlyCosts)
        return { categories: [], weightedAverage: 0.025, totalMonthly: 0 };
    const entries = Object.entries(monthlyCosts);
    const totalMonthly = entries.reduce((s, [, c]) => s + (c?.typical ?? 0), 0);
    if (totalMonthly <= 0)
        return { categories: [], weightedAverage: 0.025, totalMonthly: 0 };
    const categories = entries
        .filter(([, c]) => (c?.typical ?? 0) > 0)
        .map(([key, c]) => {
        const typical = c?.typical ?? 0;
        const annualInflation = c?.annualInflation ?? 0.025;
        const weight = typical / totalMonthly;
        return {
            key,
            typical,
            annualInflation,
            weight,
            contribution: weight * annualInflation,
        };
    })
        .sort((a, b) => b.weight - a.weight);
    const weightedAverage = categories.reduce((s, c) => s + c.contribution, 0);
    return { categories, weightedAverage, totalMonthly };
}
/**
 * Project legacy `MonteCarloParams` fields + any caller-supplied
 * `lifeEvents` into a unified, year-sorted `LifeEvent[]`. The output is
 * filtered to `[0, p.years)` so it matches the kernel's actual execution
 * horizon — events outside that range are silently dropped, mirroring
 * the kernel's own expense filter at the inner loop.
 */
export function compileLifeEvents(p) {
    const events = [];
    const inHorizon = (year) => year >= 0 && year < p.years;
    for (const m of p.moveSchedule ?? []) {
        if (inHorizon(m.fromYear))
            events.push({ kind: 'move', year: m.fromYear, segment: m });
    }
    if (p.spouseDeathYear != null && inHorizon(p.spouseDeathYear)) {
        const survivorOverrides = pickDefined({
            monthlyIncome: p.survivorMonthlyIncome,
            costRatio: p.survivorCostRatio,
            monthlyIncomeTax: p.survivorMonthlyIncomeTax,
            medicareMonthly: p.survivorMedicareMonthly,
            birthYear: p.survivorBirthYear,
        });
        events.push({
            kind: 'spouseDeath',
            year: p.spouseDeathYear,
            survivorOverrides: Object.keys(survivorOverrides).length > 0 ? survivorOverrides : undefined,
        });
        if (p.survivorStepUpBenefitUSD != null && p.survivorStepUpBenefitUSD > 0) {
            events.push({ kind: 'stepUpBasis', year: p.spouseDeathYear, benefitUSD: p.survivorStepUpBenefitUSD });
        }
    }
    for (const e of p.oneTimeExpenses ?? []) {
        if (!e || !(e.amountUSD > 0) || !inHorizon(e.year))
            continue;
        events.push({
            kind: 'oneTimeExpense',
            year: e.year,
            amountUSD: e.amountUSD,
            label: e.label,
            inflate: e.inflate,
        });
    }
    for (const e of p.oneTimeIncomes ?? []) {
        if (!e || !(e.amountUSD > 0) || !inHorizon(e.year))
            continue;
        events.push({
            kind: 'oneTimeIncome',
            year: e.year,
            amountUSD: e.amountUSD,
            label: e.label,
            inflate: e.inflate,
        });
    }
    for (const e of p.lifeEvents ?? []) {
        if (inHorizon(e.year))
            events.push(e);
    }
    events.sort((a, b) => a.year - b.year);
    return events;
}
/** Drop keys whose value is null/undefined, preserving the input shape. */
function pickDefined(obj) {
    const out = {};
    for (const k in obj)
        if (obj[k] != null)
            out[k] = obj[k];
    return out;
}
