export { calcBracketTax, calcTaxesForLocation, FED_BRACKETS_2026_SOURCES, FED_STD_DEDUCTION_2026_SOURCES, OBBBA_SENIOR_SOURCES } from './taxes';
export type { TaxBracket, TaxConfig, TaxResult, TaxDetail, SocialCharges, LocationWithTaxes, Source } from './taxes';
export { COUNTRY_TAX_SOURCES, taxSourcesFor } from './country-tax-sources';

export { calcSSBenefit, calcSpousalBenefit } from './socialSecurity';

export { getRMDStartAge, getDistributionPeriod, calcRMD, calcCoupleRMD, RMD_PENALTY_RATE, RMD_PENALTY_RATE_CORRECTED } from './rmd';
export type { RMDResult } from './rmd';

export { getFxMultiplier, getInflationMultiplier, getInflationFxMultiplier, getAvgInflationMultiplier, getTypicalMonthly, getProjectedMonthly, projectCosts } from './inflation';
export type { CostEntry, LocationLike, ProjectionRow } from './inflation';

export { fmt, pct, fmtKUnsafe } from './formatting';
export type { FormatOpts, PctOpts } from './formatting';

export { CURRENT_YEAR, COLORS, CAT_COLORS, PROJ_CAT_LABELS, COST_CATEGORIES, TAB_CONFIG } from './constants';
export type { CostCategoryDef, TabConfigEntry } from './constants';
