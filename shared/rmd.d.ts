export interface RMDResult {
  rmd: number;
  divisor: number;
  required: boolean;
  startAge: number;
  rmdAge?: number;
}

export function getRMDStartAge(birthYear: number): number;
export function getDistributionPeriod(age: number): number;
export function calcRMD(priorYearBalance: number, age: number, birthYear: number): RMDResult;

export function calcCoupleRMD(
  priorYearBalance: number,
  hAge: number,
  wAge: number,
  hBirthYear: number,
  wBirthYear: number,
  hAlive: boolean,
  wAlive: boolean,
): RMDResult;

export declare const RMD_PENALTY_RATE: number;
export declare const RMD_PENALTY_RATE_CORRECTED: number;
