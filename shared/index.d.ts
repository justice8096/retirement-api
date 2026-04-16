export { calcBracketTax, calcTaxesForLocation } from './taxes';
export type { TaxBracket, TaxConfig, TaxResult, TaxDetail, SocialCharges, LocationWithTaxes } from './taxes';

export { calcSSBenefit, calcSpousalBenefit } from './socialSecurity';

export { getRMDStartAge, getDistributionPeriod, calcRMD, calcCoupleRMD, RMD_PENALTY_RATE, RMD_PENALTY_RATE_CORRECTED } from './rmd';
export type { RMDResult } from './rmd';

export { getFxMultiplier, getInflationMultiplier, getInflationFxMultiplier, getAvgInflationMultiplier, getTypicalMonthly, getProjectedMonthly, projectCosts } from './inflation';
export type { CostEntry, LocationLike, ProjectionRow } from './inflation';

export { fmt, pct, fmtKUnsafe } from './formatting';
export type { FormatOpts, PctOpts } from './formatting';

export { CURRENT_YEAR, COLORS, CAT_COLORS, PROJ_CAT_LABELS, COST_CATEGORIES, TAB_CONFIG } from './constants';
export type { CostCategoryDef, TabConfigEntry } from './constants';
