/**
 * Per-category structured citations for the cost-range values
 * (`monthlyCosts.<category>.typical` etc.) returned from the
 * locations endpoints. Each category maps to 1–3 authoritative
 * sources. Seed data doesn't carry these per-location; retirement-api
 * injects them at response time based on the category key + country.
 *
 * Keys match `MonthlyCosts` properties on the dashboard model.
 *
 * Sourcing tier (per Todo #13 — "first-party data" requirement):
 *   1. Country-specific national statistical office or regulator
 *      (BLS / EIA / CMS for US; INSEE for France; INE for Spain;
 *      ISTAT for Italy; INEGI for Mexico; CSO for Ireland; etc.)
 *   2. Supranational authority (OECD, Eurostat, WHO)
 *   3. Industry / consumer aggregator (Numbeo, Expatistan, GoodRx —
 *      retained for cross-city comparison context only; first-party
 *      data takes precedence in the citation order)
 *
 * The `costSourcesFor(category, country)` lookup merges country-
 * specific sources (from COUNTRY_CATEGORY_COST_SOURCES) with the
 * global default (from CATEGORY_COST_SOURCES), with country-specific
 * sources first so they appear at the top of the citation list.
 *
 * See Todos #11, #13.
 */

/** @typedef {{title: string, url: string, accessed?: string}} Source */

const ACCESSED = '2026-05-05';

// ─── Global defaults ──────────────────────────────────────────────────
//
// Used as a fallback when no country-specific source set is registered,
// and appended after country-specific sources when one is.

/** @type {Record<string, Source[]>} */
export var CATEGORY_COST_SOURCES = {
  rent: [
    {
      title: 'OECD — Affordable Housing Database (HM1 housing-cost overburden by country)',
      url: 'https://www.oecd.org/housing/data/affordable-housing-database/',
      accessed: ACCESSED,
    },
    {
      title: 'Numbeo — Cost of Living (rent by city, cross-city comparisons)',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
    {
      title: 'Expatistan — rent comparisons',
      url: 'https://www.expatistan.com/cost-of-living',
      accessed: '2026-04-22',
    },
  ],
  groceries: [
    {
      title: 'OECD — Consumer Price Indices (food)',
      url: 'https://data.oecd.org/price/consumer-prices.htm',
      accessed: ACCESSED,
    },
    {
      title: 'Numbeo — Grocery basket prices',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  utilities: [
    {
      title: 'IEA — Electricity prices for households',
      url: 'https://www.iea.org/data-and-statistics/data-product/electricity-prices',
      accessed: ACCESSED,
    },
    {
      title: 'Numbeo — Utilities (electricity, water, heating, internet)',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  healthcare: [
    {
      title: 'OECD Health Statistics',
      url: 'https://www.oecd.org/health/health-data.htm',
      accessed: '2026-04-22',
    },
    {
      title: 'World Health Organization — Country health profiles',
      url: 'https://www.who.int/data/gho/data/countries',
      accessed: '2026-04-22',
    },
  ],
  insurance: [
    {
      title: 'International Insurance (Cigna Global, IMG, GeoBlue) rate quotes',
      url: 'https://www.cignaglobal.com/',
      accessed: '2026-04-22',
    },
  ],
  medicine: [
    {
      title: 'OECD — Pharmaceutical market / drug prices',
      url: 'https://www.oecd.org/health/pharmaceutical-market.htm',
      accessed: '2026-04-22',
    },
    {
      title: 'GoodRx — Prescription price database (US)',
      url: 'https://www.goodrx.com/',
      accessed: '2026-04-22',
    },
  ],
  medicalOOP: [
    {
      title: 'WHO — Out-of-pocket health expenditure (% of total health expenditure)',
      url: 'https://data.worldbank.org/indicator/SH.XPD.OOPC.CH.ZS',
      accessed: ACCESSED,
    },
    {
      title: 'KFF — Out-of-pocket health spending by country',
      url: 'https://www.kff.org/',
      accessed: '2026-04-22',
    },
  ],
  petCare: [
    {
      title: 'Rover — Pet care costs by region',
      url: 'https://www.rover.com/blog/pet-care-costs/',
      accessed: '2026-04-22',
    },
  ],
  petDaycare: [
    {
      title: 'Rover — Pet daycare rates',
      url: 'https://www.rover.com/',
      accessed: '2026-04-22',
    },
  ],
  petGrooming: [
    {
      title: 'Rover — Pet grooming cost guide',
      url: 'https://www.rover.com/blog/dog-grooming-cost/',
      accessed: '2026-04-22',
    },
  ],
  transportation: [
    {
      title: 'OECD — Transport infrastructure investment',
      url: 'https://data.oecd.org/transport/infrastructure-investment.htm',
      accessed: ACCESSED,
    },
    {
      title: 'Numbeo — Transportation (fares, fuel, monthly pass)',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  entertainment: [
    {
      title: 'Numbeo — Restaurants & leisure',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  clothing: [
    {
      title: 'OECD — CPI clothing & footwear',
      url: 'https://data.oecd.org/price/consumer-prices.htm',
      accessed: ACCESSED,
    },
    {
      title: 'Numbeo — Clothing & shoes',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  personalCare: [
    {
      title: 'Numbeo — Personal care / haircut / hygiene',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  subscriptions: [
    {
      title: 'Published list prices (Netflix, Spotify, ChatGPT, etc.)',
      url: 'https://www.netflix.com/signup/planform',
      accessed: '2026-04-22',
    },
  ],
  phoneCell: [
    {
      title: 'OECD — Mobile broadband subscription prices',
      url: 'https://www.oecd.org/digital/broadband/broadband-statistics/',
      accessed: ACCESSED,
    },
    {
      title: 'Per-location detailed-costs seed (see supplements)',
      url: 'https://github.com/justice8096/retirement-api/tree/master/data/locations',
      accessed: '2026-04-22',
    },
  ],
  taxes: [
    {
      title: 'See country tax-sources tooltip on the Taxes screen',
      url: 'https://github.com/justice8096/retirement-api/blob/master/shared/country-tax-sources.js',
      accessed: '2026-04-22',
    },
  ],
  buffer: [
    {
      title: 'Internal assumption (10% contingency buffer over sum of categories)',
      url: 'https://github.com/justice8096/retirement-dashboard-angular',
      accessed: '2026-04-22',
    },
  ],
  miscellaneous: [
    {
      title: 'Internal assumption (residual catch-all)',
      url: 'https://github.com/justice8096/retirement-dashboard-angular',
      accessed: '2026-04-22',
    },
  ],
};

// ─── Country-specific first-party sources ─────────────────────────────
//
// Per Todo #13: national statistical offices, regulators, government
// portals — citation precedence over the global Numbeo/OECD entries.
// Country names match `LocationFull.country` strings.

/** @type {Record<string, Record<string, Source[]>>} */
export var COUNTRY_CATEGORY_COST_SOURCES = {
  // ─── United States ────────────────────────────────────────────────
  'United States': {
    rent: [
      {
        title: 'BLS — Consumer Price Index, Rent of Primary Residence (CUUR0000SEHA)',
        url: 'https://data.bls.gov/timeseries/CUUR0000SEHA',
        accessed: ACCESSED,
      },
      {
        title: 'HUD — Fair Market Rents by metro area',
        url: 'https://www.huduser.gov/portal/datasets/fmr.html',
        accessed: ACCESSED,
      },
      {
        title: 'Apartment List — Rent Estimates by City',
        url: 'https://www.apartmentlist.com/research/category/data-rent-estimates',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'BLS — Consumer Price Index, Food at Home (CUSR0000SAF11)',
        url: 'https://data.bls.gov/timeseries/CUSR0000SAF11',
        accessed: ACCESSED,
      },
      {
        title: 'USDA — Food Prices Database',
        url: 'https://www.ers.usda.gov/data-products/food-prices-and-spending/',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'EIA — Average Retail Price of Electricity to Residential Sector',
        url: 'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a',
        accessed: ACCESSED,
      },
      {
        title: 'EIA — Natural Gas Residential Price (state-level)',
        url: 'https://www.eia.gov/dnav/ng/ng_pri_sum_dcu_nus_m.htm',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'CMS — National Health Expenditure Data',
        url: 'https://www.cms.gov/data-research/statistics-trends-and-reports/national-health-expenditure-data',
        accessed: ACCESSED,
      },
      {
        title: 'CMS — Medicare Premiums and Coinsurance',
        url: 'https://www.cms.gov/medicare/payment/cost-sharing',
        accessed: ACCESSED,
      },
    ],
    medicine: [
      {
        title: 'CMS — Medicare Part D Drug Spending Dashboard',
        url: 'https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-medicaid-statistical-supplement/drug-spending',
        accessed: ACCESSED,
      },
      {
        title: 'GoodRx — Prescription price database',
        url: 'https://www.goodrx.com/',
        accessed: '2026-04-22',
      },
    ],
    medicalOOP: [
      {
        title: 'CMS — Medicare Out-of-Pocket Maximums (Part C / D / Medigap)',
        url: 'https://www.cms.gov/Medicare/Coverage/CenterforMedicareandMedicaidInnovation',
        accessed: ACCESSED,
      },
    ],
    transportation: [
      {
        title: 'BLS — Consumer Price Index, Transportation',
        url: 'https://www.bls.gov/cpi/factsheets/transportation.htm',
        accessed: ACCESSED,
      },
      {
        title: 'EIA — Gasoline and Diesel Fuel Update',
        url: 'https://www.eia.gov/petroleum/gasdiesel/',
        accessed: ACCESSED,
      },
    ],
    clothing: [
      {
        title: 'BLS — Consumer Price Index, Apparel',
        url: 'https://www.bls.gov/cpi/factsheets/apparel.htm',
        accessed: ACCESSED,
      },
    ],
    phoneCell: [
      {
        title: 'BLS — CPI Wireless Telephone Services (CUUR0000SEEE03)',
        url: 'https://data.bls.gov/timeseries/CUUR0000SEEE03',
        accessed: ACCESSED,
      },
      {
        title: 'FCC — Communications Marketplace Report (mobile prices)',
        url: 'https://www.fcc.gov/communications-marketplace-report',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── France ───────────────────────────────────────────────────────
  France: {
    rent: [
      {
        title: 'INSEE — Indice de référence des loyers (IRL)',
        url: 'https://www.insee.fr/fr/statistiques/serie/001515333',
        accessed: ACCESSED,
      },
      {
        title: 'Service-Public.fr — Plafonds de loyer en zones tendues',
        url: 'https://www.service-public.fr/particuliers/vosdroits/F1314',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INSEE — Indice des prix à la consommation (alimentation)',
        url: 'https://www.insee.fr/fr/statistiques/serie/001763852',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'CRE — Commission de régulation de l\'énergie (tarifs)',
        url: 'https://www.cre.fr/',
        accessed: ACCESSED,
      },
      {
        title: 'INSEE — Prix de l\'énergie',
        url: 'https://www.insee.fr/fr/statistiques?theme=83',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'Ameli.fr — Tarifs et remboursements de l\'Assurance Maladie',
        url: 'https://www.ameli.fr/assure/remboursements',
        accessed: ACCESSED,
      },
      {
        title: 'DREES — Comptes de la santé',
        url: 'https://drees.solidarites-sante.gouv.fr/sources-outils-et-enquetes/comptes-de-la-sante',
        accessed: ACCESSED,
      },
    ],
    medicine: [
      {
        title: 'Ameli.fr — Remboursement des médicaments',
        url: 'https://www.ameli.fr/assure/remboursements/rembourse/medicament-vaccin/medicament',
        accessed: ACCESSED,
      },
    ],
    transportation: [
      {
        title: 'INSEE — Prix des carburants',
        url: 'https://www.insee.fr/fr/statistiques/serie/010547237',
        accessed: ACCESSED,
      },
    ],
    phoneCell: [
      {
        title: 'ARCEP — Observatoire des marchés des communications électroniques',
        url: 'https://www.arcep.fr/cartes-et-donnees/nos-publications-chiffrees.html',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Spain ────────────────────────────────────────────────────────
  Spain: {
    rent: [
      {
        title: 'INE — Índice de Precios de la Vivienda (housing price index)',
        url: 'https://www.ine.es/dyngs/INEbase/en/operacion.htm?c=Estadistica_C&cid=1254736152838',
        accessed: ACCESSED,
      },
      {
        title: 'Idealista — Spanish rental price index by city',
        url: 'https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INE — Índice de Precios de Consumo (food)',
        url: 'https://www.ine.es/dyngs/INEbase/en/operacion.htm?c=Estadistica_C&cid=1254736176802',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'CNMC — Comisión Nacional de los Mercados y la Competencia (energy)',
        url: 'https://www.cnmc.es/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'Ministerio de Sanidad — Sistema Nacional de Salud',
        url: 'https://www.sanidad.gob.es/',
        accessed: ACCESSED,
      },
    ],
    phoneCell: [
      {
        title: 'CNMC — Telecomunicaciones, observatorio de tarifas',
        url: 'https://www.cnmc.es/ambitos-de-actuacion/telecomunicaciones',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Italy ────────────────────────────────────────────────────────
  Italy: {
    rent: [
      {
        title: 'ISTAT — Prezzi delle abitazioni (housing price index)',
        url: 'https://www.istat.it/it/prezzi/prezzi-immobili',
        accessed: ACCESSED,
      },
      {
        title: 'Idealista.it — Italian rental price index',
        url: 'https://www.idealista.it/sala-stampa/informes-precio-vivienda/alquiler/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'ISTAT — Indice dei prezzi al consumo (alimentari)',
        url: 'https://www.istat.it/it/prezzi/prezzi-al-consumo',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'ARERA — Autorità di Regolazione per Energia Reti e Ambiente',
        url: 'https://www.arera.it/it/dati/elenco_dati.htm',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'Ministero della Salute — SSN (Servizio Sanitario Nazionale)',
        url: 'https://www.salute.gov.it/',
        accessed: ACCESSED,
      },
    ],
    phoneCell: [
      {
        title: 'AGCOM — Osservatorio sulle Comunicazioni',
        url: 'https://www.agcom.it/osservatorio-sulle-comunicazioni',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Portugal ─────────────────────────────────────────────────────
  Portugal: {
    rent: [
      {
        title: 'INE — Estatísticas de Habitação (housing price index)',
        url: 'https://www.ine.pt/xportal/xmain?xpgid=ine_main&xpid=INE&xlang=en',
        accessed: ACCESSED,
      },
      {
        title: 'Idealista.pt — Portuguese rental price index',
        url: 'https://www.idealista.pt/sala-de-imprensa/relatorios-preco-habitacao/arrendamento/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INE — Índice de Preços no Consumidor (alimentares)',
        url: 'https://www.ine.pt/xportal/xmain?xpgid=ine_main&xpid=INE&xlang=en',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'ERSE — Entidade Reguladora dos Serviços Energéticos',
        url: 'https://www.erse.pt/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'SNS — Serviço Nacional de Saúde (PT)',
        url: 'https://www.sns.gov.pt/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Ireland ──────────────────────────────────────────────────────
  Ireland: {
    rent: [
      {
        title: 'CSO — Residential Property Price Index',
        url: 'https://www.cso.ie/en/statistics/prices/residentialpropertypriceindex/',
        accessed: ACCESSED,
      },
      {
        title: 'Daft.ie — Quarterly rental report',
        url: 'https://www.daft.ie/report',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'CSO — Consumer Price Index (food and non-alcoholic beverages)',
        url: 'https://www.cso.ie/en/statistics/prices/consumerpriceindex/',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'CRU — Commission for Regulation of Utilities',
        url: 'https://www.cru.ie/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'HSE — Health Service Executive (Ireland)',
        url: 'https://www.hse.ie/eng/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Greece ───────────────────────────────────────────────────────
  Greece: {
    rent: [
      {
        title: 'ELSTAT — Hellenic Statistical Authority, House Price Index',
        url: 'https://www.statistics.gr/en/statistics/-/publication/SCI11',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'ELSTAT — Consumer Price Index (food)',
        url: 'https://www.statistics.gr/en/statistics/-/publication/DKT87',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'RAE — Greek Regulatory Authority for Energy',
        url: 'https://www.rae.gr/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Cyprus ───────────────────────────────────────────────────────
  Cyprus: {
    rent: [
      {
        title: 'CyStat — Statistical Service of Cyprus, House Price Index',
        url: 'https://www.cystat.gov.cy/en/SubthemeStatistics?s=23',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'CyStat — Consumer Price Index',
        url: 'https://www.cystat.gov.cy/en/SubthemeStatistics?s=24',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'GeSY — Cyprus General Health System',
        url: 'https://www.gesy.org.cy/en-gb/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Malta ────────────────────────────────────────────────────────
  Malta: {
    rent: [
      {
        title: 'NSO — National Statistics Office Malta, Property Price Index',
        url: 'https://nso.gov.mt/themes_publications/property-prices-index/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'NSO — Harmonised Index of Consumer Prices (Malta)',
        url: 'https://nso.gov.mt/themes_publications/inflation/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'Mater Dei Hospital — Malta\'s acute general hospital',
        url: 'https://deputyprimeminister.gov.mt/en/Pages/health.aspx',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Croatia ──────────────────────────────────────────────────────
  Croatia: {
    rent: [
      {
        title: 'DZS — Croatian Bureau of Statistics, House Price Index',
        url: 'https://podaci.dzs.hr/en/statistics/prices-and-economic-situation/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'DZS — Consumer Price Index',
        url: 'https://podaci.dzs.hr/en/statistics/prices-and-economic-situation/cpi/',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'HERA — Croatian Energy Regulatory Agency',
        url: 'https://www.hera.hr/en/html/index.html',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Mexico ───────────────────────────────────────────────────────
  Mexico: {
    rent: [
      {
        title: 'INEGI — Índice Nacional de Precios al Consumidor (rent)',
        url: 'https://www.inegi.org.mx/temas/inpc/',
        accessed: ACCESSED,
      },
      {
        title: 'SHF — Sociedad Hipotecaria Federal house price index',
        url: 'https://www.gob.mx/shf/articulos/indice-shf-de-precios-de-la-vivienda',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INEGI — Índice Nacional de Precios al Consumidor (alimentos)',
        url: 'https://www.inegi.org.mx/temas/inpc/',
        accessed: ACCESSED,
      },
      {
        title: 'PROFECO — Quién es Quién en los Precios (consumer prices)',
        url: 'https://www.gob.mx/profeco/acciones-y-programas/quien-es-quien-en-los-precios',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'CFE — Comisión Federal de Electricidad (residential rates)',
        url: 'https://app.cfe.mx/aplicaciones/ccfe/tarifas/tarifas/tarifas_casa.asp',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'IMSS — Instituto Mexicano del Seguro Social',
        url: 'https://www.imss.gob.mx/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Costa Rica ──────────────────────────────────────────────────
  'Costa Rica': {
    rent: [
      {
        title: 'INEC — Instituto Nacional de Estadística y Censos (CR)',
        url: 'https://www.inec.cr/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INEC — Índice de Precios al Consumidor',
        url: 'https://www.inec.cr/economia/indice-de-precios-al-consumidor',
        accessed: ACCESSED,
      },
    ],
    utilities: [
      {
        title: 'ARESEP — Autoridad Reguladora de los Servicios Públicos',
        url: 'https://aresep.go.cr/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'CCSS — Caja Costarricense de Seguro Social',
        url: 'https://www.ccss.sa.cr/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Colombia ────────────────────────────────────────────────────
  Colombia: {
    rent: [
      {
        title: 'DANE — Departamento Administrativo Nacional de Estadística (rent index)',
        url: 'https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'DANE — Índice de Precios al Consumidor (alimentos)',
        url: 'https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'MinSalud — Ministerio de Salud y Protección Social (Colombia)',
        url: 'https://www.minsalud.gov.co/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Ecuador ─────────────────────────────────────────────────────
  Ecuador: {
    rent: [
      {
        title: 'INEC — Instituto Nacional de Estadística y Censos (Ecuador)',
        url: 'https://www.ecuadorencifras.gob.ec/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INEC — Índice de Precios al Consumidor',
        url: 'https://www.ecuadorencifras.gob.ec/indice-de-precios-al-consumidor/',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'IESS — Instituto Ecuatoriano de Seguridad Social',
        url: 'https://www.iess.gob.ec/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Panama ──────────────────────────────────────────────────────
  Panama: {
    rent: [
      {
        title: 'INEC — Instituto Nacional de Estadística y Censo de Panamá',
        url: 'https://www.inec.gob.pa/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INEC — Índice de Precios al Consumidor (Panamá)',
        url: 'https://www.inec.gob.pa/Default.aspx',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'CSS — Caja de Seguro Social (Panama)',
        url: 'https://www.css.gob.pa/',
        accessed: ACCESSED,
      },
    ],
  },

  // ─── Uruguay ─────────────────────────────────────────────────────
  Uruguay: {
    rent: [
      {
        title: 'INE — Instituto Nacional de Estadística (Uruguay)',
        url: 'https://www5.ine.gub.uy/',
        accessed: ACCESSED,
      },
    ],
    groceries: [
      {
        title: 'INE — Índice de Precios del Consumo',
        url: 'https://www5.ine.gub.uy/web/guest/ipc',
        accessed: ACCESSED,
      },
    ],
    healthcare: [
      {
        title: 'ASSE — Administración de los Servicios de Salud del Estado',
        url: 'https://www.asse.com.uy/',
        accessed: ACCESSED,
      },
    ],
  },
};

// ─── Lookup helper ────────────────────────────────────────────────────

/**
 * Returns merged source list: country-specific first-party sources
 * (when registered) followed by the global default sources for the
 * category.
 *
 * @param {string} category - MonthlyCosts category key
 * @param {string} [country] - LocationFull.country string
 * @returns {Source[] | undefined}
 */
export function costSourcesFor(category, country) {
  const global = CATEGORY_COST_SOURCES[category];
  if (country && COUNTRY_CATEGORY_COST_SOURCES[country]) {
    const countrySources = COUNTRY_CATEGORY_COST_SOURCES[country][category];
    if (countrySources && countrySources.length > 0) {
      // Country-specific first, then global supranational/aggregator sources.
      return global ? [...countrySources, ...global] : countrySources;
    }
  }
  return global;
}
