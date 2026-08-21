/**
 * Local type shims for the Monte Carlo engine.
 *
 * The Angular canonical imports these two types from `@models/api.model`
 * (`retirement-dashboard-angular/src/app/models/{shared,tax}.model.ts`).
 * `@retirement/shared/engine` has no Angular path-alias resolution, so this
 * file stands in as the canonical home for the two interfaces the engine
 * actually consumes. Keep in sync with the Angular models if their shape
 * changes.
 */
/** Citation source attached to a constant (title + URL + accessed date). */
export interface Source {
    title: string;
    url: string;
    accessed?: string;
}
/** One progressive tax bracket: tax `rate` on income in (min, max]. */
export interface TaxBracket {
    min: number;
    max: number | null;
    rate: number;
}
