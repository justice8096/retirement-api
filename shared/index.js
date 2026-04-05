// @retirement/shared — pure calculation libraries shared between dashboard and API
export { calcBracketTax, calcTaxesForLocation } from './taxes.js';
export { calcSSBenefit, calcSpousalBenefit } from './socialSecurity.js';
export { getRMDStartAge, getDistributionPeriod, calcRMD, calcCoupleRMD, RMD_PENALTY_RATE, RMD_PENALTY_RATE_CORRECTED } from './rmd.js';
export { getFxMultiplier, getInflationMultiplier, getInflationFxMultiplier, getAvgInflationMultiplier, getTypicalMonthly, getProjectedMonthly, projectCosts } from './inflation.js';
export { fmt, fmtK, pct } from './formatting.js';
export { CURRENT_YEAR, COLORS, CAT_COLORS, PROJ_CAT_LABELS, COST_CATEGORIES, TAB_CONFIG } from './constants.js';
export { calcFixedPercentageWithdrawal, calcConstantPercentageWithdrawal, calcGuardrailsWithdrawal, calcVPWWithdrawal, calcBucketWithdrawal, calcFloorCeilingWithdrawal, calcWithdrawal, VPW_DIVISORS } from './withdrawalStrategies.js';
export { calcFIRENumber, calcFIREProgress, calcCoastFIRE, calcBaristaFIRE, calcTimeToFIRE, calcFIREVariants, calc72tSEPP } from './fire.js';
export { calcSpendingSmile, calcDecliningSpending, calcEssentialDiscretionary, applySpendingModel } from './spendingModels.js';
