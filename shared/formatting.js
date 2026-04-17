/**
 * Currency / percentage formatting helpers.
 *
 * NOTE: These helpers are **developer- and admin-tooling only** where noted.
 * User-facing output should prefer `fmt(n, opts)` which uses full
 * `Intl.NumberFormat` without abbreviation — abbreviated output (K / M)
 * is a documented dyscalculia anti-pattern. See audits/
 * Dyscalculia-Compliance-Audit-retirement-api-2026-04-16.md (F-003).
 */

/**
 * Full currency formatting. Locale- and currency-aware via Intl.NumberFormat.
 *
 * @param {number} n
 * @param {object} [opts]
 * @param {string} [opts.locale]   - BCP-47 locale tag (default en-US).
 * @param {string} [opts.currency] - ISO 4217 code (default USD).
 * @returns {string} e.g. "$1,234,567" or "1.234.567,00 €"
 */
export function fmt(n, opts = {}) {
  const { locale = 'en-US', currency = 'USD' } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(n));
  } catch {
    return '$' + Math.round(n).toLocaleString();
  }
}

/**
 * Percentage formatting.
 *
 * @param {number} n         Decimal fraction (0.04 = 4%).
 * @param {object} [opts]
 * @param {number} [opts.digits=1]
 * @param {string} [opts.locale]
 * @returns {string} "4.0%"
 */
export function pct(n, opts = {}) {
  const { digits = 1, locale = 'en-US' } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return (n * 100).toFixed(digits) + '%';
  }
}

/**
 * @deprecated **DEVELOPER-LOG ONLY.** Abbreviated currency like "$1234K" is
 * a dyscalculia anti-pattern — it forces magnitude decoding that is exactly
 * what dyscalculic users struggle with. Do NOT import from any user-facing
 * module. Prefer `fmt(n, opts)`.
 *
 * Kept for internal log/debug output where compactness matters and the
 * audience is the developer, not the end user.
 */
export function fmtKUnsafe(n) {
  return '$' + (n / 1000).toFixed(0) + 'K';
}
