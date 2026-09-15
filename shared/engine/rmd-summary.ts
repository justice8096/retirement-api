/**
 * Compact, JSON-friendly digest of `MonteCarloResult.rmd` shared by the API
 * (POST /api/simulate) and the retirement MCP so both surfaces report the
 * RMD / conversion / IRMAA pass the same way.
 */

import type { RmdSummary } from './monte-carlo.js';

export interface RmdDigest {
  totalGrossRmd: number;
  totalForcedExcess: number;
  totalRmdTax: number;
  totalConversions: number;
  totalConversionTax: number;
  totalIrmaa: number;
  firstRmdSimYear: number;
  firstRmdMean: number;
  peakRmdSimYear: number;
  peakRmdMean: number;
  meanGrossByYear: number[];
  meanTaxByYear: number[];
  meanConversionByYear: number[];
  meanIrmaaByYear: number[];
  meanMagiByYear: number[];
  meanTraditionalEndByYear: number[];
  afterTax: {
    successRate: number;
    successPct: number;
    median: number;
    p5: number;
    p25: number;
    p75: number;
    p95: number;
  };
}

export function digestRmdSummary(m: RmdSummary): RmdDigest {
  const sum = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0));
  const round = (a: number[]) => a.map((v) => Math.round(v));
  const firstYear = m.meanGrossByYear.findIndex((v) => v > 0);
  const peakYear = m.meanGrossByYear.reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
  return {
    totalGrossRmd: sum(m.meanGrossByYear),
    totalForcedExcess: sum(m.meanExcessByYear),
    totalRmdTax: sum(m.meanTaxByYear),
    totalConversions: sum(m.meanConversionByYear),
    totalConversionTax: sum(m.meanConversionTaxByYear),
    totalIrmaa: sum(m.meanIrmaaByYear),
    firstRmdSimYear: firstYear,
    firstRmdMean: firstYear >= 0 ? Math.round(m.meanGrossByYear[firstYear]) : 0,
    peakRmdSimYear: peakYear,
    peakRmdMean: Math.round(m.meanGrossByYear[peakYear] ?? 0),
    meanGrossByYear: round(m.meanGrossByYear),
    meanTaxByYear: round(m.meanTaxByYear),
    meanConversionByYear: round(m.meanConversionByYear),
    meanIrmaaByYear: round(m.meanIrmaaByYear),
    meanMagiByYear: round(m.meanMagiByYear),
    meanTraditionalEndByYear: round(m.meanTraditionalEndByYear),
    afterTax: {
      successRate: m.afterTax.successRate,
      successPct: Math.round(m.afterTax.successRate * 100),
      median: Math.round(m.afterTax.median),
      p5: Math.round(m.afterTax.p5),
      p25: Math.round(m.afterTax.p25),
      p75: Math.round(m.afterTax.p75),
      p95: Math.round(m.afterTax.p95),
    },
  };
}