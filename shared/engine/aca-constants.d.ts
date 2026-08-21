/**
 * Single source of truth for ACA subsidy math constants and helpers.
 *
 * Previously these lived in two places:
 *   - `src/app/services/healthcare.service.ts` (UI decisions)
 *   - `src/app/lib/monte-carlo.ts` (per-year simulation cost step)
 *
 * Keeping two copies led to drift — the 2026-04-20 law-conformance
 * review found both tables were still pre-ARPA 2021 values. Extracted
 * here so future updates happen in one place. See also the structured
 * `*_SOURCES_2026` exports below which UI components surface through
 * <app-source-tooltip>.
 */
import type { Source } from './types.js';
/** Structured citations for the 2026 ACA applicable-percentage table. */
export declare const ACA_PCT_SOURCES_2026: Source[];
/** Structured citations for the 2026 HHS Federal Poverty Level table. */
export declare const FPL_SOURCES_2026: Source[];
export declare const FPL_2026_BASE = 15960;
export declare const FPL_2026_PER_ADDL = 5680;
/** 2026 HHS Federal Poverty Level for a continental-US household. */
export declare function fpl2026(size: number): number;
/**
 * 2026 cliff-regime applicable-percentage. Returns the fraction of
 * MAGI the enrollee contributes toward the benchmark silver plan, or
 * `null` below 100% FPL (Medicaid territory in most states) or above
 * 400% FPL (the cliff — no subsidy).
 */
export declare function applicablePctCliff2026(fplPct: number): number | null;
export declare const ENHANCED_MAGI_CAP = 0.085;
export declare const MEDICARE_ELIGIBILITY_AGE = 65;
