/**
 * FIRE (Financial Independence, Retire Early) planning type definitions
 */

export interface FIREProgress {
  progress: number; // 0-1
  remaining: number;
  isReached: boolean;
}

export interface CoastFIREResult {
  coastNumber: number;
  isCoasting: boolean;
  yearsToCoast: number;
  currentGap: number;
}

export interface BaristaFIREResult {
  requiredPartTimeIncome: number;
  portfolioIncome: number;
  gap: number;
  isBaristaFIRE: boolean;
}

export interface TimeToFIREResult {
  years: number;
  fireNumber: number;
  projectedAge?: number;
}

export interface FIREVariant {
  number: number;
  spending: number;
  progress: number;
}

export interface FIREVariantsResult {
  leanFIRE: FIREVariant;
  regularFIRE: FIREVariant;
  fatFIRE: FIREVariant;
}

export interface SEPP72tResult {
  rmdMethod: number;
  amortization: number;
  annuitization: number;
  recommended: number;
}

export function calcFIRENumber(annualSpending: number, withdrawalRate?: number): number;

export function calcFIREProgress(currentPortfolio: number, fireNumber: number): FIREProgress;

export interface CoastFIREParams {
  currentAge?: number;
  targetRetirementAge?: number;
  currentPortfolio?: number;
  annualSpending?: number;
  withdrawalRate?: number;
  expectedReturn?: number;
}

export function calcCoastFIRE(params: CoastFIREParams): CoastFIREResult;

export interface BaristaFIREParams {
  currentPortfolio?: number;
  annualSpending?: number;
  partTimeIncome?: number;
  withdrawalRate?: number;
  expectedReturn?: number;
}

export function calcBaristaFIRE(params: BaristaFIREParams): BaristaFIREResult;

export interface TimeToFIREParams {
  currentPortfolio?: number;
  annualSavings?: number;
  annualSpending?: number;
  withdrawalRate?: number;
  expectedReturn?: number;
  currentAge?: number;
}

export function calcTimeToFIRE(params: TimeToFIREParams): TimeToFIREResult;

export function calcFIREVariants(annualSpending: number, currentPortfolio: number): FIREVariantsResult;

export function calc72tSEPP(portfolioBalance: number, age: number): SEPP72tResult;
