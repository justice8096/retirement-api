export declare const CURRENT_YEAR: number;

export declare const COLORS: readonly string[];

export declare const CAT_COLORS: Record<string, string>;

export declare const PROJ_CAT_LABELS: Record<string, string>;

export interface CostCategoryDef {
  key: string;
  label: string;
  defaultInflation: number;
}

export declare const COST_CATEGORIES: readonly CostCategoryDef[];

export interface TabConfigEntry {
  id: string;
  label: string;
  path: string;
  lazy?: boolean;
}

export declare const TAB_CONFIG: readonly TabConfigEntry[];
