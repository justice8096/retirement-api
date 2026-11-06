import type { Source, TaxBracket } from './types.js';

/**
 * 2026 US federal bracket tables — mirrors `FED_BRACKETS_2026_MFJ` /
 * `_SINGLE` in retirement-api/shared/taxes.js. Used by TaxService as a
 * fallback when a US location's seed data doesn't carry federal
 * brackets (most US locations don't — they ship a single monthly
 * stored value). Keep both sides in sync.
 */
export const FED_BRACKETS_2026_MFJ: TaxBracket[] = [
  { min: 0,       max: 24800,  rate: 0.10 },
  { min: 24800,   max: 100800, rate: 0.12 },
  { min: 100800,  max: 211400, rate: 0.22 },
  { min: 211400,  max: 403550, rate: 0.24 },
  { min: 403550,  max: 512450, rate: 0.32 },
  { min: 512450,  max: 768700, rate: 0.35 },
  { min: 768700,  max: null,   rate: 0.37 },
];

export const FED_BRACKETS_2026_SINGLE: TaxBracket[] = [
  { min: 0,       max: 12400,  rate: 0.10 },
  { min: 12400,   max: 50400,  rate: 0.12 },
  { min: 50400,   max: 105700, rate: 0.22 },
  { min: 105700,  max: 201775, rate: 0.24 },
  { min: 201775,  max: 256225, rate: 0.32 },
  { min: 256225,  max: 640600, rate: 0.35 },
  { min: 640600,  max: null,   rate: 0.37 },
];

/** 2026 standard deduction by filing status (Rev. Proc. 2025-32 § 3.17). */
export const FED_STD_DEDUCTION_2026 = {
  mfj:    32200,
  single: 16100,
  hoh:    24150,
} as const;

/**
 * 2027 US federal tables (IRS Rev. Proc. 2026-35, released Nov 5 2026,
 * IR-2026-133). The forward-looking Monte Carlo tax pass uses these as its
 * base year; the 2026 tables above stay exported for current-year helpers.
 */
export const TAX_TABLE_YEAR = 2027;

export const FED_BRACKETS_2027_MFJ: TaxBracket[] = [
  { min: 0,       max: 25600,  rate: 0.10 },
  { min: 25600,   max: 104050, rate: 0.12 },
  { min: 104050,  max: 218250, rate: 0.22 },
  { min: 218250,  max: 416650, rate: 0.24 },
  { min: 416650,  max: 529100, rate: 0.32 },
  { min: 529100,  max: 793650, rate: 0.35 },
  { min: 793650,  max: null,   rate: 0.37 },
];

export const FED_BRACKETS_2027_SINGLE: TaxBracket[] = [
  { min: 0,       max: 12800,  rate: 0.10 },
  { min: 12800,   max: 52025,  rate: 0.12 },
  { min: 52025,   max: 109125, rate: 0.22 },
  { min: 109125,  max: 208325, rate: 0.24 },
  { min: 208325,  max: 264550, rate: 0.32 },
  { min: 264550,  max: 661375, rate: 0.35 },
  { min: 661375,  max: null,   rate: 0.37 },
];

/** 2027 standard deduction by filing status (Rev. Proc. 2026-35 section 3.15(1)). */
export const FED_STD_DEDUCTION_2027 = {
  mfj:    33200,
  single: 16600,
  hoh:    24925,
} as const;

/** 2027 additional standard deduction per 65+/blind individual (section 3.15(3)). */
export const FED_ADDL_STD_DEDUCTION_65_2027 = { mfj: 1700, single: 2100 } as const;

export const FED_TABLES_2027_SOURCES: Source[] = [
  {
    title: 'IRS Rev. Proc. 2026-35 (2027 inflation adjustments)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-26-35.pdf',
    accessed: '2026-11-06',
  },
  {
    title: 'IRS IR-2026-133: tax inflation adjustments for tax year 2027',
    url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2027-taxpayers-continue-to-benefit-from-the-working-families-tax-cuts',
    accessed: '2026-11-06',
  },
];

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

export const FED_BRACKETS_2026_SOURCES: Source[] = [
  {
    title: 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    accessed: '2026-04-20',
  },
  {
    title: 'IRC § 1 — Tax imposed (statutory bracket structure)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
    accessed: '2026-04-20',
  },
];

export const FED_STD_DEDUCTION_2026_SOURCES: Source[] = [
  {
    title: 'IRS Rev. Proc. 2025-32 § 3.17 (2026 standard deduction)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    accessed: '2026-04-20',
  },
];

export const OBBBA_SENIOR_SOURCES: Source[] = [
  {
    title: 'One Big Beautiful Bill Act § 13301 — Senior bonus deduction',
    url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    accessed: '2026-04-20',
  },
  {
    title: 'IRS guidance: Additional deduction for taxpayers aged 65+',
    url: 'https://www.irs.gov/newsroom/additional-deduction-for-taxpayers-aged-65-and-older',
    accessed: '2026-04-20',
  },
];

/** Social Security Trust Fund depletion projection. */
export const SS_CUT_SOURCES: Source[] = [
  {
    title: 'SSA 2025 Trustees Report — OASI fund projection',
    url: 'https://www.ssa.gov/OACT/TR/2025/',
    accessed: '2026-04-20',
  },
];

/**
 * 2026 LTCG / qualified-dividend bracket thresholds. Mirrors
 * `LTCG_BRACKETS_2026` in retirement-api/shared/taxes.js. The 0%
 * bracket is the harvesting opportunity surfaced by the panel
 * on the Roth screen — early retirees in the Roth-conversion
 * phase often leave $10–30k of headroom on the table each year.
 */
export const LTCG_BRACKETS_2026 = {
  single: { zeroTop: 49_450,  fifteenTop: 545_500 },
  mfj:    { zeroTop: 98_900,  fifteenTop: 613_700 },
  mfs:    { zeroTop: 49_450,  fifteenTop: 306_850 },
  hoh:    { zeroTop: 66_200,  fifteenTop: 579_600 },
} as const;

/** 2027 LTCG thresholds (Rev. Proc. 2026-35 section 3.03). Not yet wired into the
 *  current-year harvesting helpers, which stay on 2026 until the year turns. */
export const LTCG_BRACKETS_2027 = {
  single: { zeroTop: 51_050,  fifteenTop: 563_200 },
  mfj:    { zeroTop: 102_100, fifteenTop: 633_600 },
  mfs:    { zeroTop: 51_050,  fifteenTop: 316_800 },
  hoh:    { zeroTop: 68_350,  fifteenTop: 598_400 },
} as const;

export type LtcgFilingStatus = keyof typeof LTCG_BRACKETS_2026;

export const LTCG_BRACKETS_2026_SOURCES: Source[] = [
  {
    title: 'IRS Rev. Proc. 2025-32 § 3.03 (2026 LTCG bracket thresholds)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    accessed: '2026-04-30',
  },
  {
    title: 'IRC § 1(h) — Maximum capital gains rate (statutory bracket structure)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
    accessed: '2026-04-30',
  },
];

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
export function ltcgZeroBracketHeadroom(
  ordinaryTaxableIncome: number,
  filingStatus: LtcgFilingStatus,
  alreadyPreferential = 0,
): number {
  const brackets = LTCG_BRACKETS_2026[filingStatus];
  const O = Math.max(0, ordinaryTaxableIncome);
  const P = Math.max(0, alreadyPreferential);
  return Math.max(0, brackets.zeroTop - O - P);
}

/**
 * Structured snapshot for the harvesting advisor: how much room
 * remains in each LTCG bracket and what rate applies to the next $1.
 *
 * Mirrors `ltcgHarvestingSummary` in retirement-api/shared/taxes.js.
 */
export function ltcgHarvestingSummary(
  ordinaryTaxableIncome: number,
  filingStatus: LtcgFilingStatus,
  alreadyPreferential = 0,
): LtcgHarvestingSummary {
  const brackets = LTCG_BRACKETS_2026[filingStatus];
  const O = Math.max(0, ordinaryTaxableIncome);
  const P = Math.max(0, alreadyPreferential);
  const stackBase = O + P;
  const zeroBracketHeadroom = Math.max(0, brackets.zeroTop - stackBase);
  // 15%-bracket headroom is what's left between max(0%-top, stackBase)
  // and the 15%-top — independent of the 0% headroom.
  const fifteenStart = Math.max(brackets.zeroTop, stackBase);
  const fifteenBracketHeadroom = Math.max(0, brackets.fifteenTop - fifteenStart);
  let currentMarginalRate: 0 | 0.15 | 0.20;
  if (stackBase < brackets.zeroTop)         currentMarginalRate = 0;
  else if (stackBase < brackets.fifteenTop) currentMarginalRate = 0.15;
  else                                      currentMarginalRate = 0.20;
  return {
    filingStatus,
    zeroTop: brackets.zeroTop,
    fifteenTop: brackets.fifteenTop,
    alreadyPreferential: P,
    zeroBracketHeadroom,
    fifteenBracketHeadroom,
    currentMarginalRate,
  };
}

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
export function ltcgFederalTax(
  ltcgIncome: number,
  ordinaryTaxableIncome: number,
  filingStatus: LtcgFilingStatus,
): number {
  if (!(ltcgIncome > 0)) return 0;
  // Own-property-only lookup. Without this guard, an attacker-controlled
  // (or stale-typed) filingStatus like `'toString'` returns the inherited
  // Object.prototype method — truthy enough to defeat `??`. Mirrors
  // `pickByFilingStatus` defensiveness in retirement-api/shared/taxes.js
  // (Codex P1 fix on api PR #89).
  const brackets = Object.prototype.hasOwnProperty.call(LTCG_BRACKETS_2026, filingStatus)
    ? LTCG_BRACKETS_2026[filingStatus]
    : LTCG_BRACKETS_2026.mfj;
  const O = Math.max(0, ordinaryTaxableIncome);
  const L = ltcgIncome;
  const combined = O + L;
  const inZero = Math.max(0, Math.min(L, brackets.zeroTop - O));
  const inTwenty = Math.max(0, Math.min(L, combined - brackets.fifteenTop));
  const inFifteen = L - inZero - inTwenty;
  return inFifteen * 0.15 + inTwenty * 0.20;
}

/** SECURE 2.0 RMD start ages. */
export const RMD_AGE_SOURCES: Source[] = [
  {
    title: 'SECURE 2.0 Act § 107 — Raised RMD age (73 / 75)',
    url: 'https://www.congress.gov/bill/117th-congress/house-bill/2617/text',
    accessed: '2026-04-20',
  },
  {
    title: 'IRS Notice 2023-23 — RMD guidance under SECURE 2.0',
    url: 'https://www.irs.gov/pub/irs-drop/n-23-23.pdf',
    accessed: '2026-04-20',
  },
];

/**
 * Residential rental real property — straight-line depreciation life
 * under MACRS (IRC § 168(c)). Commercial real property is 39-year and
 * is not modeled in v1 of Todo #29.
 *
 * Used by `rental-income.ts` helpers; surfaced as a citation on the
 * Schedule E breakdown panel.
 */
export const RENTAL_RESIDENTIAL_DEPRECIATION_LIFE_YEARS = 27.5;

export const RENTAL_DEPRECIATION_SOURCES: Source[] = [
  {
    title: 'IRS Pub 527 — Residential Rental Property',
    url: 'https://www.irs.gov/publications/p527',
    accessed: '2026-05-02',
  },
  {
    title: 'IRS Pub 946 — How to Depreciate Property',
    url: 'https://www.irs.gov/publications/p946',
    accessed: '2026-05-02',
  },
  {
    title: 'IRC § 168 — Accelerated cost recovery system',
    url: 'https://www.law.cornell.edu/uscode/text/26/168',
    accessed: '2026-05-02',
  },
];

export const RENTAL_SCHEDULE_E_SOURCES: Source[] = [
  {
    title: 'IRS Schedule E (Form 1040) — Supplemental Income and Loss',
    url: 'https://www.irs.gov/forms-pubs/about-schedule-e-form-1040',
    accessed: '2026-05-02',
  },
  {
    title: 'IRS Pub 527 — Residential Rental Property (Schedule E reporting)',
    url: 'https://www.irs.gov/publications/p527',
    accessed: '2026-05-02',
  },
];
