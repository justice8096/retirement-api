import type { Source } from './taxes';

/** Per-country structured tax-source citations keyed by full country name. */
export const COUNTRY_TAX_SOURCES: Record<string, Source[]>;

/** Lookup helper — returns `undefined` for unknown countries. */
export function taxSourcesFor(country: string | null | undefined): Source[] | undefined;
