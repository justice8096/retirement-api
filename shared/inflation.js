import { CURRENT_YEAR } from './constants.js';

/**
 * Get FX drift multiplier for a foreign-currency location.
 * fxDrift > 0 means USD weakens (foreign costs rise in USD terms).
 * Returns 1.0 for USD locations or when drift is 0.
 */
export function getFxMultiplier(loc, yearsOut, fxDrift) {
  if (!fxDrift || !loc || loc.currency === 'USD') return 1;
  return Math.pow(1 + fxDrift, yearsOut);
}

export function getInflationMultiplier(loc, category, targetYear) {
  if (!targetYear || targetYear <= CURRENT_YEAR) return 1;
  var years = targetYear - CURRENT_YEAR;
  var infl = 0.025; // default
  if (loc && loc.monthlyCosts && loc.monthlyCosts[category]) {
    infl = loc.monthlyCosts[category].annualInflation || 0.025;
  }
  return Math.pow(1 + infl, years);
}

/**
 * Inflation multiplier combined with FX drift for a single category.
 */
export function getInflationFxMultiplier(loc, category, targetYear, fxDrift) {
  var inflMult = getInflationMultiplier(loc, category, targetYear);
  var years = (!targetYear || targetYear <= CURRENT_YEAR) ? 0 : targetYear - CURRENT_YEAR;
  var fxMult = getFxMultiplier(loc, years, fxDrift);
  return inflMult * fxMult;
}

export function getAvgInflationMultiplier(loc, targetYear) {
  if (!targetYear || targetYear <= CURRENT_YEAR) return 1;
  var years = targetYear - CURRENT_YEAR;
  var rates = [];
  if (loc && loc.monthlyCosts) {
    Object.keys(loc.monthlyCosts).forEach(function (cat) {
      var r = loc.monthlyCosts[cat].annualInflation;
      if (r) rates.push(r);
    });
  }
  var avg = rates.length > 0 ? rates.reduce(function (s, r) { return s + r; }, 0) / rates.length : 0.025;
  return Math.pow(1 + avg, years);
}

export function getTypicalMonthly(loc) {
  return Object.values(loc.monthlyCosts).reduce((sum, cat) => sum + (cat.typical || 0), 0);
}

/**
 * Project total monthly cost to a target year, with optional FX drift.
 */
export function getProjectedMonthly(loc, targetYear, fxDrift) {
  if (!targetYear || targetYear <= CURRENT_YEAR) return getTypicalMonthly(loc);
  var years = targetYear - CURRENT_YEAR;
  var total = 0;
  Object.keys(loc.monthlyCosts).forEach(function (cat) {
    var base = loc.monthlyCosts[cat].typical || 0;
    total += base * getInflationMultiplier(loc, cat, targetYear);
  });
  return total * getFxMultiplier(loc, years, fxDrift);
}

/**
 * Full year-by-year projection with optional FX drift.
 */
export function projectCosts(loc, startYear, years, fxDrift) {
  var categories = Object.keys(loc.monthlyCosts);
  var rows = [];
  var cumulative = 0;
  for (var y = 0; y < years; y++) {
    var row = { year: startYear + y };
    var total = 0;
    var fxMult = getFxMultiplier(loc, y, fxDrift);
    categories.forEach(function (cat) {
      var base = loc.monthlyCosts[cat].typical;
      var infl = loc.monthlyCosts[cat].annualInflation || 0.025;
      var projected = base * Math.pow(1 + infl, y) * fxMult;
      row[cat] = projected;
      total += projected;
    });
    row.total = total;
    row.annual = total * 12;
    row.fxMultiplier = fxMult;
    cumulative += row.annual;
    row.cumulative = cumulative;
    rows.push(row);
  }
  return rows;
}
