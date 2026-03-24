export function calcSSBenefit(pia, fra, claimAge) {
  if (claimAge === fra) return pia;
  if (claimAge < fra) {
    var monthsEarly = (fra - claimAge) * 12;
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
    var monthsEarly = (ownFRA - claimAge) * 12;
    var reduction = Math.min(monthsEarly * (25 / 36 / 100), 0.30);
    spousalOnly *= (1 - reduction);
  }
  return Math.max(0, Math.round(spousalOnly));
}
