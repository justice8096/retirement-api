export interface CostEntry {
  typical?: number;
  annualInflation?: number;
  [key: string]: unknown;
}

export interface LocationLike {
  currency?: string;
  monthlyCosts?: Record<string, CostEntry>;
  [key: string]: unknown;
}

export interface ProjectionRow {
  year: number;
  total: number;
  annual: number;
  fxMultiplier: number;
  cumulative: number;
  [category: string]: number;
}

export function getFxMultiplier(loc: LocationLike, yearsOut: number, fxDrift: number): number;

export function getInflationMultiplier(
  loc: LocationLike,
  category: string,
  targetYear: number,
): number;

export function getInflationFxMultiplier(
  loc: LocationLike,
  category: string,
  targetYear: number,
  fxDrift: number,
): number;

export function getAvgInflationMultiplier(loc: LocationLike, targetYear: number): number;

export function getTypicalMonthly(loc: LocationLike): number;

export function getProjectedMonthly(
  loc: LocationLike,
  targetYear: number,
  fxDrift: number,
): number;

export function projectCosts(
  loc: LocationLike,
  startYear: number,
  years: number,
  fxDrift: number,
): ProjectionRow[];
