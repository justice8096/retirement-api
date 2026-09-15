/**
 * Compact, JSON-friendly digest of `MonteCarloResult.rmd` shared by the API
 * (POST /api/simulate) and the retirement MCP so both surfaces report the
 * RMD / conversion / IRMAA pass the same way.
 */
export function digestRmdSummary(m) {
    const sum = (a) => Math.round(a.reduce((s, v) => s + v, 0));
    const round = (a) => a.map((v) => Math.round(v));
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
