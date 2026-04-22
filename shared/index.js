// @retirement/shared — pure calculation libraries shared between dashboard and API
export { calcBracketTax, calcTaxesForLocation, FED_BRACKETS_2026_SOURCES, FED_STD_DEDUCTION_2026_SOURCES, OBBBA_SENIOR_SOURCES } from './taxes.js';
export { COUNTRY_TAX_SOURCES, taxSourcesFor } from './country-tax-sources.js';
export { CATEGORY_COST_SOURCES, costSourcesFor } from './category-cost-sources.js';
export { calcSSBenefit, calcSpousalBenefit } from './socialSecurity.js';
export { getRMDStartAge, getDistributionPeriod, calcRMD, calcCoupleRMD, RMD_PENALTY_RATE, RMD_PENALTY_RATE_CORRECTED } from './rmd.js';
export { getFxMultiplier, getInflationMultiplier, getInflationFxMultiplier, getAvgInflationMultiplier, getTypicalMonthly, getProjectedMonthly, projectCosts } from './inflation.js';
export { fmt, pct, fmtKUnsafe } from './formatting.js';
export { CURRENT_YEAR, COLORS, CAT_COLORS, PROJ_CAT_LABELS, COST_CATEGORIES, TAB_CONFIG } from './constants.js';
export { calcFixedPercentageWithdrawal, calcConstantPercentageWithdrawal, calcGuardrailsWithdrawal, calcVPWWithdrawal, calcBucketWithdrawal, calcFloorCeilingWithdrawal, calcWithdrawal, VPW_DIVISORS } from './withdrawalStrategies.js';
export { calcFIRENumber, calcFIREProgress, calcCoastFIRE, calcBaristaFIRE, calcTimeToFIRE, calcFIREVariants, calc72tSEPP } from './fire.js';
export { calcSpendingSmile, calcDecliningSpending, calcEssentialDiscretionary, applySpendingModel } from './spendingModels.js';
