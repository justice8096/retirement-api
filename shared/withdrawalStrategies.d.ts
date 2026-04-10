/**
 * Withdrawal Strategies Type Definitions
 * TypeScript interfaces and types for the withdrawal strategies module.
 */

/**
 * Base result returned by all withdrawal strategy functions.
 * Contains the calculated withdrawal amount and effective rate.
 */
export interface WithdrawalResult {
  /** Recommended withdrawal amount for the current year */
  amount: number;
  /** Effective withdrawal rate (amount / portfolio) */
  effectiveRate: number;
}

/**
 * Result from Fixed Percentage withdrawal strategy.
 */
export interface FixedPercentageResult extends WithdrawalResult {
  amount: number;
  effectiveRate: number;
}

/**
 * Result from Constant Percentage withdrawal strategy.
 */
export interface ConstantPercentageResult extends WithdrawalResult {
  amount: number;
  effectiveRate: number;
}

/**
 * Result from Guyton-Klinger Guardrails strategy.
 * Includes information about which guardrail (if any) was triggered.
 */
export interface GuardrailsResult extends WithdrawalResult {
  amount: number;
  effectiveRate: number;
  /** Which guardrail was triggered: 'ceiling', 'floor', or 'none' */
  triggered: 'ceiling' | 'floor' | 'none';
}

/**
 * Parameters for Guyton-Klinger Guardrails withdrawal strategy.
 */
export interface GuardrailsParams {
  /** Current portfolio balance */
  currentPortfolio: number;
  /** Initial withdrawal amount (typically from first year) */
  initialWithdrawal: number;
  /** Current withdrawal amount (from previous year) */
  currentWithdrawal: number;
  /** Initial portfolio balance at start of retirement */
  initialPortfolio: number;
  /** Upper threshold for portfolio/withdrawal ratio (e.g., 0.20 = 20%) */
  ceilingRate: number;
  /** Lower threshold for portfolio/withdrawal ratio (e.g., 0.12 = 12%) */
  floorRate: number;
  /** Percentage to adjust spending when guardrail triggered (e.g., 0.10 = 10%) */
  adjustmentPercent: number;
  /** Annual inflation rate as decimal (e.g., 0.03 = 3%) */
  inflationRate: number;
}

/**
 * Result from Variable Percentage Withdrawal (VPW) strategy.
 * Includes the divisor used in calculation.
 */
export interface VPWResult extends WithdrawalResult {
  amount: number;
  effectiveRate: number;
  /** Life expectancy divisor used to calculate withdrawal */
  divisor: number;
}

/**
 * Single bucket in the bucket strategy.
 * Represents a portfolio segment with different time horizon and expected returns.
 */
export interface Bucket {
  /** Current balance in this bucket */
  balance: number;
  /** Expected annual return rate as decimal (e.g., 0.03 = 3%) */
  returnRate: number;
}

/**
 * Result from Bucket withdrawal strategy.
 * Includes updated bucket balances after withdrawal and refill operations.
 */
export interface BucketResult {
  /** Total amount withdrawn this year */
  amount: number;
  /** Updated bucket balances after withdrawal */
  buckets: Array<{ balance: number }>;
  /** Whether a refill from growth bucket occurred */
  refilled: boolean;
}

/**
 * Parameters for Bucket withdrawal strategy.
 */
export interface BucketParams {
  /** Array of portfolio buckets (short-term, intermediate, long-term growth) */
  buckets: Bucket[];
  /** Desired annual spending amount */
  annualSpending: number;
  /** Years of spending to maintain in short-term bucket before refill (typically 1-2) */
  refillThreshold: number;
}

/**
 * Result from Floor-and-Ceiling withdrawal strategy.
 * Separates essential (floor) spending from discretionary (ceiling) spending.
 */
export interface FloorCeilingResult extends WithdrawalResult {
  amount: number;
  effectiveRate: number;
  /** Portfolio withdrawal needed to cover essential spending gap */
  floorAmount: number;
  /** Portfolio withdrawal available for discretionary spending */
  discretionaryAmount: number;
}

/**
 * Parameters for Floor-and-Ceiling withdrawal strategy.
 */
export interface FloorCeilingParams {
  /** Annual guaranteed income (Social Security, pensions, annuities) */
  guaranteedIncome: number;
  /** Annual essential living expenses (non-negotiable) */
  essentialSpending: number;
  /** Desired annual discretionary spending (wants, not needs) */
  discretionaryBudget: number;
  /** Current portfolio balance */
  currentPortfolio: number;
  /** Maximum percentage of portfolio available for discretionary (e.g., 0.05 = 5%) */
  maxDiscretionaryRate: number;
}

/**
 * VPW divisors lookup table by age.
 * Maps age to life-expectancy-based divisor for portfolio division.
 */
export const VPW_DIVISORS: Record<number, number>;

/**
 * Fixed Percentage Withdrawal (Classic 4% Rule)
 * Withdraws a fixed percentage of initial portfolio, adjusted annually for inflation.
 *
 * @param initialPortfolio - Starting portfolio balance
 * @param currentYear - Current year (0-indexed, where 0 is year 1)
 * @param startYear - Starting year reference (typically 0 for first year)
 * @param annualInflationRate - Annual inflation rate as decimal (e.g., 0.03 for 3%)
 * @param withdrawalRate - Annual withdrawal rate as decimal (e.g., 0.04 for 4%)
 * @returns Fixed percentage withdrawal result with amount and effective rate
 */
export function calcFixedPercentageWithdrawal(
  initialPortfolio: number,
  currentYear: number,
  startYear: number,
  annualInflationRate: number,
  withdrawalRate: number
): FixedPercentageResult;

/**
 * Constant Percentage Withdrawal
 * Withdraws a fixed percentage of the current portfolio each year.
 * Provides more income stability but income fluctuates with market returns.
 *
 * @param currentPortfolio - Current portfolio balance
 * @param withdrawalRate - Annual withdrawal rate as decimal (e.g., 0.05 for 5%)
 * @returns Constant percentage withdrawal result
 */
export function calcConstantPercentageWithdrawal(
  currentPortfolio: number,
  withdrawalRate: number
): ConstantPercentageResult;

/**
 * Guyton-Klinger Guardrails Withdrawal
 * Adjusts spending based on portfolio/spending ratio guardrails.
 * If ratio exceeds ceiling, reduce spending; if below floor, increase it.
 *
 * @param params - Guardrails strategy parameters
 * @returns Guardrails withdrawal result with triggered guardrail info
 */
export function calcGuardrailsWithdrawal(params: GuardrailsParams): GuardrailsResult;

/**
 * Variable Percentage Withdrawal (VPW)
 * Divides portfolio by a life-expectancy-based divisor.
 * Provides higher withdrawals early, declining with age.
 *
 * @param currentPortfolio - Current portfolio balance
 * @param age - Retiree's current age
 * @param mortalityTable - Optional custom mortality table (age -> divisor)
 * @returns VPW withdrawal result with divisor used
 */
export function calcVPWWithdrawal(
  currentPortfolio: number,
  age: number,
  mortalityTable?: Record<number, number>
): VPWResult;

/**
 * Bucket Strategy Withdrawal
 * Manages multiple portfolio buckets with different time horizons and return rates.
 * Withdraws from the near-term bucket, refilling from growth bucket as needed.
 *
 * @param params - Bucket strategy parameters
 * @returns Bucket withdrawal result with updated bucket balances
 */
export function calcBucketWithdrawal(params: BucketParams): BucketResult;

/**
 * Floor-and-Ceiling Withdrawal Strategy
 * Separates essential spending (covered by guaranteed income) from discretionary.
 * Ensures minimum essential needs are met, maximizes discretionary within portfolio limit.
 *
 * @param params - Floor-ceiling strategy parameters
 * @returns Floor-ceiling withdrawal result with separate floor and discretionary amounts
 */
export function calcFloorCeilingWithdrawal(params: FloorCeilingParams): FloorCeilingResult;

/**
 * Strategy Dispatcher
 * Routes to the appropriate withdrawal strategy function based on strategy type.
 *
 * @param strategyType - Strategy name ('fixed-percentage', 'constant-percentage', 'guardrails', 'vpw', 'bucket', 'floor-ceiling')
 * @param params - Parameters object specific to the chosen strategy
 * @returns Strategy-specific result object
 * @throws Error if strategyType is unknown
 */
export function calcWithdrawal(
  strategyType:
    | 'fixed-percentage'
    | 'constant-percentage'
    | 'guardrails'
    | 'vpw'
    | 'bucket'
    | 'floor-ceiling',
  params:
    | {
        initialPortfolio: number;
        currentYear: number;
        startYear: number;
        annualInflationRate: number;
        withdrawalRate: number;
      }
    | { currentPortfolio: number; withdrawalRate: number }
    | GuardrailsParams
    | { currentPortfolio: number; age: number; mortalityTable?: Record<number, number> }
    | BucketParams
    | FloorCeilingParams
):
  | FixedPercentageResult
  | ConstantPercentageResult
  | GuardrailsResult
  | VPWResult
  | BucketResult
  | FloorCeilingResult;
