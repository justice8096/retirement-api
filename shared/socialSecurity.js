export function calcSSBenefit(pia, fra, claimAge) {
  if (claimAge === fra) return pia;
  if (claimAge < fra) {
    // claimAge may be fractional years (ssClaimAge + ssClaimAgeMonths / 12);
    // round to whole months so float noise can't shift a month boundary.
    var monthsEarly = Math.round((fra - claimAge) * 12);
    var reduction = 0;
    // First 36 months: 5/9 of 1% per month. Beyond 36: 5/12 of 1% per month
    if (monthsEarly <= 36) {
      reduction = monthsEarly * (5 / 900);
    } else {
      reduction = 36 * (5 / 900) + (monthsEarly - 36) * (5 / 1200);
    }
    return Math.round(pia * (1 - reduction));
  }
  // Delayed credits: 8% per year beyond FRA
  var yearsLate = claimAge - fra;
  return Math.round(pia * (1 + yearsLate * 0.08));
}

export function calcSpousalBenefit(spousePIA, ownPIA, ownFRA, claimAge) {
  var maxSpousal = spousePIA * 0.5;
  if (maxSpousal <= ownPIA) return 0; // Own benefit is higher
  var spousalOnly = maxSpousal - ownPIA;
  if (claimAge < ownFRA) {
    // SSA reckons claim dates in months; claimAge may be fractional years
    // (ssClaimAge + ssClaimAgeMonths / 12). Round to whole months so float
    // noise (e.g. 66 + 8/12) can't shift a month boundary.
    var monthsEarly = Math.round((ownFRA - claimAge) * 12);
    // First 36 months: 25/36 of 1% per month. Beyond 36: 5/12 of 1% per month
    var reduction = 0;
    if (monthsEarly <= 36) {
      reduction = monthsEarly * (25 / 3600);
    } else {
      reduction = 36 * (25 / 3600) + (monthsEarly - 36) * (5 / 1200);
    }
    spousalOnly *= (1 - reduction);
  }
  return Math.max(0, Math.round(spousalOnly));
}
