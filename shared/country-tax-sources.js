/**
 * Per-country structured citations for VAT, social charges, and income-tax
 * bracket tables shown on the retirement dashboard's Taxes screen.
 *
 * Keyed by the `loc.country` string that retirement-api emits (full
 * English name, not ISO code). Each entry lists 1–3 authoritative
 * sources. Prefer the national tax authority's official page when
 * available; fall back to the PwC / KPMG Worldwide Tax Summary (which
 * the tax-advisory industry treats as the go-to English-language
 * reference for cross-border retirees).
 *
 * Keep in sync with the dashboard-side rendering (see Todos #11).
 */

/** @typedef {{title: string, url: string, accessed?: string}} Source */

/** @type {Record<string, Source[]>} */
export var COUNTRY_TAX_SOURCES = {
  'United States': [
    {
      title: 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments)',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      accessed: '2026-04-22',
    },
    {
      title: 'IRC § 1 — Tax imposed',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      accessed: '2026-04-22',
    },
  ],
  'France': [
    {
      title: 'DGFiP — Barème de l\'impôt sur le revenu 2026',
      url: 'https://www.impots.gouv.fr/particulier/les-bareme-impots',
      accessed: '2026-04-22',
    },
    {
      title: 'Service-Public.fr — Prélèvements sociaux (CSG, CRDS)',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F2971',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — France',
      url: 'https://taxsummaries.pwc.com/france',
      accessed: '2026-04-22',
    },
  ],
  'Portugal': [
    {
      title: 'Autoridade Tributária — IRS (income tax)',
      url: 'https://info.portaldasfinancas.gov.pt/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Portugal',
      url: 'https://taxsummaries.pwc.com/portugal',
      accessed: '2026-04-22',
    },
  ],
  'Spain': [
    {
      title: 'Agencia Tributaria — IRPF brackets',
      url: 'https://sede.agenciatributaria.gob.es/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Spain',
      url: 'https://taxsummaries.pwc.com/spain',
      accessed: '2026-04-22',
    },
  ],
  'Italy': [
    {
      title: 'Agenzia delle Entrate — IRPEF brackets',
      url: 'https://www.agenziaentrate.gov.it/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Italy',
      url: 'https://taxsummaries.pwc.com/italy',
      accessed: '2026-04-22',
    },
  ],
  'Ireland': [
    {
      title: 'Revenue.ie — Income tax rates and credits',
      url: 'https://www.revenue.ie/en/jobs-and-pensions/calculating-your-income-tax/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Ireland',
      url: 'https://taxsummaries.pwc.com/ireland',
      accessed: '2026-04-22',
    },
  ],
  'Greece': [
    {
      title: 'AADE (Independent Authority for Public Revenue)',
      url: 'https://www.aade.gr/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Greece',
      url: 'https://taxsummaries.pwc.com/greece',
      accessed: '2026-04-22',
    },
  ],
  'Croatia': [
    {
      title: 'Porezna uprava (Croatian Tax Administration)',
      url: 'https://www.porezna-uprava.hr/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Croatia',
      url: 'https://taxsummaries.pwc.com/croatia',
      accessed: '2026-04-22',
    },
  ],
  'Cyprus': [
    {
      title: 'Cyprus Tax Department',
      url: 'https://www.mof.gov.cy/mof/tax/taxdep.nsf',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Cyprus',
      url: 'https://taxsummaries.pwc.com/cyprus',
      accessed: '2026-04-22',
    },
  ],
  'Malta': [
    {
      title: 'Commissioner for Revenue (CfR) — Malta',
      url: 'https://cfr.gov.mt/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Malta',
      url: 'https://taxsummaries.pwc.com/malta',
      accessed: '2026-04-22',
    },
  ],
  'Mexico': [
    {
      title: 'SAT (Servicio de Administración Tributaria)',
      url: 'https://www.sat.gob.mx/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Mexico',
      url: 'https://taxsummaries.pwc.com/mexico',
      accessed: '2026-04-22',
    },
  ],
  'Panama': [
    {
      title: 'DGI Panamá (Dirección General de Ingresos)',
      url: 'https://dgi.mef.gob.pa/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Panama',
      url: 'https://taxsummaries.pwc.com/panama',
      accessed: '2026-04-22',
    },
  ],
  'Costa Rica': [
    {
      title: 'Ministerio de Hacienda — Costa Rica',
      url: 'https://www.hacienda.go.cr/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Costa Rica',
      url: 'https://taxsummaries.pwc.com/costa-rica',
      accessed: '2026-04-22',
    },
  ],
  'Colombia': [
    {
      title: 'DIAN (Dirección de Impuestos y Aduanas Nacionales)',
      url: 'https://www.dian.gov.co/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Colombia',
      url: 'https://taxsummaries.pwc.com/colombia',
      accessed: '2026-04-22',
    },
  ],
  'Ecuador': [
    {
      title: 'SRI (Servicio de Rentas Internas)',
      url: 'https://www.sri.gob.ec/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Ecuador',
      url: 'https://taxsummaries.pwc.com/ecuador',
      accessed: '2026-04-22',
    },
  ],
  'Uruguay': [
    {
      title: 'DGI Uruguay (Dirección General Impositiva)',
      url: 'https://www.dgi.gub.uy/',
      accessed: '2026-04-22',
    },
    {
      title: 'PwC Worldwide Tax Summaries — Uruguay',
      url: 'https://taxsummaries.pwc.com/uruguay',
      accessed: '2026-04-22',
    },
  ],
};

/** Lookup helper — returns `undefined` for unknown countries. */
export function taxSourcesFor(country) {
  return COUNTRY_TAX_SOURCES[country];
}
