/**
 * Annual S&P 500 total return + US CPI inflation, 1928–2024.
 *
 * Approximate values compiled from commonly-cited historical sources
 * (Damodaran NYU Stern, Robert Shiller, BLS CPI-U). Values may differ by
 * ±0.5% from authoritative sources; replace with a canonical dataset if
 * you need precise backtesting. Used for:
 *   - Historical mean/vol presets
 *   - Bootstrap sampling (random-year resample)
 *   - Historical sequence backtest (sim replays real years forward)
 *
 * Both return and inflation are decimal fractions (0.07 = 7%).
 */
export interface HistoricalYear {
    year: number;
    /** S&P 500 total return (price + dividends), nominal. */
    sp500: number;
    /** US CPI-U year-over-year change. */
    cpi: number;
}
export declare const HISTORICAL_RETURNS: HistoricalYear[];
export interface HistoricalPreset {
    id: string;
    label: string;
    startYear: number;
    endYear: number;
    description: string;
}
export declare const HISTORICAL_PRESETS: HistoricalPreset[];
/** Compute mean and std-dev of annual returns + inflation over a year range. */
export declare function statsForRange(startYear: number, endYear: number): {
    meanReturn: number;
    volReturn: number;
    meanInflation: number;
    volInflation: number;
    yearsIncluded: number;
};
/**
 * Bootstrap-sample a single year's (return, inflation) from history. Keeps the
 * two series paired so return/inflation correlation is preserved.
 *
 * Accepts the caller's RNG so seeded runs are reproducible — without it the
 * bootstrap draw would use `Math.random()` and break the `seededRandom`
 * determinism guarantee for `returnMode: 'bootstrap'`. Defaults to
 * `Math.random` for legacy callers.
 */
export declare function bootstrapYear(rand?: () => number): {
    ret: number;
    inf: number;
};
