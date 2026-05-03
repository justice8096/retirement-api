#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable US pros/cons bullets (Todo #38, follow-up to #19).
 *
 * Closes the US half of #19. Non-US country sweep shipped across
 * api PRs #96–#105 (14 countries, 50 cited bullets). US locations
 * were deferred because the citation patterns differ:
 *   - State-level Medicare/Medicaid + ACA marketplace + tax codes
 *     instead of national programs.
 *   - Each state needs its own DOR / Code reference.
 *
 * Strategy:
 *   1. Group cities by state, share one `Source` constant per
 *      (state, claim-type) so the citation library scales O(states)
 *      not O(cities).
 *   2. Cite only falsifiable claims — specific numbers, named
 *      programs, government documents, hospital systems with
 *      authoritative homepages or US News rankings.
 *   3. Skip subjective bullets ("growing food scene", "warm climate",
 *      "rich heritage") and bullets already pulled from structured
 *      fields (climate.winterLowF etc.).
 *
 * Idempotent: skips bullets already cited; re-runs are no-ops.
 *
 * Run: node scripts/add-us-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────
//
// Sources are grouped by (state, claim-type). Each Source object is
// reused across every city in that state's update list.

// ── State income tax DOR pages (rate range / structure) ──

const TX_NO_INCOME_TAX = {
  title: 'Texas Comptroller of Public Accounts — No state income tax',
  url: 'https://comptroller.texas.gov/taxes/',
  accessed: ACCESSED,
};

const FL_NO_INCOME_TAX = {
  title: 'Florida Department of Revenue — No state personal income tax',
  url: 'https://floridarevenue.com/taxes/taxesfees/Pages/personal_income.aspx',
  accessed: ACCESSED,
};

const TN_NO_INCOME_TAX = {
  title: 'Tennessee Department of Revenue — Hall income tax repealed Jan 1, 2021',
  url: 'https://www.tn.gov/revenue/taxes/hall-income-tax.html',
  accessed: ACCESSED,
};

const GA_INCOME_TAX = {
  title: 'Georgia Department of Revenue — Individual Income Tax (HB 1437 / HB 1015 flat-rate transition)',
  url: 'https://dor.georgia.gov/taxes/individual-taxes',
  accessed: ACCESSED,
};

const GA_RETIREMENT_EXCLUSION = {
  title: 'Georgia DOR — Retirement Income Exclusion (O.C.G.A. § 48-7-27)',
  url: 'https://dor.georgia.gov/individual-income-tax-retirement-income-exclusion',
  accessed: ACCESSED,
};

const VA_INCOME_TAX = {
  title: 'Virginia Department of Taxation — Individual Income Tax brackets (2-5.75%)',
  url: 'https://www.tax.virginia.gov/income-tax-calculator',
  accessed: ACCESSED,
};

const VA_SS_EXEMPT = {
  title: 'Virginia DOT — Social Security and Tier 1 Railroad Retirement subtractions',
  url: 'https://www.tax.virginia.gov/subtractions',
  accessed: ACCESSED,
};

const VA_AGE_DEDUCTION = {
  title: 'Virginia DOT — Age Deduction for taxpayers 65+',
  url: 'https://www.tax.virginia.gov/deductions',
  accessed: ACCESSED,
};

const MD_INCOME_TAX = {
  title: 'Comptroller of Maryland — Individual Income Tax brackets (2-5.75% state) + county',
  url: 'https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php',
  accessed: ACCESSED,
};

const MD_PENSION_EXCLUSION = {
  title: 'Comptroller of Maryland — Pension Exclusion (Worksheet 13A) and SS exemption',
  url: 'https://www.marylandtaxes.gov/individual/income/tax-info/pension-exclusion.php',
  accessed: ACCESSED,
};

const PA_INCOME_TAX = {
  title: 'Pennsylvania Department of Revenue — PIT flat 3.07%',
  url: 'https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx',
  accessed: ACCESSED,
};

const PA_RETIREMENT_EXEMPT = {
  title: 'PA DOR — Retirement income (SS, IRA, qualified pension) not taxable for PIT',
  url: 'https://www.revenue.pa.gov/FormsandPublications/PAPersonalIncomeTaxGuide/Pages/Gross-Compensation.aspx',
  accessed: ACCESSED,
};

const PHILA_WAGE_TAX = {
  title: 'City of Philadelphia Department of Revenue — Wage Tax (3.75% resident, 3.44% nonresident, FY 2025)',
  url: 'https://www.phila.gov/services/payments-assistance-taxes/income-taxes/wage-tax-employers/',
  accessed: ACCESSED,
};

const PHILA_SALES_TAX = {
  title: 'PA DOR — Sales tax (6% state + 2% Philadelphia local = 8% combined)',
  url: 'https://www.revenue.pa.gov/TaxTypes/SUT/Pages/default.aspx',
  accessed: ACCESSED,
};

const NJ_SS_EXEMPT = {
  title: 'NJ Division of Taxation — Social Security exempt; pension/retirement income exclusion',
  url: 'https://www.nj.gov/treasury/taxation/njit6.shtml',
  accessed: ACCESSED,
};

const NJ_INCOME_TAX = {
  title: 'NJ Division of Taxation — Gross Income Tax brackets (1.4%-10.75%)',
  url: 'https://www.nj.gov/treasury/taxation/taxtables.shtml',
  accessed: ACCESSED,
};

const NJ_GROCERIES_CLOTHING = {
  title: 'NJ DOT — Sales tax exemptions (groceries / most clothing exempt)',
  url: 'https://www.nj.gov/treasury/taxation/su.shtml',
  accessed: ACCESSED,
};

const NY_SS_EXEMPT = {
  title: 'NY State Department of Taxation and Finance — Social Security exempt; up to $20K pension/IRA exclusion (age 59½+)',
  url: 'https://www.tax.ny.gov/pit/file/pension_and_annuity.htm',
  accessed: ACCESSED,
};

const NY_EPIC = {
  title: 'NY State Office for the Aging — EPIC (Elderly Pharmaceutical Insurance Coverage)',
  url: 'https://www.health.ny.gov/health_care/epic/',
  accessed: ACCESSED,
};

const NC_NO_SS_TAX = {
  title: 'NC Department of Revenue — Social Security not taxable; flat individual income tax rate',
  url: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
  accessed: ACCESSED,
};

const SC_SS_EXEMPT = {
  title: 'SC Department of Revenue — Social Security exempt; retirement income deductions',
  url: 'https://dor.sc.gov/tax/individual-income/retirement',
  accessed: ACCESSED,
};

const SC_INCOME_TAX = {
  title: 'SC DOR — Individual Income Tax (top bracket 6.2-6.5% during 2024-2026 phase-down)',
  url: 'https://dor.sc.gov/tax/individual-income',
  accessed: ACCESSED,
};

const SC_GROCERY_EXEMPT = {
  title: 'SC DOR — Unprepared food exempt from state sales tax (local option may apply)',
  url: 'https://dor.sc.gov/tax/sales',
  accessed: ACCESSED,
};

const WI_INCOME_TAX = {
  title: 'WI Department of Revenue — Individual Income Tax brackets (3.50-7.65%)',
  url: 'https://www.revenue.wi.gov/Pages/Individuals/home.aspx',
  accessed: ACCESSED,
};

const MN_INCOME_TAX = {
  title: 'MN Department of Revenue — Individual Income Tax brackets (5.35-9.85%)',
  url: 'https://www.revenue.state.mn.us/individual-income-tax',
  accessed: ACCESSED,
};

const MN_SS_PARTIAL = {
  title: 'MN DOR — Social Security Subtraction (partial; phase-out by AGI)',
  url: 'https://www.revenue.state.mn.us/social-security-benefit-subtraction',
  accessed: ACCESSED,
};

const IN_INCOME_TAX = {
  title: 'IN Department of Revenue — Individual Income Tax flat rate (3.05% TY2024, scheduled to 3.0% TY2025) plus county',
  url: 'https://www.in.gov/dor/individual-income-taxes/',
  accessed: ACCESSED,
};

const MI_INCOME_TAX = {
  title: 'MI Department of Treasury — Individual Income Tax flat 4.25%',
  url: 'https://www.michigan.gov/taxes/iit',
  accessed: ACCESSED,
};

// ── Major hospital systems ──

const CLEVELAND_CLINIC = {
  title: 'Cleveland Clinic — main campus, Cleveland OH',
  url: 'https://my.clevelandclinic.org/',
  accessed: ACCESSED,
};

const CLEVELAND_CLINIC_USNEWS = {
  title: 'US News & World Report — Best Hospitals Honor Roll (Cleveland Clinic)',
  url: 'https://health.usnews.com/best-hospitals/area/oh/cleveland-clinic-6410670',
  accessed: ACCESSED,
};

const JOHNS_HOPKINS = {
  title: 'Johns Hopkins Hospital — Baltimore, MD',
  url: 'https://www.hopkinsmedicine.org/the_johns_hopkins_hospital/',
  accessed: ACCESSED,
};

const JOHNS_HOPKINS_USNEWS = {
  title: 'US News & World Report — Best Hospitals Honor Roll (Johns Hopkins)',
  url: 'https://health.usnews.com/best-hospitals/area/md/the-johns-hopkins-hospital-6320180',
  accessed: ACCESSED,
};

const UPMC = {
  title: 'UPMC (University of Pittsburgh Medical Center)',
  url: 'https://www.upmc.com/',
  accessed: ACCESSED,
};

const PENN_MEDICINE = {
  title: 'Penn Medicine — Hospital of the University of Pennsylvania',
  url: 'https://www.pennmedicine.org/',
  accessed: ACCESSED,
};

const JEFFERSON = {
  title: 'Thomas Jefferson University Hospitals',
  url: 'https://www.jeffersonhealth.org/',
  accessed: ACCESSED,
};

const TEMPLE = {
  title: 'Temple University Hospital',
  url: 'https://www.templehealth.org/locations/temple-university-hospital',
  accessed: ACCESSED,
};

const DUKE = {
  title: 'Duke University Hospital — Durham, NC',
  url: 'https://www.dukehealth.org/hospitals/duke-university-hospital',
  accessed: ACCESSED,
};

const UNC = {
  title: 'UNC Health — UNC Medical Center, Chapel Hill',
  url: 'https://www.uncmedicalcenter.org/',
  accessed: ACCESSED,
};

const EMORY = {
  title: 'Emory Healthcare — Emory University Hospital, Atlanta',
  url: 'https://www.emoryhealthcare.org/',
  accessed: ACCESSED,
};

const NYU_LANGONE = {
  title: 'NYU Langone Health',
  url: 'https://nyulangone.org/',
  accessed: ACCESSED,
};

const MOUNT_SINAI = {
  title: 'Mount Sinai Health System',
  url: 'https://www.mountsinai.org/',
  accessed: ACCESSED,
};

const MSK = {
  title: 'Memorial Sloan Kettering Cancer Center',
  url: 'https://www.mskcc.org/',
  accessed: ACCESSED,
};

const UAB = {
  title: 'UAB Medicine — University of Alabama at Birmingham',
  url: 'https://www.uabmedicine.org/',
  accessed: ACCESSED,
};

const COOPER = {
  title: 'Cooper University Health Care — Camden, NJ (Level 1 Trauma Center)',
  url: 'https://www.cooperhealth.org/',
  accessed: ACCESSED,
};

const INOVA = {
  title: 'Inova Health System — Northern Virginia',
  url: 'https://www.inova.org/',
  accessed: ACCESSED,
};

const MUSC = {
  title: 'Medical University of South Carolina (MUSC) Health',
  url: 'https://muschealth.org/',
  accessed: ACCESSED,
};

const MAYO = {
  title: 'Mayo Clinic — Rochester, MN (and Twin Cities campuses)',
  url: 'https://www.mayoclinic.org/',
  accessed: ACCESSED,
};

const UM_MEDICINE = {
  title: 'University of Maryland Medical System',
  url: 'https://www.umms.org/',
  accessed: ACCESSED,
};

// ── Transit / programs / climate / specific facts ──

const HARTSFIELD_ACI = {
  title: 'Airports Council International — World Airport Traffic Rankings (Hartsfield-Jackson ATL: world’s busiest by passenger traffic, multiple years)',
  url: 'https://aci.aero/data-centre/annual-traffic-data/passengers/',
  accessed: ACCESSED,
};

const MARTA_OFFICIAL = {
  title: 'Metropolitan Atlanta Rapid Transit Authority (MARTA) — Rail and bus operations',
  url: 'https://www.itsmarta.com/',
  accessed: ACCESSED,
};

const SEPTA_OFFICIAL = {
  title: 'SEPTA (Southeastern Pennsylvania Transportation Authority) — Multimodal Philadelphia transit',
  url: 'https://www.septa.org/',
  accessed: ACCESSED,
};

const PATCO_OFFICIAL = {
  title: 'PATCO Speedline — Camden NJ ↔ Center City Philadelphia rapid transit',
  url: 'https://www.ridepatco.org/',
  accessed: ACCESSED,
};

const VRE_OFFICIAL = {
  title: 'Virginia Railway Express (VRE) — Manassas and Fredericksburg lines to Washington DC',
  url: 'https://www.vre.org/',
  accessed: ACCESSED,
};

const MARC_OFFICIAL = {
  title: 'Maryland Area Regional Commuter (MARC) Train — MTA Maryland Penn / Camden / Brunswick lines',
  url: 'https://www.mta.maryland.gov/marc-train',
  accessed: ACCESSED,
};

const ABQ_SUN_NOAA = {
  title: 'NOAA NCEI — Albuquerque NM climate normals (~278 days with measurable sunshine; ~310 days without measurable precipitation)',
  url: 'https://www.weather.gov/abq/climate',
  accessed: ACCESSED,
};

const STPETE_SUN_NOAA = {
  title: 'NOAA NCEI — St. Petersburg FL climate normals (Guinness record 1967-1969 for 768 consecutive sunny days; ~360+ days/yr historic claim)',
  url: 'https://www.weather.gov/tbw/Climate',
  accessed: ACCESSED,
};

const DENVER_SUN_NOAA = {
  title: 'NOAA NWS — Denver CO climate normals (~245 sunny days; ~300 days with at least some sunshine)',
  url: 'https://www.weather.gov/bou/Denver',
  accessed: ACCESSED,
};

const ST_AUGUSTINE_NPS = {
  title: 'National Park Service — Castillo de San Marcos / St. Augustine founded 1565 (oldest continuously occupied European settlement in the contiguous US)',
  url: 'https://www.nps.gov/casa/learn/historyculture/index.htm',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────
//
// Each entry: city / pros|cons / exact match string / replacement.
// Replacement keeps the original text verbatim unless we're correcting
// a fact (rare). The script refuses to apply if `match` doesn't equal
// the bullet text byte-for-byte (after .text extraction for object-
// shaped bullets).

const UPDATES = [
  // ─── Atlanta GA ────────────────────────────────────────────────
  {
    city: 'us-atlanta',
    field: 'pros',
    match: 'Major metro with world-class healthcare (Emory, CDC)',
    replacement: { text: 'Major metro with world-class healthcare (Emory, CDC)', sources: [EMORY] },
  },
  {
    city: 'us-atlanta',
    field: 'pros',
    match: 'MARTA rail and bus transit system',
    replacement: { text: 'MARTA rail and bus transit system', sources: [MARTA_OFFICIAL] },
  },
  {
    city: 'us-atlanta',
    field: 'pros',
    match: 'Hartsfield-Jackson International Airport — busiest in the world',
    replacement: {
      text: 'Hartsfield-Jackson International Airport — busiest in the world (ACI passenger rankings)',
      sources: [HARTSFIELD_ACI],
    },
  },
  {
    city: 'us-atlanta',
    field: 'pros',
    match: 'No state income tax on first $65K retirement income per person',
    replacement: {
      text: 'No state income tax on first $65K retirement income per person (GA Retirement Income Exclusion, O.C.G.A. § 48-7-27)',
      sources: [GA_RETIREMENT_EXCLUSION],
    },
  },
  {
    city: 'us-atlanta',
    field: 'cons',
    match: 'Georgia state income tax (1-5.49%)',
    replacement: {
      text: 'Georgia state income tax (HB 1437/1015 transition to 5.39% flat in 2024 from prior 1–5.75% bracketed schedule)',
      sources: [GA_INCOME_TAX],
    },
  },

  // ─── Savannah GA ───────────────────────────────────────────────
  {
    city: 'us-savannah',
    field: 'cons',
    match: 'GA state income tax',
    replacement: { text: 'GA state income tax (5.39% flat as of 2024, HB 1015)', sources: [GA_INCOME_TAX] },
  },

  // ─── Austin TX ─────────────────────────────────────────────────
  {
    city: 'us-austin',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [TX_NO_INCOME_TAX] },
  },

  // ─── Dallas TX ─────────────────────────────────────────────────
  {
    city: 'us-dallas-tx',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [TX_NO_INCOME_TAX] },
  },

  // ─── Fort Worth TX ─────────────────────────────────────────────
  {
    city: 'us-fort-worth-tx',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [TX_NO_INCOME_TAX] },
  },

  // ─── Killeen TX ────────────────────────────────────────────────
  {
    city: 'us-killeen-tx',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [TX_NO_INCOME_TAX] },
  },

  // ─── San Marcos TX ─────────────────────────────────────────────
  {
    city: 'us-san-marcos-tx',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [TX_NO_INCOME_TAX] },
  },

  // ─── Florida (statewide) ───────────────────────────────────────
  {
    city: 'us-florida',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Miami FL ──────────────────────────────────────────────────
  {
    city: 'us-miami-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Fort Lauderdale FL ────────────────────────────────────────
  {
    city: 'us-fort-lauderdale-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Tampa FL ──────────────────────────────────────────────────
  {
    city: 'us-tampa-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── St. Petersburg FL ─────────────────────────────────────────
  {
    city: 'us-st-petersburg-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },
  {
    city: 'us-st-petersburg-fl',
    field: 'pros',
    // NOTE: source bullet has a mojibake "—" (U+00E2 U+20AC U+201D from a
    // bad UTF-8/Win-1252 round-trip); replacement normalizes it to U+2014.
    match: 'Sunshine City â€” 361 days of sun average',
    replacement: {
      text: 'Sunshine City — 361 days of sun average (Guinness 1967–1969 record holder, ongoing high-sun reputation)',
      sources: [STPETE_SUN_NOAA],
    },
  },

  // ─── St. Augustine FL ──────────────────────────────────────────
  {
    city: 'us-st-augustine-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },
  {
    city: 'us-st-augustine-fl',
    field: 'pros',
    match: 'Oldest city in US with rich history',
    replacement: {
      text: 'Oldest continuously occupied European settlement in the contiguous US (founded 1565)',
      sources: [ST_AUGUSTINE_NPS],
    },
  },

  // ─── Palm Bay FL ───────────────────────────────────────────────
  {
    city: 'us-palm-bay-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Quincy FL ─────────────────────────────────────────────────
  {
    city: 'us-quincy-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Yulee FL ──────────────────────────────────────────────────
  {
    city: 'us-yulee-fl',
    field: 'pros',
    match: 'No state income tax',
    replacement: { text: 'No state income tax', sources: [FL_NO_INCOME_TAX] },
  },

  // ─── Nashville TN ──────────────────────────────────────────────
  {
    city: 'us-nashville-tn',
    field: 'pros',
    match: 'No state income tax',
    replacement: {
      text: 'No state income tax (Hall income tax on dividends repealed Jan 1, 2021)',
      sources: [TN_NO_INCOME_TAX],
    },
  },

  // ─── Baltimore MD ──────────────────────────────────────────────
  {
    city: 'us-baltimore-md',
    field: 'pros',
    // NOTE: source bullet has mojibake "—"; replacement normalizes to U+2014.
    match: 'Johns Hopkins â€” world-class healthcare',
    replacement: {
      text: 'Johns Hopkins — world-class healthcare',
      sources: [JOHNS_HOPKINS, JOHNS_HOPKINS_USNEWS],
    },
  },
  {
    city: 'us-baltimore-md',
    field: 'cons',
    match: 'MD state income tax (2-5.75%) plus county tax',
    replacement: { text: 'MD state income tax (2-5.75%) plus county tax', sources: [MD_INCOME_TAX] },
  },

  // ─── Annapolis MD ──────────────────────────────────────────────
  {
    city: 'us-annapolis-md',
    field: 'pros',
    match: 'SS and partial pension tax-exempt in MD',
    replacement: { text: 'SS and partial pension tax-exempt in MD', sources: [MD_PENSION_EXCLUSION] },
  },
  {
    city: 'us-annapolis-md',
    field: 'pros',
    match: 'Access to Johns Hopkins / Univ of MD specialists',
    replacement: {
      text: 'Access to Johns Hopkins / Univ of MD specialists',
      sources: [JOHNS_HOPKINS, UM_MEDICINE],
    },
  },

  // ─── Bowie MD ──────────────────────────────────────────────────
  {
    city: 'us-bowie-md',
    field: 'pros',
    match: 'Maryland tax benefits: Social Security exempt, pension exclusion, no vehicle personal property tax',
    replacement: {
      text: 'Maryland tax benefits: Social Security exempt, pension exclusion, no vehicle personal property tax',
      sources: [MD_PENSION_EXCLUSION],
    },
  },
  {
    city: 'us-bowie-md',
    field: 'pros',
    match: 'MARC (Maryland Area Regional Commuter) Penn Line commuter rail to DC (~40 min)',
    replacement: {
      text: 'MARC (Maryland Area Regional Commuter) Penn Line commuter rail to DC (~40 min)',
      sources: [MARC_OFFICIAL],
    },
  },
  {
    city: 'us-bowie-md',
    field: 'pros',
    match: 'Johns Hopkins + Univ of MD specialist access within 30 min',
    replacement: {
      text: 'Johns Hopkins + Univ of MD specialist access within 30 min',
      sources: [JOHNS_HOPKINS, UM_MEDICINE],
    },
  },

  // ─── Catonsville MD ────────────────────────────────────────────
  {
    city: 'us-catonsville-md',
    field: 'pros',
    match: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle property tax',
    replacement: {
      text: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle property tax',
      sources: [MD_PENSION_EXCLUSION],
    },
  },
  {
    city: 'us-catonsville-md',
    field: 'pros',
    match: 'World-class healthcare (St. Agnes in town, Johns Hopkins + UM 15 min)',
    replacement: {
      text: 'World-class healthcare (St. Agnes in town, Johns Hopkins + UM 15 min)',
      sources: [JOHNS_HOPKINS, UM_MEDICINE],
    },
  },

  // ─── Elkridge MD ───────────────────────────────────────────────
  {
    city: 'us-elkridge-md',
    field: 'pros',
    match: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle personal property tax',
    replacement: {
      text: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle personal property tax',
      sources: [MD_PENSION_EXCLUSION],
    },
  },
  {
    city: 'us-elkridge-md',
    field: 'pros',
    match: 'Exceptional healthcare access (Johns Hopkins + UM within 20 min)',
    replacement: {
      text: 'Exceptional healthcare access (Johns Hopkins + UM within 20 min)',
      sources: [JOHNS_HOPKINS, UM_MEDICINE],
    },
  },

  // ─── Glen Burnie MD ────────────────────────────────────────────
  {
    city: 'us-glen-burnie-md',
    field: 'pros',
    match: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle tax',
    replacement: {
      text: 'MD tax benefits: Social Security exempt, pension exclusion, no vehicle tax',
      sources: [MD_PENSION_EXCLUSION],
    },
  },

  // ─── Philadelphia PA ───────────────────────────────────────────
  {
    city: 'us-philadelphia',
    field: 'pros',
    match: 'World-class healthcare (Penn, Jefferson, Temple)',
    replacement: {
      text: 'World-class healthcare (Penn, Jefferson, Temple)',
      sources: [PENN_MEDICINE, JEFFERSON, TEMPLE],
    },
  },
  {
    city: 'us-philadelphia',
    field: 'pros',
    match: 'PA exempts SS and retirement income from state tax',
    replacement: {
      text: 'PA exempts SS and retirement income from state tax',
      sources: [PA_RETIREMENT_EXEMPT],
    },
  },
  {
    city: 'us-philadelphia',
    field: 'pros',
    match: 'Excellent public transit (SEPTA + Amtrak hub)',
    replacement: { text: 'Excellent public transit (SEPTA + Amtrak hub)', sources: [SEPTA_OFFICIAL] },
  },
  {
    city: 'us-philadelphia',
    field: 'cons',
    match: 'Philadelphia city wage tax (3.75%)',
    replacement: { text: 'Philadelphia city wage tax (3.75% resident, FY 2025)', sources: [PHILA_WAGE_TAX] },
  },
  {
    city: 'us-philadelphia',
    field: 'cons',
    match: 'High sales tax (8%)',
    replacement: {
      text: 'High sales tax (8% — 6% PA state + 2% Philadelphia local)',
      sources: [PHILA_SALES_TAX],
    },
  },

  // ─── Pittsburgh PA ─────────────────────────────────────────────
  {
    city: 'us-pittsburgh-pa',
    field: 'pros',
    match: 'World-class healthcare (UPMC)',
    replacement: { text: 'World-class healthcare (UPMC)', sources: [UPMC] },
  },
  {
    city: 'us-pittsburgh-pa',
    field: 'cons',
    match: 'PA state income tax (3.07%) plus local taxes',
    replacement: { text: 'PA state income tax (3.07%) plus local taxes', sources: [PA_INCOME_TAX] },
  },

  // ─── Williamsport PA ───────────────────────────────────────────
  {
    city: 'us-williamsport-pa',
    field: 'cons',
    match: 'PA state income tax plus local taxes',
    replacement: { text: 'PA state income tax (3.07% flat) plus local taxes', sources: [PA_INCOME_TAX] },
  },

  // ─── Camden NJ ─────────────────────────────────────────────────
  {
    city: 'us-camden-nj',
    field: 'pros',
    match: 'PATCO light rail to Philadelphia available',
    replacement: { text: 'PATCO light rail to Philadelphia available', sources: [PATCO_OFFICIAL] },
  },
  {
    city: 'us-camden-nj',
    field: 'pros',
    match: 'NJ exempts SS from state tax',
    replacement: { text: 'NJ exempts SS from state tax', sources: [NJ_SS_EXEMPT] },
  },
  {
    city: 'us-camden-nj',
    field: 'pros',
    match: 'No sales tax on groceries or clothing',
    replacement: { text: 'No sales tax on groceries or clothing', sources: [NJ_GROCERIES_CLOTHING] },
  },
  {
    city: 'us-camden-nj',
    field: 'pros',
    match: 'Cooper University Hospital — major Level 1 trauma center',
    replacement: {
      text: 'Cooper University Hospital — major Level 1 trauma center',
      sources: [COOPER],
    },
  },

  // ─── Cherry Hill NJ ────────────────────────────────────────────
  {
    city: 'us-cherry-hill',
    field: 'pros',
    match: 'Quiet suburb with access to Philly via PATCO',
    replacement: { text: 'Quiet suburb with access to Philly via PATCO', sources: [PATCO_OFFICIAL] },
  },
  {
    city: 'us-cherry-hill',
    field: 'pros',
    match: 'NJ exempts SS from state tax',
    replacement: { text: 'NJ exempts SS from state tax', sources: [NJ_SS_EXEMPT] },
  },
  {
    city: 'us-cherry-hill',
    field: 'pros',
    match: 'No sales tax on groceries or clothing',
    replacement: { text: 'No sales tax on groceries or clothing', sources: [NJ_GROCERIES_CLOTHING] },
  },
  {
    city: 'us-cherry-hill',
    field: 'pros',
    match: 'Access to Philly healthcare (Penn, Jefferson)',
    replacement: {
      text: 'Access to Philly healthcare (Penn, Jefferson)',
      sources: [PENN_MEDICINE, JEFFERSON],
    },
  },
  {
    city: 'us-cherry-hill',
    field: 'cons',
    match: 'Higher NJ state income tax rates',
    replacement: { text: 'Higher NJ state income tax rates (1.4-10.75% bracket)', sources: [NJ_INCOME_TAX] },
  },

  // ─── Virginia (Fairfax) ────────────────────────────────────────
  {
    city: 'us-virginia',
    field: 'pros',
    match: 'World-class healthcare (Inova system)',
    replacement: { text: 'World-class healthcare (Inova system)', sources: [INOVA] },
  },
  {
    city: 'us-virginia',
    field: 'pros',
    match: 'SS tax exempt in VA',
    replacement: { text: 'SS tax exempt in VA', sources: [VA_SS_EXEMPT] },
  },

  // ─── Annandale VA ──────────────────────────────────────────────
  {
    city: 'us-annandale-va',
    field: 'pros',
    match: 'Same Fairfax County tax treatment (Social Security exempt, retiree deductions)',
    replacement: {
      text: 'Same Fairfax County tax treatment (Social Security exempt, retiree deductions)',
      sources: [VA_SS_EXEMPT, VA_AGE_DEDUCTION],
    },
  },
  {
    city: 'us-annandale-va',
    field: 'pros',
    match: 'Same world-class healthcare (Inova)',
    replacement: { text: 'Same world-class healthcare (Inova)', sources: [INOVA] },
  },

  // ─── Gainesville VA ────────────────────────────────────────────
  {
    city: 'us-gainesville-va',
    field: 'pros',
    match: 'Same VA tax treatment (SS exempt, retiree deductions)',
    replacement: {
      text: 'Same VA tax treatment (SS exempt, retiree deductions)',
      sources: [VA_SS_EXEMPT, VA_AGE_DEDUCTION],
    },
  },
  {
    city: 'us-gainesville-va',
    field: 'pros',
    match: 'VRE commuter rail to DC available',
    replacement: { text: 'VRE commuter rail to DC available', sources: [VRE_OFFICIAL] },
  },

  // ─── Lorton VA ─────────────────────────────────────────────────
  {
    city: 'us-lorton-va',
    field: 'pros',
    match: 'Same Fairfax County tax benefits (Social Security exempt, 65+ deduction)',
    replacement: {
      text: 'Same Fairfax County tax benefits (Social Security exempt, 65+ deduction)',
      sources: [VA_SS_EXEMPT, VA_AGE_DEDUCTION],
    },
  },
  {
    city: 'us-lorton-va',
    field: 'pros',
    match: 'VRE (Virginia Railway Express) commuter rail to DC available',
    replacement: {
      text: 'VRE (Virginia Railway Express) commuter rail to DC available',
      sources: [VRE_OFFICIAL],
    },
  },

  // ─── Manassas VA ───────────────────────────────────────────────
  {
    city: 'us-manassas-va',
    field: 'pros',
    match: 'Same VA tax treatment (Social Security exempt, 65+ deduction)',
    replacement: {
      text: 'Same VA tax treatment (Social Security exempt, 65+ deduction)',
      sources: [VA_SS_EXEMPT, VA_AGE_DEDUCTION],
    },
  },
  {
    city: 'us-manassas-va',
    field: 'pros',
    match: 'VRE (Virginia Railway Express) Manassas line to DC',
    replacement: {
      text: 'VRE (Virginia Railway Express) Manassas line to DC',
      sources: [VRE_OFFICIAL],
    },
  },

  // ─── Chesapeake VA ─────────────────────────────────────────────
  {
    city: 'us-chesapeake-va',
    field: 'pros',
    match: 'SS fully exempt from VA state income tax',
    replacement: { text: 'SS fully exempt from VA state income tax', sources: [VA_SS_EXEMPT] },
  },
  {
    city: 'us-chesapeake-va',
    field: 'cons',
    match: 'VA state income tax (2-5.75%)',
    replacement: { text: 'VA state income tax (2-5.75%)', sources: [VA_INCOME_TAX] },
  },

  // ─── Norfolk VA ────────────────────────────────────────────────
  {
    city: 'us-norfolk-va',
    field: 'cons',
    match: 'VA state income tax (2-5.75%)',
    replacement: { text: 'VA state income tax (2-5.75%)', sources: [VA_INCOME_TAX] },
  },

  // ─── Virginia Beach VA ─────────────────────────────────────────
  {
    city: 'us-virginia-beach-va',
    field: 'cons',
    match: 'VA state income tax (2-5.75%)',
    replacement: { text: 'VA state income tax (2-5.75%)', sources: [VA_INCOME_TAX] },
  },

  // ─── Richmond VA ───────────────────────────────────────────────
  {
    city: 'us-richmond',
    field: 'pros',
    match: 'VA age deduction + SS tax exempt',
    replacement: {
      text: 'VA age deduction + SS tax exempt',
      sources: [VA_SS_EXEMPT, VA_AGE_DEDUCTION],
    },
  },

  // ─── New York City NY ──────────────────────────────────────────
  {
    city: 'us-new-york-city',
    field: 'pros',
    match: 'World-class healthcare (NYU Langone, Mount Sinai, MSK)',
    replacement: {
      text: 'World-class healthcare (NYU Langone, Mount Sinai, MSK)',
      sources: [NYU_LANGONE, MOUNT_SINAI, MSK],
    },
  },
  {
    city: 'us-new-york-city',
    field: 'pros',
    match: 'SS tax exempt in NY',
    replacement: { text: 'SS tax exempt in NY', sources: [NY_SS_EXEMPT] },
  },
  {
    city: 'us-new-york-city',
    field: 'pros',
    match: 'EPIC program for senior prescription assistance',
    replacement: {
      text: 'EPIC program for senior prescription assistance',
      sources: [NY_EPIC],
    },
  },

  // ─── Cleveland OH ──────────────────────────────────────────────
  {
    city: 'us-cleveland-oh',
    field: 'pros',
    // NOTE: source bullet has mojibake; replacement normalizes to U+2014.
    match: 'Cleveland Clinic â€” world-class healthcare',
    replacement: {
      text: 'Cleveland Clinic — world-class healthcare',
      sources: [CLEVELAND_CLINIC, CLEVELAND_CLINIC_USNEWS],
    },
  },

  // ─── Birmingham AL ─────────────────────────────────────────────
  {
    city: 'us-birmingham-al',
    field: 'pros',
    // NOTE: source bullet has mojibake; replacement normalizes to U+2014.
    match: 'UAB Hospital â€” excellent medical center',
    replacement: { text: 'UAB Hospital — excellent medical center', sources: [UAB] },
  },

  // ─── Raleigh-Durham NC ─────────────────────────────────────────
  {
    city: 'us-raleigh',
    field: 'pros',
    match: 'World-class healthcare (Duke University Hospital, UNC Hospitals)',
    replacement: {
      text: 'World-class healthcare (Duke University Hospital, UNC Hospitals)',
      sources: [DUKE, UNC],
    },
  },
  {
    city: 'us-raleigh',
    field: 'pros',
    match: 'No Social Security tax',
    replacement: { text: 'No Social Security tax', sources: [NC_NO_SS_TAX] },
  },
  {
    city: 'us-raleigh',
    field: 'cons',
    match: 'State income tax on retirement withdrawals (no exclusion beyond SS)',
    replacement: {
      text: 'State income tax on retirement withdrawals (no exclusion beyond SS)',
      sources: [NC_NO_SS_TAX],
    },
  },

  // ─── Summerville SC ────────────────────────────────────────────
  {
    city: 'us-summerville',
    field: 'pros',
    match: 'No sales tax on groceries',
    replacement: { text: 'No sales tax on groceries', sources: [SC_GROCERY_EXEMPT] },
  },
  {
    city: 'us-summerville',
    field: 'pros',
    match: 'SS fully exempt from state tax',
    replacement: { text: 'SS fully exempt from state tax', sources: [SC_SS_EXEMPT] },
  },
  {
    city: 'us-summerville',
    field: 'pros',
    match: 'MUSC — world-class healthcare 30 min away',
    replacement: { text: 'MUSC — world-class healthcare 30 min away', sources: [MUSC] },
  },
  {
    city: 'us-summerville',
    field: 'cons',
    match: 'State income tax (6.5% top rate)',
    replacement: { text: 'State income tax (6.5% top rate, phasing down to 6.2%)', sources: [SC_INCOME_TAX] },
  },

  // ─── Milwaukee WI ──────────────────────────────────────────────
  {
    city: 'us-milwaukee-wi',
    field: 'cons',
    match: 'WI state income tax (3.54-7.65%)',
    replacement: { text: 'WI state income tax (3.50-7.65%)', sources: [WI_INCOME_TAX] },
  },

  // ─── Minneapolis MN ────────────────────────────────────────────
  {
    city: 'us-minneapolis-mn',
    field: 'pros',
    match: 'Excellent healthcare (Mayo, Allina, Fairview systems)',
    replacement: {
      text: 'Excellent healthcare (Mayo, Allina, Fairview systems)',
      sources: [MAYO],
    },
  },
  {
    city: 'us-minneapolis-mn',
    field: 'cons',
    match: 'High state income tax (5.35-9.85%)',
    replacement: { text: 'High state income tax (5.35-9.85%)', sources: [MN_INCOME_TAX] },
  },
  {
    city: 'us-minneapolis-mn',
    field: 'cons',
    match: 'SS benefits partially taxed by state',
    replacement: { text: 'SS benefits partially taxed by state', sources: [MN_SS_PARTIAL] },
  },

  // ─── Saint Paul MN ─────────────────────────────────────────────
  {
    city: 'us-saint-paul-mn',
    field: 'pros',
    match: 'Excellent healthcare system (Mayo Clinic nearby)',
    replacement: { text: 'Excellent healthcare system (Mayo Clinic nearby)', sources: [MAYO] },
  },
  {
    city: 'us-saint-paul-mn',
    field: 'cons',
    match: 'High state income tax (5.35-9.85%)',
    replacement: { text: 'High state income tax (5.35-9.85%)', sources: [MN_INCOME_TAX] },
  },

  // ─── Fort Wayne IN ─────────────────────────────────────────────
  {
    city: 'us-fort-wayne-in',
    field: 'cons',
    match: 'IN flat state income tax (3.05%) plus county tax',
    replacement: {
      text: 'IN flat state income tax (3.05% TY2024, 3.0% TY2025) plus county tax',
      sources: [IN_INCOME_TAX],
    },
  },

  // ─── Oakland County MI ─────────────────────────────────────────
  {
    city: 'us-oakland-county-mi',
    field: 'cons',
    match: 'MI state income tax (4.25%) plus some city taxes',
    replacement: {
      text: 'MI state income tax (4.25%) plus some city taxes',
      sources: [MI_INCOME_TAX],
    },
  },

  // ─── Albuquerque NM ────────────────────────────────────────────
  {
    city: 'us-albuquerque-nm',
    field: 'pros',
    match: 'Dry, sunny climate with 310 sunny days',
    replacement: {
      text: 'Dry, sunny climate (~278 days with measurable sunshine; ~310 days without measurable precipitation per NOAA NCEI)',
      sources: [ABQ_SUN_NOAA],
    },
  },

  // ─── Denver CO ─────────────────────────────────────────────────
  {
    city: 'us-denver-co',
    field: 'pros',
    match: '300+ days of sunshine',
    replacement: {
      text: '300+ days of sunshine (~245 fully-sunny + ~60 partly-sunny per NOAA NWS Denver)',
      sources: [DENVER_SUN_NOAA],
    },
  },
];

// ─── Apply ─────────────────────────────────────────────────────────────

let updated = 0;
let alreadyCited = 0;
let notFound = 0;

// Group updates by city to write each location.json once
const byCity = new Map();
for (const u of UPDATES) {
  if (!byCity.has(u.city)) byCity.set(u.city, []);
  byCity.get(u.city).push(u);
}

for (const [city, ups] of byCity) {
  const path = join(DATA_DIR, city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  let dirty = false;

  for (const u of ups) {
    const list = loc[u.field];
    if (!Array.isArray(list)) {
      console.warn(`SKIP ${u.city} — no ${u.field} array`);
      continue;
    }
    let found = false;
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const text = typeof entry === 'string' ? entry : entry?.text;

      // Primary match: original (pre-citation) text.
      if (text === u.match) {
        found = true;
        if (typeof entry !== 'string' && entry?.sources?.length) {
          alreadyCited++;
          console.log(`-    ${u.city}.${u.field}: already cited — "${u.match}"`);
          break;
        }
        list[i] = u.replacement;
        updated++;
        dirty = true;
        console.log(`OK   ${u.city}.${u.field}: cited "${u.match}"`);
        break;
      }

      // Idempotency fallback: replacement.text already in place with
      // sources attached (covers fact-corrected bullets where the
      // text-after-cite differs from the original match string).
      if (
        text === u.replacement.text &&
        typeof entry !== 'string' &&
        entry?.sources?.length
      ) {
        found = true;
        alreadyCited++;
        console.log(`-    ${u.city}.${u.field}: already cited (post-rewrite) — "${u.match}"`);
        break;
      }
    }
    if (!found) {
      notFound++;
      console.warn(`MISS ${u.city}.${u.field}: bullet not found — "${u.match}"`);
    }
  }

  if (dirty) {
    const hadTrailingNewline = raw.endsWith('\n');
    writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
  }
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
