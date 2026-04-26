/**
 * Type declarations for the country-inheritance-tax data layer.
 * See country-inheritance-tax.js for documentation and rationale.
 */

export interface InheritanceTaxSource {
  title: string;
  url: string;
  accessed?: string;
}

export interface InheritanceTaxInfo {
  /** Whether the spouse inherits free of tax. */
  spouseExemption?: 'full' | 'partial' | 'none';
  /** Top marginal rate, as a fraction 0..1. */
  topRate?: number;
  /** Threshold below which no tax owed, in local currency. */
  exemptionLocal?: number;
  /** 'estate' (taxed at the estate, US/UK pattern) vs 'inheritance'
   *  (taxed at the recipient, most of Europe / Latin America). */
  basis?: 'estate' | 'inheritance';
  /** Whether residence-based (worldwide assets) or situs-based
   *  (local-only assets) when deceased was a resident. */
  scopeWhenResident?: 'worldwide' | 'local-only';
  /** Free-text caveats — regional variation, per-relationship rate
   *  differences, treaty notes, recent reforms. */
  notes?: string;
  sources?: InheritanceTaxSource[];
}

export const COUNTRY_INHERITANCE_TAX: Record<string, InheritanceTaxInfo>;

export function inheritanceTaxFor(country: string): InheritanceTaxInfo | undefined;
