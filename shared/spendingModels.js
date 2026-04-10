/**
 * Spending models for retirement planning
 * Pure math for various retirement spending curves:
 * - Blanchett's Smile Curve (go-go, slow-go, no-go phases)
 * - Declining spending (Bernicke's Reality Retirement Planning)
 * - Essential vs Discretionary split
 */

/**
 * Blanchett's retirement spending smile curve.
 * Models three phases of retirement with different spending patterns.
 * @param {number} baseSpending - Initial annual spending
 * @param {number} yearsIntoRetirement - Years since retirement start (0+)
 * @param {number} retirementAge - Age at retirement start (optional, for logging)
 * @returns {object} { adjustedSpending, phase: 'go-go'|'slow-go'|'no-go', realChangeRate }
 */
export function calcSpendingSmile(baseSpending, yearsIntoRetirement, retirementAge) {
  if (!baseSpending || baseSpending <= 0 || yearsIntoRetirement < 0) {
    return {
      adjustedSpending: 0,
      phase: 'go-go',
      realChangeRate: 0,
    };
  }

  var spending = baseSpending;
  var phase = 'go-go';
  var realChangeRate = 0;

  if (yearsIntoRetirement <= 10) {
    // Go-go years: active travel, leisure, decline ~2%/year real
    phase = 'go-go';
    realChangeRate = -0.02;
    spending = baseSpending * Math.pow(1 + realChangeRate, yearsIntoRetirement);
  } else if (yearsIntoRetirement <= 25) {
    // Slow-go years: moderate activity, stable or slight decline ~1%/year
    phase = 'slow-go';
    realChangeRate = -0.01;
    var yearsInSlowGo = yearsIntoRetirement - 10;
    // Base is the spending at end of go-go phase
    var endOfGoGoSpending = baseSpending * Math.pow(1 - 0.02, 10);
    spending = endOfGoGoSpending * Math.pow(1 + realChangeRate, yearsInSlowGo);
  } else {
    // No-go years: healthcare dominates, rise ~3%/year real
    phase = 'no-go';
    realChangeRate = 0.03;
    var yearsInNoGo = yearsIntoRetirement - 25;
    // Base is the spending at end of slow-go phase
    var endOfSlowGoSpending = baseSpending * Math.pow(1 - 0.02, 10) * Math.pow(1 - 0.01, 15);
    spending = endOfSlowGoSpending * Math.pow(1 + realChangeRate, yearsInNoGo);
  }

  return {
    adjustedSpending: spending,
    phase: phase,
    realChangeRate: realChangeRate,
  };
}

/**
 * Bernicke's declining spending model.
 * Real spending declines by a constant rate per year.
 * @param {number} baseSpending - Initial annual spending
 * @param {number} yearsIntoRetirement - Years since retirement start
 * @param {number} annualDeclineRate - Real decline rate (default 0.015 for 1.5%)
 * @returns {object} { adjustedSpending, cumulativeDecline }
 */
export function calcDecliningSpending(baseSpending, yearsIntoRetirement, annualDeclineRate) {
  annualDeclineRate = annualDeclineRate !== undefined ? annualDeclineRate : 0.015;

  if (!baseSpending || baseSpending <= 0 || yearsIntoRetirement < 0) {
    return {
      adjustedSpending: 0,
      cumulativeDecline: 0,
    };
  }

  var adjustedSpending = baseSpending * Math.pow(1 - annualDeclineRate, yearsIntoRetirement);
  var cumulativeDecline = 1 - (adjustedSpending / baseSpending);

  return {
    adjustedSpending: adjustedSpending,
    cumulativeDecline: cumulativeDecline,
  };
}

/**
 * Split expenses into essential, discretionary, and mixed.
 * @param {object} categories - Map of category key -> annual amount
 * @param {object} categoryClassification - Map of category key -> 'essential'|'discretionary'|'mixed'
 * @returns {object} { essential, discretionary, mixed, total }
 */
export function calcEssentialDiscretionary(categories, categoryClassification) {
  if (!categories) categories = {};
  if (!categoryClassification) categoryClassification = {};

  var defaultClassification = {
    rent: 'essential',
    groceries: 'essential',
    utilities: 'essential',
    healthcare: 'essential',
    insurance: 'essential',
    medicine: 'essential',
    entertainment: 'discretionary',
    clothing: 'discretionary',
    subscriptions: 'discretionary',
    miscellaneous: 'discretionary',
    transportation: 'mixed',
    personalCare: 'mixed',
  };

  var essential = 0;
  var discretionary = 0;
  var mixed = 0;
  var total = 0;

  Object.keys(categories).forEach(function (key) {
    var amount = categories[key] || 0;
    if (amount <= 0) return;

    var classification =
      categoryClassification[key] !== undefined
        ? categoryClassification[key]
        : defaultClassification[key];

    total += amount;

    if (classification === 'essential') {
      essential += amount;
    } else if (classification === 'discretionary') {
      discretionary += amount;
    } else if (classification === 'mixed') {
      // Split 50/50
      essential += amount * 0.5;
      discretionary += amount * 0.5;
      mixed += amount;
    }
  });

  return {
    essential: essential,
    discretionary: discretionary,
    mixed: mixed,
    total: total,
  };
}

/**
 * Apply a spending model to get year-specific spending.
 * Dispatcher for different spending models.
 * @param {string} modelType - 'level'|'smile'|'declining'|'essential-first'
 * @param {number} baseSpending - Initial annual spending
 * @param {number} year - Years into retirement (0+)
 * @param {object} params - Additional params: retirementAge, declineRate, etc.
 * @returns {number} Adjusted spending for the year
 */
export function applySpendingModel(modelType, baseSpending, year, params) {
  if (!modelType || !baseSpending || baseSpending <= 0 || year < 0) {
    return 0;
  }

  params = params || {};

  switch (modelType) {
    case 'level':
      // Level spending: no adjustment
      return baseSpending;

    case 'smile':
      // Blanchett's smile curve
      var smileResult = calcSpendingSmile(baseSpending, year, params.retirementAge);
      return smileResult.adjustedSpending;

    case 'declining':
      // Bernicke's declining model
      var declineRate = params.declineRate || 0.015;
      var decliningResult = calcDecliningSpending(baseSpending, year, declineRate);
      return decliningResult.adjustedSpending;

    case 'essential-first':
      // Protect essential spending, adjust discretionary
      // Requires params.categories and params.categoryClassification
      if (!params.categories) {
        return baseSpending;
      }
      var split = calcEssentialDiscretionary(params.categories, params.categoryClassification);
      if (split.total <= 0) {
        return baseSpending;
      }
      // Apply declining model only to discretionary portion
      var discretionaryFraction = split.discretionary / split.total;
      var decliningDisc = calcDecliningSpending(
        baseSpending * discretionaryFraction,
        year,
        params.declineRate || 0.015
      );
      return split.essential + decliningDisc.adjustedSpending;

    default:
      // Unknown model, return level
      return baseSpending;
  }
}
