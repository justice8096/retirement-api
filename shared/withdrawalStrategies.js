/**
 * Withdrawal Strategies Module
 * Pure calculation functions for various retirement withdrawal strategies.
 * No side effects, no external dependencies, no DOM access.
 */

/**
 * VPW (Variable Percentage Withdrawal) divisors by age.
 * Based on life expectancy and IRS-style uniform lifetime table.
 * Used to divide remaining portfolio to determine annual withdrawal.
 */
export const VPW_DIVISORS = {
  50: 35.5,
  51: 34.6,
  52: 33.7,
  53: 32.8,
  54: 31.9,
  55: 31.0,
  56: 30.1,
  57: 29.2,
  58: 28.3,
  59: 27.4,
  60: 26.5,
  61: 25.6,
  62: 24.7,
  63: 23.8,
  64: 22.9,
  65: 22.0,
  66: 21.1,
  67: 20.2,
  68: 19.4,
  69: 18.5,
  70: 17.7,
  71: 16.8,
  72: 16.0,
  73: 15.3,
  74: 14.5,
  75: 13.8,
  76: 13.1,
  77: 12.4,
  78: 11.7,
  79: 11.0,
  80: 10.4,
  81: 9.7,
  82: 9.1,
  83: 8.6,
  84: 8.1,
  85: 7.6,
  86: 7.1,
  87: 6.7,
  88: 6.3,
  89: 5.9,
  90: 5.5,
  91: 5.2,
  92: 4.9,
  93: 4.6,
  94: 4.3,
  95: 4.1,
  96: 3.8,
  97: 3.6,
  98: 3.4,
  99: 3.2,
  100: 3.0,
};

/**
 * Fixed Percentage Withdrawal (Classic 4% Rule)
 * Withdraws a fixed percentage of initial portfolio, adjusted annually for inflation.
 *
 * @param {number} initialPortfolio - Starting portfolio balance
 * @param {number} currentYear - Current year (0-indexed, where 0 is year 1)
 * @param {number} startYear - Starting year reference (typically 0 for first year)
 * @param {number} annualInflationRate - Annual inflation rate as decimal (e.g., 0.03 for 3%)
 * @param {number} withdrawalRate - Annual withdrawal rate as decimal (e.g., 0.04 for 4%)
 * @returns {{ amount: number, effectiveRate: number }}
 */
export function calcFixedPercentageWithdrawal(
  initialPortfolio,
  currentYear,
  startYear,
  annualInflationRate,
  withdrawalRate
) {
  const yearsElapsed = currentYear - startYear;
  const inflationMultiplier = Math.pow(1 + annualInflationRate, yearsElapsed);
  const baseWithdrawal = initialPortfolio * withdrawalRate;
  const inflatedAmount = baseWithdrawal * inflationMultiplier;

  return {
    amount: inflatedAmount,
    effectiveRate: withdrawalRate,
  };
}

/**
 * Constant Percentage Withdrawal
 * Withdraws a fixed percentage of the current portfolio each year.
 * Provides more income stability but income fluctuates with market returns.
 *
 * @param {number} currentPortfolio - Current portfolio balance
 * @param {number} withdrawalRate - Annual withdrawal rate as decimal (e.g., 0.05 for 5%)
 * @returns {{ amount: number, effectiveRate: number }}
 */
export function calcConstantPercentageWithdrawal(currentPortfolio, withdrawalRate) {
  const amount = currentPortfolio * withdrawalRate;

  return {
    amount,
    effectiveRate: withdrawalRate,
  };
}

/**
 * Guyton-Klinger Guardrails Withdrawal
 * Adjusts spending based on portfolio/spending ratio guardrails.
 * If ratio exceeds ceiling, reduce spending; if below floor, increase it.
 *
 * @param {{
 *   currentPortfolio: number,
 *   initialWithdrawal: number,
 *   currentWithdrawal: number,
 *   initialPortfolio: number,
 *   ceilingRate: number,
 *   floorRate: number,
 *   adjustmentPercent: number,
 *   inflationRate: number
 * }} params
 * @returns {{ amount: number, effectiveRate: number, triggered: 'ceiling' | 'floor' | 'none' }}
 */
export function calcGuardrailsWithdrawal(params) {
  const {
    currentPortfolio,
    initialWithdrawal,
    currentWithdrawal,
    initialPortfolio,
    ceilingRate,
    floorRate,
    adjustmentPercent,
    inflationRate,
  } = params;

  let nextWithdrawal = currentWithdrawal * (1 + inflationRate);
  let triggered = 'none';

  const ratio = nextWithdrawal / currentPortfolio;

  if (ratio > ceilingRate) {
    nextWithdrawal = nextWithdrawal * (1 - adjustmentPercent);
    triggered = 'ceiling';
  } else if (ratio < floorRate) {
    nextWithdrawal = nextWithdrawal * (1 + adjustmentPercent);
    triggered = 'floor';
  }

  return {
    amount: nextWithdrawal,
    effectiveRate: nextWithdrawal / currentPortfolio,
    triggered,
  };
}

/**
 * Variable Percentage Withdrawal (VPW)
 * Divides portfolio by a life-expectancy-based divisor.
 * Provides higher withdrawals early, declining with age.
 *
 * @param {number} currentPortfolio - Current portfolio balance
 * @param {number} age - Retiree's current age
 * @param {Record<number, number>} [mortalityTable] - Optional custom mortality table (age -> divisor)
 * @returns {{ amount: number, effectiveRate: number, divisor: number }}
 */
export function calcVPWWithdrawal(currentPortfolio, age, mortalityTable) {
  const table = mortalityTable || VPW_DIVISORS;

  // Find appropriate divisor by age, using nearest available if exact age not in table
  let divisor = table[age];

  if (divisor === undefined) {
    // Linear interpolation between nearest ages
    const ages = Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b);

    if (age < ages[0]) {
      divisor = table[ages[0]];
    } else if (age > ages[ages.length - 1]) {
      divisor = table[ages[ages.length - 1]];
    } else {
      const lower = ages.filter(a => a <= age).pop();
      const upper = ages.find(a => a > age);
      const lowerDiv = table[lower];
      const upperDiv = table[upper];
      const ratio = (age - lower) / (upper - lower);
      divisor = lowerDiv + (upperDiv - lowerDiv) * ratio;
    }
  }

  const amount = currentPortfolio / divisor;
  const effectiveRate = amount / currentPortfolio;

  return {
    amount,
    effectiveRate,
    divisor,
  };
}

/**
 * Bucket Strategy Withdrawal
 * Manages multiple portfolio buckets with different time horizons and return rates.
 * Withdraws from the near-term bucket, refilling from growth bucket as needed.
 *
 * @param {{
 *   buckets: Array<{ balance: number, returnRate: number }>,
 *   annualSpending: number,
 *   refillThreshold: number
 * }} params
 * @returns {{
 *   amount: number,
 *   buckets: Array<{ balance: number }>,
 *   refilled: boolean
 * }}
 */
export function calcBucketWithdrawal(params) {
  const { buckets, annualSpending, refillThreshold } = params;

  if (!buckets || buckets.length === 0) {
    return {
      amount: 0,
      buckets: [],
      refilled: false,
    };
  }

  // Deep copy buckets to avoid mutation
  const updatedBuckets = buckets.map(b => ({ ...b }));

  let withdrawalAmount = annualSpending;
  let refilled = false;

  // Check if near-term bucket needs refilling
  const shortTermThreshold = refillThreshold * annualSpending;

  if (updatedBuckets[0].balance < shortTermThreshold && updatedBuckets.length > 2) {
    // Refill from growth bucket (typically index 2)
    const refillAmount = shortTermThreshold - updatedBuckets[0].balance;
    if (updatedBuckets[2].balance >= refillAmount) {
      updatedBuckets[2].balance -= refillAmount;
      updatedBuckets[0].balance += refillAmount;
      refilled = true;
    }
  }

  // Withdraw from near-term bucket
  if (updatedBuckets[0].balance >= withdrawalAmount) {
    updatedBuckets[0].balance -= withdrawalAmount;
  } else {
    // Fall back to intermediate bucket if near-term insufficient
    const shortfall = withdrawalAmount - updatedBuckets[0].balance;
    withdrawalAmount = updatedBuckets[0].balance;
    updatedBuckets[0].balance = 0;

    if (updatedBuckets.length > 1 && updatedBuckets[1].balance > 0) {
      const additionalWithdrawal = Math.min(shortfall, updatedBuckets[1].balance);
      updatedBuckets[1].balance -= additionalWithdrawal;
      withdrawalAmount += additionalWithdrawal;
    }
  }

  return {
    amount: withdrawalAmount,
    buckets: updatedBuckets,
    refilled,
  };
}

/**
 * Floor-and-Ceiling Withdrawal Strategy
 * Separates essential spending (covered by guaranteed income) from discretionary.
 * Ensures minimum essential needs are met, maximizes discretionary within portfolio limit.
 *
 * @param {{
 *   guaranteedIncome: number,
 *   essentialSpending: number,
 *   discretionaryBudget: number,
 *   currentPortfolio: number,
 *   maxDiscretionaryRate: number
 * }} params
 * @returns {{
 *   amount: number,
 *   floorAmount: number,
 *   discretionaryAmount: number,
 *   effectiveRate: number
 * }}
 */
export function calcFloorCeilingWithdrawal(params) {
  const {
    guaranteedIncome,
    essentialSpending,
    discretionaryBudget,
    currentPortfolio,
    maxDiscretionaryRate,
  } = params;

  // Floor: shortfall between essential spending and guaranteed income
  const essentialGap = Math.max(0, essentialSpending - guaranteedIncome);

  // Discretionary: limited by both budget and portfolio capacity
  const maxPortfolioDiscretionary = currentPortfolio * maxDiscretionaryRate;
  const discretionaryAmount = Math.min(discretionaryBudget, maxPortfolioDiscretionary);

  const totalWithdrawal = essentialGap + discretionaryAmount;
  const effectiveRate = totalWithdrawal / currentPortfolio;

  return {
    amount: totalWithdrawal,
    floorAmount: essentialGap,
    discretionaryAmount,
    effectiveRate,
  };
}

/**
 * Strategy Dispatcher
 * Routes to the appropriate withdrawal strategy function based on strategy type.
 *
 * @param {string} strategyType - Strategy name ('fixed-percentage', 'constant-percentage', etc.)
 * @param {any} params - Parameters object specific to the chosen strategy
 * @returns {any} Strategy-specific result object
 */
export function calcWithdrawal(strategyType, params) {
  switch (strategyType) {
    case 'fixed-percentage':
      return calcFixedPercentageWithdrawal(
        params.initialPortfolio,
        params.currentYear,
        params.startYear,
        params.annualInflationRate,
        params.withdrawalRate
      );

    case 'constant-percentage':
      return calcConstantPercentageWithdrawal(params.currentPortfolio, params.withdrawalRate);

    case 'guardrails':
      return calcGuardrailsWithdrawal(params);

    case 'vpw':
      return calcVPWWithdrawal(params.currentPortfolio, params.age, params.mortalityTable);

    case 'bucket':
      return calcBucketWithdrawal(params);

    case 'floor-ceiling':
      return calcFloorCeilingWithdrawal(params);

    default:
      throw new Error(
        `Unknown withdrawal strategy: ${strategyType}. ` +
          `Valid strategies: fixed-percentage, constant-percentage, guardrails, vpw, bucket, floor-ceiling`
      );
  }
}
