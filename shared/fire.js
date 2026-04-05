/**
 * FIRE (Financial Independence, Retire Early) planning calculations
 * Pure math functions for FIRE number calculations, progress tracking,
 * and variant strategies (Coast, Barista, etc.)
 */

/**
 * Calculate the FIRE number: portfolio target needed to retire.
 * Based on safe withdrawal rate (default 4% rule).
 * @param {number} annualSpending - Annual expenses (dollars)
 * @param {number} withdrawalRate - Safe withdrawal rate (default 0.04 for 4% rule)
 * @returns {number} Portfolio target
 */
export function calcFIRENumber(annualSpending, withdrawalRate) {
  withdrawalRate = withdrawalRate || 0.04;
  if (!annualSpending || annualSpending <= 0 || withdrawalRate <= 0) {
    return 0;
  }
  return annualSpending / withdrawalRate;
}

/**
 * Calculate progress toward FIRE number.
 * @param {number} currentPortfolio - Current portfolio balance (dollars)
 * @param {number} fireNumber - FIRE target from calcFIRENumber
 * @returns {object} { progress: 0-1, remaining: number, isReached: boolean }
 */
export function calcFIREProgress(currentPortfolio, fireNumber) {
  if (!fireNumber || fireNumber <= 0) {
    return { progress: 0, remaining: 0, isReached: false };
  }
  var progress = Math.max(0, Math.min(1, currentPortfolio / fireNumber));
  var remaining = Math.max(0, fireNumber - currentPortfolio);
  var isReached = currentPortfolio >= fireNumber;
  return { progress: progress, remaining: remaining, isReached: isReached };
}

/**
 * Calculate Coast FIRE: portfolio that will reach FIRE number with zero contributions.
 * @param {object} params - { currentAge, targetRetirementAge, currentPortfolio, annualSpending, withdrawalRate, expectedReturn }
 * @returns {object} { coastNumber, isCoasting, yearsToCoast, currentGap }
 */
export function calcCoastFIRE(params) {
  if (!params) params = {};
  var currentAge = params.currentAge || 0;
  var targetRetirementAge = params.targetRetirementAge || 67;
  var currentPortfolio = params.currentPortfolio || 0;
  var annualSpending = params.annualSpending || 0;
  var withdrawalRate = params.withdrawalRate || 0.04;
  var expectedReturn = params.expectedReturn || 0.07;

  var yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);
  if (yearsToRetirement <= 0 || !annualSpending || annualSpending <= 0) {
    return {
      coastNumber: 0,
      isCoasting: false,
      yearsToCoast: 0,
      currentGap: 0,
    };
  }

  var fireNumber = calcFIRENumber(annualSpending, withdrawalRate);
  // coastNumber: portfolio that will grow to fireNumber without contributions
  var coastNumber = fireNumber / Math.pow(1 + expectedReturn, yearsToRetirement);
  var currentGap = Math.max(0, coastNumber - currentPortfolio);
  var isCoasting = currentPortfolio >= coastNumber;
  var yearsToCoast = 0;

  if (!isCoasting && expectedReturn > 0) {
    // Calculate years until current portfolio grows to coast number
    yearsToCoast = Math.log(coastNumber / currentPortfolio) / Math.log(1 + expectedReturn);
    yearsToCoast = Math.max(0, yearsToCoast);
  }

  return {
    coastNumber: coastNumber,
    isCoasting: isCoasting,
    yearsToCoast: yearsToCoast,
    currentGap: currentGap,
  };
}

/**
 * Calculate Barista FIRE: part-time income needed to cover spending gap.
 * @param {object} params - { currentPortfolio, annualSpending, partTimeIncome, withdrawalRate, expectedReturn }
 * @returns {object} { requiredPartTimeIncome, portfolioIncome, gap, isBaristaFIRE }
 */
export function calcBaristaFIRE(params) {
  if (!params) params = {};
  var currentPortfolio = params.currentPortfolio || 0;
  var annualSpending = params.annualSpending || 0;
  var partTimeIncome = params.partTimeIncome || 0;
  var withdrawalRate = params.withdrawalRate || 0.04;

  var portfolioIncome = currentPortfolio * withdrawalRate;
  var gap = Math.max(0, annualSpending - portfolioIncome);
  var requiredPartTimeIncome = gap;
  var isBaristaFIRE = partTimeIncome >= requiredPartTimeIncome;

  return {
    requiredPartTimeIncome: requiredPartTimeIncome,
    portfolioIncome: portfolioIncome,
    gap: gap,
    isBaristaFIRE: isBaristaFIRE,
  };
}

/**
 * Calculate years to FIRE through savings.
 * Iterative year-by-year: portfolio grows by return + savings until >= fireNumber
 * @param {object} params - { currentPortfolio, annualSavings, annualSpending, withdrawalRate, expectedReturn, currentAge }
 * @returns {object} { years, fireNumber, projectedAge }
 */
export function calcTimeToFIRE(params) {
  if (!params) params = {};
  var currentPortfolio = params.currentPortfolio || 0;
  var annualSavings = params.annualSavings || 0;
  var annualSpending = params.annualSpending || 0;
  var withdrawalRate = params.withdrawalRate || 0.04;
  var expectedReturn = params.expectedReturn || 0.07;
  var currentAge = params.currentAge;

  if (!annualSpending || annualSpending <= 0) {
    return { years: 0, fireNumber: 0, projectedAge: currentAge };
  }

  var fireNumber = calcFIRENumber(annualSpending, withdrawalRate);
  if (currentPortfolio >= fireNumber) {
    return { years: 0, fireNumber: fireNumber, projectedAge: currentAge };
  }

  if (annualSavings <= 0) {
    // No savings, rely on growth only
    if (expectedReturn <= 0) {
      return { years: Infinity, fireNumber: fireNumber, projectedAge: undefined };
    }
    var yearsNeeded = Math.log(fireNumber / currentPortfolio) / Math.log(1 + expectedReturn);
    var projectedAge = currentAge !== undefined ? currentAge + yearsNeeded : undefined;
    return { years: yearsNeeded, fireNumber: fireNumber, projectedAge: projectedAge };
  }

  // Iterate year by year
  var portfolio = currentPortfolio;
  var years = 0;
  var maxYears = 100; // safety limit

  while (portfolio < fireNumber && years < maxYears) {
    portfolio = portfolio * (1 + expectedReturn) + annualSavings;
    years++;
  }

  var projectedAge2 = currentAge !== undefined ? currentAge + years : undefined;
  return { years: years, fireNumber: fireNumber, projectedAge: projectedAge2 };
}

/**
 * Calculate all FIRE variants at once.
 * @param {number} annualSpending - Annual expenses
 * @param {number} currentPortfolio - Current portfolio balance
 * @returns {object} Variants: leanFIRE, regularFIRE, fatFIRE with number, spending, progress
 */
export function calcFIREVariants(annualSpending, currentPortfolio) {
  if (!annualSpending || annualSpending <= 0) {
    return {
      leanFIRE: { number: 0, spending: 0, progress: 0 },
      regularFIRE: { number: 0, spending: 0, progress: 0 },
      fatFIRE: { number: 0, spending: 0, progress: 0 },
    };
  }

  var leanSpending = annualSpending * 0.6;
  var regularSpending = annualSpending;
  var fatSpending = annualSpending * 1.5;

  var leanNumber = calcFIRENumber(leanSpending, 0.04);
  var regularNumber = calcFIRENumber(regularSpending, 0.04);
  var fatNumber = calcFIRENumber(fatSpending, 0.04);

  return {
    leanFIRE: {
      number: leanNumber,
      spending: leanSpending,
      progress: Math.max(0, Math.min(1, currentPortfolio / leanNumber)),
    },
    regularFIRE: {
      number: regularNumber,
      spending: regularSpending,
      progress: Math.max(0, Math.min(1, currentPortfolio / regularNumber)),
    },
    fatFIRE: {
      number: fatNumber,
      spending: fatSpending,
      progress: Math.max(0, Math.min(1, currentPortfolio / fatNumber)),
    },
  };
}

/**
 * Calculate 72(t) SEPP (Substantially Equal Periodic Payments) for early IRA access.
 * Three IRS-approved methods; returns annual payment amounts.
 * @param {number} portfolioBalance - IRA balance at start of SEPP
 * @param {number} age - Current age (must be before 59.5 for early access)
 * @returns {object} { rmdMethod, amortization, annuitization, recommended }
 */
export function calc72tSEPP(portfolioBalance, age) {
  if (!portfolioBalance || portfolioBalance <= 0 || !age || age <= 0) {
    return {
      rmdMethod: 0,
      amortization: 0,
      annuitization: 0,
      recommended: 0,
    };
  }

  // Life expectancy table (IRS Single Life Expectancy Table)
  var lifeTable = {
    50: 34.2, 51: 33.3, 52: 32.3, 53: 31.4, 54: 30.5, 55: 29.6,
    56: 28.7, 57: 27.9, 58: 27.0, 59: 26.1, 60: 25.2, 61: 24.4,
    62: 23.5, 63: 22.7, 64: 21.8, 65: 20.9, 66: 20.1, 67: 19.2,
    68: 18.4, 69: 17.6, 70: 16.8, 71: 16.0, 72: 15.3, 73: 14.6,
    74: 13.9, 75: 13.2, 76: 12.5, 77: 11.9, 78: 11.2, 79: 10.6,
    80: 10.0,
  };

  var lifeExpectancy = lifeTable[Math.floor(age)] || 20;

  // Method 1: Required Minimum Distribution method
  var rmdMethod = portfolioBalance / lifeExpectancy;

  // Method 2: Fixed Amortization (amortize balance over life expectancy at 5% rate)
  var rate = 0.05;
  var n = lifeExpectancy;
  var amortization = (portfolioBalance * rate) / (1 - Math.pow(1 + rate, -n));

  // Method 3: Fixed Annuitization (IRS applies an interest assumption)
  // Using the declared mortality rate: annuity factor ≈ balance / life expectancy * (1 + 5% discount)
  var annuitization = (portfolioBalance * (1 + rate)) / lifeExpectancy;

  // Recommended: typically the amortization method is most generous
  var recommended = amortization;

  return {
    rmdMethod: rmdMethod,
    amortization: amortization,
    annuitization: annuitization,
    recommended: recommended,
  };
}
