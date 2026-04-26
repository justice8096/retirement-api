/**
 * Per-country inheritance / estate tax info shown on the retirement
 * dashboard's spouse-death scenario, Estate screen, and (eventually)
 * the Monte Carlo death-year hit.
 *
 * Phase 1 + Phase 2 of the foreign-inheritance-tax data layer (spawned
 * task, 2026-04-26). Phase 1 populated `notes` + `sources` for all 16
 * distinct countries in the location set. Phase 2 (this revision) adds
 * structured fields — `topRate`, `exemptionLocal`, `spouseExemption`,
 * `basis`, `scopeWhenResident` — so consumers can model dollar-amount
 * impact, not just display narrative context.
 *
 * Keyed by the `loc.country` string that retirement-api emits.
 *
 * Source ranking, per the plan:
 *   1. PwC Worldwide Tax Summaries (free, comprehensive, consistent)
 *   2. KPMG global guides (secondary, more detailed rate tables)
 *   3. Country tax authority's own pages (primary for confirmations)
 *
 * Structured-field conventions:
 *   - `topRate` is a fraction 0..1; for progressive systems it's the
 *     highest bracket; for systems with category-based multipliers
 *     (Spain) it's the national worst case (no regional bonification).
 *   - `directFamilyEffectiveRate` is the rate the SPOUSE pays after any
 *     spouse-specific reduction. Only populated for `'partial'` countries
 *     where the spouse rate differs from `topRate`. For `'full'` countries
 *     it's implicitly 0 (kernel returns 0 directly); for `'none'` countries
 *     it's implicitly equal to `topRate`. Phase 3b uses this for the MC
 *     spouse-death scenario kernel hit.
 *   - `exemptionLocal` is the threshold below which no tax owed in the
 *     country's primary local currency. For per-recipient lifetime
 *     allowances (Ireland CAT, Italy), it's the per-recipient figure;
 *     `notes` documents whether the structure is per-estate or
 *     per-recipient. Left undefined when a single threshold doesn't
 *     capture the structure (Spain — varies by AC) or when the figure
 *     is in flux (US — TCJA sunset uncertainty).
 *   - `basis: 'estate'` when tax falls on the estate itself before
 *     distribution (US, UK pattern); `'inheritance'` when each recipient
 *     pays based on what they received (most of Europe, Latin America).
 *   - `scopeWhenResident: 'worldwide'` for residency-based regimes that
 *     reach all the deceased's global assets; `'local-only'` for
 *     situs-based regimes that only tax assets located in-country.
 *   - For zero-tax countries `topRate: 0` and `spouseExemption: 'full'`
 *     are set explicitly; other structured fields stay undefined.
 *
 * Notes remain qualitative for context not captured by the structured
 * fields (per-relationship rate tables, treaty notes, recent reforms).
 *
 * Out of scope for this file:
 *   - Tax treaties (US-FR, US-IE, etc.) — too complex for Phase 1
 *   - Per-relationship rate tables (spouse / kids / siblings / non-rel)
 *   - Wealth taxes (different concept; see French IFI)
 *   - Treaty-based double-taxation relief
 *
 * ─── TODO (Phase 2 — sub-national variation) ────────────────────────────
 *
 * The country-keyed shape of this map flattens jurisdictions where
 * sub-national variation is large enough to mislead users. Two of the
 * 16 covered countries have meaningful state/regional differences:
 *
 *   1. UNITED STATES — Federal estate tax is captured here, but 12
 *      states levy their own state estate tax (MA, NY, OR, WA, MN, IL,
 *      MD, CT, RI, VT, ME, HI) with thresholds far below the federal
 *      ~$13.99M (e.g. MA $2M, OR $1M). Additionally 6 states have
 *      separate INHERITANCE tax paid by recipients (PA, NJ, KY, IA,
 *      MD, NE) with rates depending on relationship to the deceased.
 *      MD has both. The current US entry's `notes` calls these out
 *      qualitatively; for actionable modeling, Phase 2 should layer
 *      a per-US-state map keyed on the location's `subregion` (which
 *      is already populated for US locations after FU-001 region
 *      taxonomy normalization, 2026-04-20).
 *
 *   2. SPAIN — All 17 autonomous communities can adjust rates and
 *      allowances against the national framework, with effective
 *      rates ranging from near-zero (Madrid, Andalucía, Murcia via
 *      99% bonification on direct-family transfers) to substantial
 *      (Asturias, Catalonia at near-full national progressive rates).
 *      The "Spain" entry's `notes` warns about this; Phase 2 should
 *      layer a per-autonomous-community map. Each Spanish location
 *      in the seed data should carry a `subregion` identifying its
 *      autonomous community for the lookup to work.
 *
 * Other countries in this map are unitary for inheritance-tax purposes
 * (Italy's regional variation is property-tax, not inheritance) or
 * have no inheritance tax to vary (Cyprus, Panama, Costa Rica, etc.).
 *
 * Suggested Phase 2 shape (future work — not yet implemented):
 *
 *   shared/country-inheritance-tax-by-state.js — per-(country, subregion)
 *   overrides. The injection layer would prefer a state-level entry when
 *   one exists, falling back to the country-level entry otherwise.
 *   Lookup signature: `inheritanceTaxFor(country, subregion?)` — backwards
 *   compatible with the current single-arg form.
 *
 * Sub-national variation OUTSIDE this list (Switzerland cantonal,
 * Australia state-level) is irrelevant only because those countries
 * aren't yet in the location set; if added, they'll need the same
 * treatment.
 */

/** @typedef {{title: string, url: string, accessed?: string}} Source */
/** @typedef {{
 *   spouseExemption?: 'full' | 'partial' | 'none',
 *   topRate?: number,
 *   directFamilyEffectiveRate?: number,
 *   exemptionLocal?: number,
 *   basis?: 'estate' | 'inheritance',
 *   scopeWhenResident?: 'worldwide' | 'local-only',
 *   notes?: string,
 *   sources?: Source[]
 * }} InheritanceTaxInfo
 */

const ACCESSED = '2026-04-26';

/** @type {Record<string, InheritanceTaxInfo>} */
export var COUNTRY_INHERITANCE_TAX = {
  'United States': {
    spouseExemption: 'full',
    topRate: 0.40,
    // exemptionLocal intentionally undefined — TCJA sunset state at
    // 2026-01-01 means the post-sunset value depends on intervening
    // legislation; users must consult the IRS source for the
    // currently-effective threshold (see Codex P2 fix on PR #70).
    basis: 'estate',
    scopeWhenResident: 'worldwide',
    notes:
      'Federal estate tax: top rate 40%, applied to estates above the unified credit exemption. The TCJA-era exemption (~$13.99M per individual / ~$27M per couple in 2025) was scheduled to sunset to ~$7M (inflation-adjusted) on 2026-01-01; the post-sunset value depends on whether intervening legislation extended TCJA. Consult the IRS source below for the currently-effective threshold rather than relying on a figure here. Unlimited marital deduction — surviving US-citizen spouse inherits federally tax-free. 12 states have separate state estate tax (e.g. MA, NY, OR, WA, MN, IL, MD); thresholds and rates vary widely. 6 states have inheritance tax paid by recipients (PA, NJ, KY, IA, MD, NE) with rates depending on relationship. The Estate screen in this app already models federal estate tax; the spouse-death MC scenario does not yet.',
    sources: [
      {
        title: 'IRS — Estate Tax (Form 706 + Pub 559)',
        url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — United States Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/united-states/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'France': {
    spouseExemption: 'full',
    topRate: 0.60,
    exemptionLocal: 100000, // EUR — per-parent allowance per child (most common direct-line case)
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Surviving spouse fully exempt since 2007 (PACS partners also exempt). Children: progressive 5–45% on amounts above the per-parent allowance (~€100K per child per parent). Siblings: 35–45% above smaller allowances. Non-relatives: flat 60% with minimal allowance (~€1.6K). Tax basis is the recipient (inheritance, not estate). Worldwide assets included if deceased was a French resident. France-US estate tax treaty exists and may reduce double taxation for US citizens. Reform under discussion as of 2025; rates above are 2024 baseline.',
    sources: [
      {
        title: 'Service-Public.fr — Droits de succession',
        url: 'https://www.service-public.fr/particuliers/vosdroits/F14198',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — France Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/france/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Portugal': {
    spouseExemption: 'full',
    topRate: 0.10, // Imposto do Selo on transfers to non-direct-family
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'No inheritance tax in the conventional sense — Portugal abolished it in 2004. Replaced by stamp duty (Imposto do Selo) at 10% on most transfers, BUT direct descendants, ascendants, and spouses are exempt. Effective tax for typical retiree-to-spouse / retiree-to-children transfers: zero. Distant relatives and non-relatives pay the 10% stamp duty. No regional variation. Generally one of the most favorable jurisdictions in Europe for family wealth transfer.',
    sources: [
      {
        title: 'Autoridade Tributária — Imposto do Selo',
        url: 'https://info.portaldasfinancas.gov.pt/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Portugal Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/portugal/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Spain': {
    // Spouse-exemption is 'partial' rather than 'full' because the
    // national framework taxes spouses; many ACs (Madrid, Andalucía,
    // Murcia) apply 99% bonification making it effectively-zero, others
    // (Asturias, Catalonia) apply substantial rates. See notes.
    spouseExemption: 'partial',
    topRate: 0.34, // National worst case before AC bonification or relationship multipliers
    directFamilyEffectiveRate: 0.34, // Conservative — equals topRate; assumes worst-case AC. Sub-national layer (Phase 4) would refine per-AC.
    // exemptionLocal intentionally undefined — varies wildly by
    // autonomous community; see notes for AC-level guidance.
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'WIDE regional variation — Spain has both a national framework AND each of 17 autonomous communities can adjust rates and allowances. National progressive rates are 7.65–34% but with multipliers based on relationship and recipient pre-existing wealth (final effective rate up to ~82% in pathological cases). Some regions (Madrid, Andalucía, Murcia) have near-zero effective rates for spouse and children via 99% bonification. Others (Asturias, Catalonia) apply substantial rates. Recommend consulting region-specific guidance — the figure shown on this app for "Spain" is a national-level approximation; actual liability depends heavily on which autonomous community the deceased resided in.',
    sources: [
      {
        title: 'Agencia Tributaria — Impuesto sobre Sucesiones',
        url: 'https://sede.agenciatributaria.gob.es/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Spain Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/spain/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Italy': {
    spouseExemption: 'partial', // 4% above €1M per recipient; effectively-zero for most family transfers
    topRate: 0.08, // Non-relatives, no allowance
    directFamilyEffectiveRate: 0.04, // Spouse / children rate above the €1M per-recipient allowance
    exemptionLocal: 1000000, // EUR — per-recipient allowance for spouse / children / parents
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Italy is one of the most favorable European jurisdictions for inheritance. Rates: 4% (spouse / children / parents) above a generous €1M per-recipient allowance; 6% (siblings) above €100K; 6% (other relatives, no allowance); 8% (non-relatives, no allowance). Effective tax for typical retiree-to-spouse / retiree-to-children transfers: zero unless estate exceeds €1M per child. Worldwide assets included if deceased was Italian-resident. No regional variation in inheritance tax (unlike property tax).',
    sources: [
      {
        title: 'Agenzia delle Entrate — Imposta sulle successioni',
        url: 'https://www.agenziaentrate.gov.it/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Italy Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/italy/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Ireland': {
    spouseExemption: 'full',
    topRate: 0.33, // Flat CAT rate above per-recipient lifetime threshold
    exemptionLocal: 400000, // EUR — Group A (children) lifetime cumulative threshold; lower for Groups B/C
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Capital Acquisitions Tax (CAT): flat 33% above per-recipient lifetime thresholds. Group A (children, certain step-children, parents inheriting from deceased child): ~€400K (2025). Group B (siblings, nieces/nephews, grandparents): ~€40K. Group C (everyone else): ~€20K. Critically, the threshold is per-RECIPIENT and lifetime-cumulative — not per-estate — so multiple gifts during life count against the threshold. Spouse / civil partner: fully exempt (Group A spousal exemption). Tax falls on the recipient, not the estate. Worldwide assets if either deceased or recipient is Irish-resident. Ireland-US estate tax treaty exists.',
    sources: [
      {
        title: 'Revenue.ie — Capital Acquisitions Tax (CAT)',
        url: 'https://www.revenue.ie/en/gains-gifts-and-inheritance/cat-thresholds-rates-and-aggregation-rules/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Ireland Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/ireland/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Greece': {
    spouseExemption: 'partial', // Spouse exempt to ~€400K then taxed in Category A bracket (1-10%)
    topRate: 0.40, // Category C — distant relatives / non-relatives
    directFamilyEffectiveRate: 0.10, // Conservative midpoint of Category A (1-10% range) above the €150K spouse allowance
    exemptionLocal: 150000, // EUR — Category A (direct family) per-recipient allowance
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Progressive inheritance tax structured by relationship category. Category A (spouse, children, parents): 1–10% above a ~€150K per-recipient allowance — effectively very favorable for direct family. Category B (siblings, grandchildren, etc.): 5–20% above smaller allowances. Category C (more distant relatives, non-relatives): 20–40%. Spouse: exempt up to ~€400K then taxed in Category A bracket. Tax falls on recipient. Real-property elements have additional rules. Generally moderate by European standards for family transfers; punitive for non-relative transfers.',
    sources: [
      {
        title: 'AADE (Independent Authority for Public Revenue) — Φόρος κληρονομιάς',
        url: 'https://www.aade.gr/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Greece Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/greece/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Croatia': {
    spouseExemption: 'full',
    topRate: 0.04,
    // EUR — Croatia adopted the euro on 2023-01-01 at the fixed rate
    // 7.5345 HRK = 1 EUR, converting the historical HRK 50,000 threshold
    // to ~€6,635. The threshold only applies to non-direct-family
    // transfers; spouse / parents / children are exempt regardless of
    // amount. Croatia location data uses currency: 'EUR' post-adoption,
    // so this number is interpreted as euros by consumers.
    exemptionLocal: 6635,
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Flat 4% inheritance/gift tax above small thresholds. Direct family — spouse, children, parents — fully exempt regardless of amount. Siblings and other relatives: 4% above ~HRK 50K threshold (~€6,600). For a typical retiree-to-spouse / retiree-to-children transfer, effective tax is zero. One of the least burdensome jurisdictions in the EU.',
    sources: [
      {
        title: 'Porezna uprava (Croatian Tax Administration) — Inheritance and Gift Tax',
        url: 'https://www.porezna-uprava.hr/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Croatia Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/croatia/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Cyprus': {
    spouseExemption: 'full', // vacuous — no tax at all
    topRate: 0,
    notes:
      'No inheritance tax. Cyprus abolished its inheritance / estate tax in 2000. No federal or regional successor. Stamp duty applies to certain property transfers but not on inheritance specifically. Generally one of the most favorable EU jurisdictions for wealth transfer.',
    sources: [
      {
        title: 'Cyprus Tax Department',
        url: 'https://www.mof.gov.cy/mof/tax/taxdep.nsf',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Cyprus Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/cyprus/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Malta': {
    spouseExemption: 'partial', // movables: full; real-estate inheritance: 5% stamp duty
    topRate: 0.05, // Stamp duty on inherited immovable property
    directFamilyEffectiveRate: 0.05, // Direct family pays the same 5% on inherited real estate; reductions exist for primary residence transfers but not modeled here
    basis: 'inheritance',
    scopeWhenResident: 'local-only', // Stamp duty only applies to Malta-situated real estate
    notes:
      'No general inheritance tax. Stamp duty of 5% applies to inheritance of immovable property (real estate); for primary residence transferring to direct family, reduced rates and exemptions often apply. Movable assets, financial accounts, and personal property transfer tax-free. Maltese citizens and residents enjoy among the most favorable wealth-transfer regimes in the EU.',
    sources: [
      {
        title: 'Commissioner for Revenue (CfR) — Malta',
        url: 'https://cfr.gov.mt/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Malta Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/malta/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Mexico': {
    spouseExemption: 'full', // vacuous — no federal tax
    topRate: 0, // Federal; some states levy nominal acquisition fees on inherited real estate
    notes:
      'No federal inheritance or estate tax. Some states have nominal acquisition / property-transfer taxes that can apply to inherited real estate, but no general death-tax framework. Generally a friendly jurisdiction for wealth transfer. Capital gains tax may apply if heirs later sell appreciated inherited assets — basis rules differ from US (no automatic step-up; original cost basis often preserved).',
    sources: [
      {
        title: 'SAT (Servicio de Administración Tributaria) — Personas Físicas',
        url: 'https://www.sat.gob.mx/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Mexico Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/mexico/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Panama': {
    spouseExemption: 'full', // vacuous — no tax at all
    topRate: 0,
    notes:
      'No inheritance tax. Panama has no general inheritance, estate, or wealth tax. Real-estate transfers may incur registration / stamp duties but no death-tax surcharge. Panama is widely regarded as one of the most favorable jurisdictions in the Americas for wealth transfer. Note: US citizens still owe US federal estate tax on worldwide assets regardless of Panamanian residency.',
    sources: [
      {
        title: 'DGI Panamá (Dirección General de Ingresos)',
        url: 'https://dgi.mef.gob.pa/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Panama Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/panama/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Costa Rica': {
    spouseExemption: 'full', // vacuous — no tax at all
    topRate: 0, // Real-property registration fees ~1.5-2% apply on inherited real estate but no death-tax surcharge
    notes:
      'No inheritance tax. Costa Rica has no general inheritance, estate, or gift tax. Real-property transfers (including inherited real estate) are subject to registration fees of ~1.5–2% of assessed value. No death-tax surcharge beyond that. Generally favorable for wealth transfer.',
    sources: [
      {
        title: 'Ministerio de Hacienda — Costa Rica',
        url: 'https://www.hacienda.go.cr/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Costa Rica Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/costa-rica/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Colombia': {
    spouseExemption: 'none', // Treated as ganancia ocasional — no spouse exemption from the 15% rate above the threshold
    topRate: 0.15,
    // exemptionLocal in UVT (2024: ~3,490 UVT ≈ ~$36K USD); UVT is
    // re-indexed annually so leaving undefined and letting `notes` carry
    // the qualitative figure is more durable than a stale local number.
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'No dedicated inheritance tax. Inherited assets are treated as occasional income (ganancia ocasional) for the recipient, taxed at 15% above the per-recipient allowance (~3,490 UVT in 2024 ≈ ~$36K USD). Spouse and children inherit with the same allowance-and-15%-above structure as other heirs — there is no spouse exemption per se. Worldwide assets if deceased was Colombian resident.',
    sources: [
      {
        title: 'DIAN (Dirección de Impuestos y Aduanas Nacionales) — Ganancia Ocasional',
        url: 'https://www.dian.gov.co/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Colombia Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/colombia/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Ecuador': {
    spouseExemption: 'partial', // Direct family qualifies for 50% reduction in tax owed
    topRate: 0.35,
    directFamilyEffectiveRate: 0.175, // 50% reduction of topRate for direct family
    exemptionLocal: 76000, // USD — Ecuador is dollarized, so this is in USD (2024 baseline)
    basis: 'inheritance',
    scopeWhenResident: 'worldwide',
    notes:
      'Progressive inheritance tax: 0–35% based on amount inherited. The first ~$76K per recipient (2024) is exempt; brackets escalate from 5% to 35% at the top. Direct family (spouse, children, parents) qualifies for a 50% reduction in tax owed. Worldwide assets if deceased was Ecuadorian resident. Among the more punitive Latin American jurisdictions for large estates, but the exemption shelters typical middle-class inheritances.',
    sources: [
      {
        title: 'SRI (Servicio de Rentas Internas) — Herencias, Legados y Donaciones',
        url: 'https://www.sri.gob.ec/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Ecuador Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/ecuador/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },

  'Uruguay': {
    spouseExemption: 'full', // vacuous — no tax at all
    topRate: 0, // ITP at 4% applies to inherited real-estate transfers (half rate vs sale) but no death-tax surcharge on financial assets
    notes:
      'No inheritance tax. Uruguay has no general inheritance, estate, or gift tax. Real-property transfers incur ITP (Impuesto a las Transmisiones Patrimoniales) at 4% (3% buyer, 1% seller) — applies to inheritance of real estate at half rate. No death-tax surcharge on financial assets. Uruguay is among the most favorable South American jurisdictions for wealth transfer.',
    sources: [
      {
        title: 'DGI Uruguay (Dirección General Impositiva) — ITP',
        url: 'https://www.dgi.gub.uy/',
        accessed: ACCESSED,
      },
      {
        title: 'PwC Worldwide Tax Summaries — Uruguay Individual: Other taxes',
        url: 'https://taxsummaries.pwc.com/uruguay/individual/other-taxes',
        accessed: ACCESSED,
      },
    ],
  },
};

/** Lookup helper — returns `undefined` for unknown countries. Mirrors
 *  the shape of `taxSourcesFor` in `country-tax-sources.js` so the
 *  injection layer in routes/locations.ts can use the same pattern. */
export function inheritanceTaxFor(country) {
  return COUNTRY_INHERITANCE_TAX[country];
}
