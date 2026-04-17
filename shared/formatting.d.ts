export interface FormatOpts {
  locale?: string;
  currency?: string;
}

export interface PctOpts {
  digits?: number;
  locale?: string;
}

export function fmt(n: number, opts?: FormatOpts): string;
export function pct(n: number, opts?: PctOpts): string;

/**
 * @deprecated Developer-log only. Dyscalculia anti-pattern in user-facing output.
 */
export function fmtKUnsafe(n: number): string;
