/**
 * Per-category structured citations for the cost-range values
 * (`monthlyCosts.<category>.typical` etc.) returned from the
 * locations endpoints. Each category maps to 1–3 authoritative
 * sources. Seed data doesn't carry these per-location; retirement-api
 * injects them at response time based on the category key.
 *
 * Keys match `MonthlyCosts` properties on the dashboard model.
 *
 * See Todos #11.
 */

/** @typedef {{title: string, url: string, accessed?: string}} Source */

/** @type {Record<string, Source[]>} */
export var CATEGORY_COST_SOURCES = {
  rent: [
    {
      title: 'Numbeo — Cost of Living (rent by city)',
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
      title: 'Numbeo — Grocery basket prices',
      url: 'https://www.numbeo.com/cost-of-living/',
      accessed: '2026-04-22',
    },
  ],
  utilities: [
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
      title: 'GoodRx — Prescription price database (US)',
      url: 'https://www.goodrx.com/',
      accessed: '2026-04-22',
    },
    {
      title: 'OECD — Pharmaceutical market / drug prices',
      url: 'https://www.oecd.org/health/pharmaceutical-market.htm',
      accessed: '2026-04-22',
    },
  ],
  medicalOOP: [
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

/** Lookup helper — returns `undefined` for unknown categories. */
export function costSourcesFor(category) {
  return CATEGORY_COST_SOURCES[category];
}
