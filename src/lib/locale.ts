/**
 * Best-effort BCP-47 locale parsing from an `Accept-Language` header. Used to
 * echo the honored locale back via `Content-Language` and to drive
 * `Intl.NumberFormat` in response-shaping helpers.
 *
 * Addresses:
 *   - Dyslexia audit F-008 (`Content-Language: en` was hard-coded)
 *   - Dyscalculia audit F-007 (`Intl.NumberFormat` with an explicit locale)
 */

const SUPPORTED_LOCALES = [
  'en-US', 'en-GB', 'en',
  'es-MX', 'es-ES', 'es',
  'fr-FR', 'fr',
  'de-DE', 'de',
  'pt-BR', 'pt',
  'it-IT', 'it',
];

const FALLBACK_LOCALE = 'en-US';

/**
 * Pick the best supported locale for the client's `Accept-Language` header.
 * Always returns a valid BCP-47 tag; never returns the empty string.
 */
export function pickLocale(header: string | undefined): string {
  if (!header) return FALLBACK_LOCALE;

  const candidates = header
    .split(',')
    .map((raw) => {
      const [tag, qPart] = raw.trim().split(';');
      const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
      return { tag: tag?.trim(), q: Number.isNaN(q) ? 1 : q };
    })
    .filter((c) => !!c.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    if (!tag) continue;
    // Exact match first
    if (SUPPORTED_LOCALES.includes(tag)) return tag;
    // Prefix match (e.g. "en-AU" → "en")
    const base = tag.split('-')[0];
    if (base && SUPPORTED_LOCALES.includes(base)) return base;
  }
  return FALLBACK_LOCALE;
}

/** Currency code per default user locale. Extend as new markets come online. */
const LOCALE_TO_CURRENCY: Record<string, string> = {
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en': 'USD',
  'es-MX': 'MXN',
  'es-ES': 'EUR',
  'es': 'EUR',
  'fr-FR': 'EUR',
  'fr': 'EUR',
  'de-DE': 'EUR',
  'de': 'EUR',
  'pt-BR': 'BRL',
  'pt': 'EUR',
  'it-IT': 'EUR',
  'it': 'EUR',
};

export function defaultCurrencyFor(locale: string): string {
  return LOCALE_TO_CURRENCY[locale] ?? 'USD';
}
