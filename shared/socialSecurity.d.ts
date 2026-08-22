/**
 * Own Social Security benefit at a given claim age.
 * `claimAge` accepts fractional years for month precision
 * (ssClaimAge + ssClaimAgeMonths / 12).
 */
export function calcSSBenefit(pia: number, fra: number, claimAge: number): number;

/**
 * Spousal top-up: the excess of 50% of the higher earner's PIA over the
 * claimant's own PIA, reduced when claimed before the claimant's FRA
 * (25/36 of 1% per month for the first 36 months, 5/12 of 1% per month
 * beyond). `claimAge` accepts fractional years for month precision.
 */
export function calcSpousalBenefit(
  spousePIA: number,
  ownPIA: number,
  ownFRA: number,
  claimAge: number,
): number;
