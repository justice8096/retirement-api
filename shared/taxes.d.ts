export interface Source {
  title: string;
  url: string;
  accessed?: string;
}

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface SocialCharges {
  rate: number;
  name: string;
  basis: string;
  annualThreshold: number;
}

export interface TaxConfig {
  federalIncomeTax?: {
    applies?: boolean;
    brackets?: TaxBracket[];
    standardDeduction?: number;
    foreignTaxCredit?: boolean;
  };
  stateIncomeTax?: {
    rate?: number;
    type?: string;
    label?: string;
    brackets?: TaxBracket[];
    deduction?: number;
    exemptions?: string;
  };
  salesTax?: { rate: number; notes?: string };
  propertyTax?: { rate: number; notes?: string };
  socialCharges?: SocialCharges | null;
  vatRate?: number;
  estVehicleTax?: number;
  ssExempt?: boolean;
  ssTaxedInCountry?: boolean;
  retirementExempt?: boolean;
  notes?: string;
}

export interface TaxDetail {
  label: string;
  amount: number;
  note: string;
}

export interface TaxResult {
  federal: number;
  state: number;
  socialCharges: number;
  salesVat: number;
  vehicleTax: number;
  total: number;
  totalIncome: number;
  effectiveRate: number;
  details: TaxDetail[];
}

export interface LocationWithTaxes {
  taxes: TaxConfig;
  [key: string]: unknown;
}

export const FED_BRACKETS_2026_SOURCES: Source[];
export const FED_STD_DEDUCTION_2026_SOURCES: Source[];
export const OBBBA_SENIOR_SOURCES: Source[];

export function calcBracketTax(income: number, brackets: TaxBracket[]): number;

export function calcTaxesForLocation(
  loc: LocationWithTaxes,
  ssIncome: number,
  iraIncome: number,
  investIncome: number,
): TaxResult | null;
