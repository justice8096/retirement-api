/**
 * Spending Models type definitions
 */

export type Phase = 'go-go' | 'slow-go' | 'no-go';
export type ModelType = 'level' | 'smile' | 'declining' | 'essential-first';
export type CategoryClassification = 'essential' | 'discretionary' | 'mixed';

export interface SpendingSmileResult {
  adjustedSpending: number;
  phase: Phase;
  realChangeRate: number;
}

export interface DecliningSpendingResult {
  adjustedSpending: number;
  cumulativeDecline: number;
}

export interface EssentialDiscretionaryResult {
  essential: number;
  discretionary: number;
  mixed: number;
  total: number;
}

export function calcSpendingSmile(
  baseSpending: number,
  yearsIntoRetirement: number,
  retirementAge?: number,
): SpendingSmileResult;

export function calcDecliningSpending(
  baseSpending: number,
  yearsIntoRetirement: number,
  annualDeclineRate?: number,
): DecliningSpendingResult;

export function calcEssentialDiscretionary(
  categories: Record<string, number>,
  categoryClassification?: Record<string, CategoryClassification>,
): EssentialDiscretionaryResult;

export interface ApplySpendingModelParams {
  retirementAge?: number;
  declineRate?: number;
  categories?: Record<string, number>;
  categoryClassification?: Record<string, CategoryClassification>;
  [key: string]: unknown;
}

export function applySpendingModel(
  modelType: ModelType,
  baseSpending: number,
  year: number,
  params?: ApplySpendingModelParams,
): number;
