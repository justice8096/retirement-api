export interface AcaBridgeSavingsDraw {
  applicable: boolean;
  /** Monthly savings draw ($/mo) for a married couple (MFJ), 400%-FPL 84,600. */
  couple: number;
  /** Monthly savings draw ($/mo) for a single filer, 400%-FPL 62,600. */
  single: number;
  _units?: {
    couple: { encoding: 'amount'; currency: 'USD'; periodicity: 'month' };
    single: { encoding: 'amount'; currency: 'USD'; periodicity: 'month' };
  };
  _meta?: {
    ceilingCouple: number;
    ceilingSingle: number;
    applicablePct: number;
    taxIncluded: true;
    regime: string;
    singleBasis: string;
  };
}

export interface TaxResultLike {
  total: number;
}

export interface AcaBridgeDeps {
  // Loosely typed on purpose: accepts the real `calcTaxesForLocation` whose
  // `loc`/`opts` are more specific (parameter contravariance under strict).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calcTaxesForLocation: (
    loc: any,
    ssIncome: number,
    iraIncome: number,
    investIncome: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts?: any,
  ) => TaxResultLike | null;
}

export const US_FPL_400_2026: { couple: number; single: number };
export const ACA_APPLICABLE_PCT_2026: number;

export function computeAcaBridgeSavingsDraw(
  loc: Record<string, unknown>,
  deps: AcaBridgeDeps,
): AcaBridgeSavingsDraw;
