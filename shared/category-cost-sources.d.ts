import type { Source } from './taxes';

/** Per-cost-category structured citations keyed by MonthlyCosts key. */
export const CATEGORY_COST_SOURCES: Record<string, Source[]>;

/** Lookup helper — returns `undefined` for unknown categories. */
export function costSourcesFor(category: string | null | undefined): Source[] | undefined;
