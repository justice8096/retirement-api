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
export declare function digestRmdSummary(m: RmdSummary): RmdDigest;
