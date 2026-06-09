// ╔══════════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT.                                      ║
// ║  Source of truth: retirement-dashboard-angular/src/app/models/{shared,tax}.model.ts (Source, TaxBracket)
// ║  Regenerate:      npm run engine:sync                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// @ts-nocheck

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
