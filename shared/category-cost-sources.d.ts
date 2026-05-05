import type { Source } from './taxes';

/** Per-cost-category structured citations keyed by MonthlyCosts key
 *  (global default — applies to any country without a country-specific
 *  source set). */
export const CATEGORY_COST_SOURCES: Record<string, Source[]>;

/** Per-country, per-cost-category first-party sources (national stat
 *  offices, regulators, government portals). Country names match
 *  `LocationFull.country` strings. */
export const COUNTRY_CATEGORY_COST_SOURCES: Record<string, Record<string, Source[]>>;

/** Lookup helper — returns merged country-specific + global sources.
 *  Country-specific first-party sources are returned first, followed
 *  by the global default. Returns `undefined` if neither registers
 *  the category. */
export function costSourcesFor(
  category: string | null | undefined,
  country?: string | null,
): Source[] | undefined;
