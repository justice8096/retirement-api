import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const LOCATIONS_DIR = join(DATA_DIR, 'locations');

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function log(msg) { process.stderr.write(msg + '\n'); }

// ===== 2-BEDROOM HOUSE RENTAL DATA (all values in USD) =====
// Includes base rent + all applicable taxes/fees paid by tenant
// Sources: Zillow, Idealista, SeLoger, Numbeo, Expatistan, local government sites (2025-2026)

const RENT_DATA = {
  'us-virginia': {
    rent: { min: 2500, max: 3500, typical: 3000, annualInflation: 0.035 },
    housing: {
      propertyType: '2-bedroom single-family house',
      monthlyBudget: { min: 2500, max: 3500, typical: 3000 },
      breakdown: {
        baseRent: 2850,
        rentersInsurance: 35,
        localTaxesFees: 0,
        trashWaterSewer: 115,
        total: 3000
      },
      taxNotes: 'Virginia has no rental tax. Property tax (avg 1.15% Fairfax County) is landlord responsibility but built into rent. Renter\'s insurance recommended but not legally required.',
      leaseTerms: '12-month standard lease. Security deposit max 2 months rent ($6,000). Pet deposit common ($300-500).',
      marketNotes: 'Fairfax County/NoVA is one of the most expensive rental markets in the US outside major cities. 2BR houses are scarce; most rentals are apartments/townhomes. Expect competition.',
      sources: [
        { name: 'Zillow Fairfax County Rental Market', url: 'https://www.zillow.com/rental-manager/market-trends/fairfax-county-va/' },
        { name: 'Fairfax County Property Tax Rates', url: 'https://www.fairfaxcounty.gov/taxes/real-estate-tax' }
      ]
    }
  },
  'us-cherry-hill': {
    rent: { min: 1900, max: 2700, typical: 2300, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom single-family house',
      monthlyBudget: { min: 1900, max: 2700, typical: 2300 },
      breakdown: {
        baseRent: 2175,
        rentersInsurance: 30,
        localTaxesFees: 0,
        trashWaterSewer: 95,
        total: 2300
      },
      taxNotes: 'New Jersey has no residential rental tax. NJ has highest property taxes in the US (avg 2.23%) but this is landlord responsibility. Cherry Hill/Camden County slightly below state average.',
      leaseTerms: '12-month standard lease. Security deposit max 1.5 months rent (~$3,450). NJ tenant protections are strong.',
      marketNotes: 'South Jersey suburban market with good availability of 2BR houses. More affordable than neighboring Philadelphia suburbs on the PA side.',
      sources: [
        { name: 'Zillow Cherry Hill Rentals', url: 'https://www.zillow.com/rental-manager/market-trends/cherry-hill-nj/' },
        { name: 'NJ Division of Taxation', url: 'https://www.nj.gov/treasury/taxation/' }
      ]
    }
  },
  'us-philadelphia': {
    rent: { min: 1600, max: 2400, typical: 2000, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom rowhouse/single-family house',
      monthlyBudget: { min: 1600, max: 2400, typical: 2000 },
      breakdown: {
        baseRent: 1880,
        rentersInsurance: 30,
        localTaxesFees: 0,
        trashWaterSewer: 90,
        total: 2000
      },
      taxNotes: 'Philadelphia has no residential rental tax (commercial rentals taxed at 8.5% but residential exempt). PA property tax is landlord responsibility. City wage tax 3.75% applies to earned income only, not rental payments.',
      leaseTerms: '12-month standard lease. Security deposit max 2 months first year, 1 month after. Philadelphia has strong tenant protections and rent stabilization discussions ongoing.',
      marketNotes: 'Wide range of 2BR rowhouses available across neighborhoods. Prices vary dramatically: $1,200 in West Philly to $2,800+ in Center City/Rittenhouse. Typical neighborhoods for retirees: Chestnut Hill, Mt. Airy, Manayunk.',
      sources: [
        { name: 'Zillow Philadelphia Rental Market', url: 'https://www.zillow.com/rental-manager/market-trends/philadelphia-pa/' },
        { name: 'Philadelphia Revenue Department', url: 'https://www.phila.gov/departments/department-of-revenue/' }
      ]
    }
  },
  'us-richmond': {
    rent: { min: 1500, max: 2200, typical: 1800, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom single-family house',
      monthlyBudget: { min: 1500, max: 2200, typical: 1800 },
      breakdown: {
        baseRent: 1690,
        rentersInsurance: 25,
        localTaxesFees: 0,
        trashWaterSewer: 85,
        total: 1800
      },
      taxNotes: 'Virginia has no rental tax. Richmond city property tax rate ~$1.20/$100 assessed value — landlord responsibility. No additional renter taxes or fees.',
      leaseTerms: '12-month standard lease. Security deposit max 2 months rent ($3,600). Virginia Residential Landlord and Tenant Act applies.',
      marketNotes: 'Affordable Southern city with good 2BR house availability. Fan District, Museum District, and Near West End popular for walkability. Prices rising but still well below DC metro.',
      sources: [
        { name: 'Zillow Richmond Rental Market', url: 'https://www.zillow.com/rental-manager/market-trends/richmond-va/' },
        { name: 'City of Richmond Real Estate Tax', url: 'https://www.rva.gov/finance/real-estate-tax' }
      ]
    }
  },
  'us-savannah': {
    rent: { min: 1400, max: 2100, typical: 1700, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom single-family house',
      monthlyBudget: { min: 1400, max: 2100, typical: 1700 },
      breakdown: {
        baseRent: 1600,
        rentersInsurance: 30,
        localTaxesFees: 0,
        trashWaterSewer: 70,
        total: 1700
      },
      taxNotes: 'Georgia has no residential rental tax. Chatham County property tax millage rate ~34 mills — landlord responsibility. Georgia offers homestead exemptions but only for owner-occupied properties.',
      leaseTerms: '12-month standard lease. No statutory limit on security deposit in Georgia. Typical deposit is 1-2 months rent.',
      marketNotes: 'Historic district 2BR houses command premium ($2,000+). Better value in Midtown, Ardsley Park, and Thunderbolt. Hurricane insurance adds to landlord costs reflected in rent.',
      sources: [
        { name: 'Zillow Savannah Rental Market', url: 'https://www.zillow.com/rental-manager/market-trends/savannah-ga/' },
        { name: 'Chatham County Tax Commissioner', url: 'https://www.chathamcountytax.com/' }
      ]
    }
  },
  'us-florida': {
    rent: { min: 1800, max: 2700, typical: 2200, annualInflation: 0.035 },
    housing: {
      propertyType: '2-bedroom single-family house',
      monthlyBudget: { min: 1800, max: 2700, typical: 2200 },
      breakdown: {
        baseRent: 2070,
        rentersInsurance: 40,
        localTaxesFees: 0,
        trashWaterSewer: 90,
        total: 2200
      },
      taxNotes: 'Florida residential rent exempt from sales tax since June 2023 (was previously taxed at 5.5% + county surtax). No state income tax. Property tax is landlord responsibility. Higher renter\'s insurance due to hurricane risk.',
      leaseTerms: '12-month standard lease. No statutory limit on security deposit. Landlord must hold deposit in separate account. Florida Residential Landlord and Tenant Act applies.',
      marketNotes: 'Market varies significantly: Tampa/St. Pete $1,800-2,400, Orlando $1,700-2,300, Jacksonville $1,500-2,000, Miami $2,500+. Prices surged 2021-2023, now stabilizing. Hurricane insurance costs push up rents.',
      sources: [
        { name: 'Zillow Florida Rental Market', url: 'https://www.zillow.com/rental-manager/market-trends/fl/' },
        { name: 'FL Dept of Revenue - Sales Tax on Rent', url: 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx' }
      ]
    }
  },
  'france-brittany': {
    rent: { min: 750, max: 1150, typical: 950, annualInflation: 0.02 },
    housing: {
      propertyType: '2-bedroom house (maison)',
      monthlyBudget: { min: 750, max: 1150, typical: 950 },
      breakdown: {
        baseRentEUR: 770,
        taxeOrduresMenageresEUR: 18,
        chargesLocativesEUR: 30,
        totalEUR: 818,
        exchangeRate: 1.08,
        totalUSD: 883
      },
      taxNotes: 'Taxe d\'habitation eliminated for primary residences (2023). Taxe d\'enlèvement des ordures ménagères (TEOM/garbage tax) ~€200-250/year typically passed to tenant. Charges locatives (shared building fees) lower for houses than apartments. No VAT on residential rent.',
      leaseTerms: '3-year lease standard for unfurnished (bail de 3 ans). 1-year for furnished. Security deposit max 1 month rent unfurnished, 2 months furnished. 3-month notice to vacate (1 month in tight-market zones).',
      marketNotes: 'Brittany offers excellent value for houses. Vannes, Quimper, and Saint-Malo have good availability. Stone cottages and longères common. Rural areas significantly cheaper than coastal towns.',
      sources: [
        { name: 'SeLoger Brittany Rentals', url: 'https://www.seloger.com/immobilier/locations/bretagne.htm' },
        { name: 'Service-Public.fr Taxe Habitation', url: 'https://www.service-public.fr/particuliers/vosdroits/F42' }
      ]
    }
  },
  'france-lyon': {
    rent: { min: 1100, max: 1650, typical: 1350, annualInflation: 0.025 },
    housing: {
      propertyType: '2-bedroom house (maison)',
      monthlyBudget: { min: 1100, max: 1650, typical: 1350 },
      breakdown: {
        baseRentEUR: 1050,
        taxeOrduresMenageresEUR: 22,
        chargesLocativesEUR: 35,
        totalEUR: 1107,
        exchangeRate: 1.08,
        totalUSD: 1196
      },
      taxNotes: 'Taxe d\'habitation eliminated for primary residences. TEOM ~€250-300/year in Lyon metro passed to tenant. Lyon is in a "zone tendue" (tight market) with rent control (encadrement des loyers) since Nov 2021. No VAT on residential rent.',
      leaseTerms: '3-year lease unfurnished. Lyon is zone tendue: 1-month notice to vacate, rent increases capped by INSEE reference index (IRL). Security deposit 1 month.',
      marketNotes: 'Houses are scarce in central Lyon (mostly apartments). 2BR houses more available in suburbs: Tassin-la-Demi-Lune, Écully, Oullins, Caluire. Budget 10-20% more than apartment equivalent.',
      sources: [
        { name: 'SeLoger Lyon Rentals', url: 'https://www.seloger.com/immobilier/locations/lyon.htm' },
        { name: 'Lyon Encadrement des Loyers', url: 'https://www.lyonmetropole.fr/encadrement-des-loyers' }
      ]
    }
  },
  'france-montpellier': {
    rent: { min: 950, max: 1400, typical: 1150, annualInflation: 0.025 },
    housing: {
      propertyType: '2-bedroom house (maison/villa)',
      monthlyBudget: { min: 950, max: 1400, typical: 1150 },
      breakdown: {
        baseRentEUR: 900,
        taxeOrduresMenageresEUR: 20,
        chargesLocativesEUR: 25,
        totalEUR: 945,
        exchangeRate: 1.08,
        totalUSD: 1021
      },
      taxNotes: 'Taxe d\'habitation eliminated for primary residences. TEOM ~€230-270/year in Montpellier area. Montpellier has rent control (encadrement des loyers) since July 2022. No VAT on residential rent.',
      leaseTerms: '3-year lease unfurnished. Montpellier is zone tendue: 1-month notice, rent increase caps apply. Security deposit 1 month.',
      marketNotes: 'Good availability of 2BR villas in Montpellier suburbs and nearby villages (Castelnau-le-Lez, Lattes, Pérols). Mediterranean climate makes outdoor living spaces common. Houses often include small garden.',
      sources: [
        { name: 'SeLoger Montpellier Rentals', url: 'https://www.seloger.com/immobilier/locations/montpellier.htm' },
        { name: 'Montpellier Encadrement des Loyers', url: 'https://www.montpellier3m.fr/encadrement-des-loyers' }
      ]
    }
  },
  'france-toulouse': {
    rent: { min: 900, max: 1350, typical: 1100, annualInflation: 0.025 },
    housing: {
      propertyType: '2-bedroom house (maison)',
      monthlyBudget: { min: 900, max: 1350, typical: 1100 },
      breakdown: {
        baseRentEUR: 870,
        taxeOrduresMenageresEUR: 19,
        chargesLocativesEUR: 28,
        totalEUR: 917,
        exchangeRate: 1.08,
        totalUSD: 990
      },
      taxNotes: 'Taxe d\'habitation eliminated for primary residences. TEOM ~€220-260/year. Toulouse implemented rent control (encadrement des loyers) in 2024. No VAT on residential rent.',
      leaseTerms: '3-year lease unfurnished. Toulouse is zone tendue: 1-month notice, rent caps. Security deposit 1 month.',
      marketNotes: 'Toulouse (La Ville Rose) has good house availability outside the centre. Suburbs like Balma, L\'Union, Colomiers offer 2BR houses with gardens. Aerospace industry drives demand but supply keeps up.',
      sources: [
        { name: 'SeLoger Toulouse Rentals', url: 'https://www.seloger.com/immobilier/locations/toulouse.htm' },
        { name: 'Toulouse Métropole Encadrement', url: 'https://www.toulouse-metropole.fr/encadrement-des-loyers' }
      ]
    }
  },
  'spain-alicante': {
    rent: { min: 750, max: 1200, typical: 950, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom house/villa (chalet)',
      monthlyBudget: { min: 750, max: 1200, typical: 950 },
      breakdown: {
        baseRentEUR: 750,
        basuraGarbageEUR: 8,
        communityFeesEUR: 25,
        totalEUR: 783,
        exchangeRate: 1.08,
        totalUSD: 846
      },
      taxNotes: 'No VAT (IVA) on residential rent in Spain. IBI (property tax) is landlord responsibility. Basura (garbage collection) ~€90-110/year often charged to tenant. Community fees (comunidad) for urbanizaciones passed to tenant. Tenant must register on the padrón (municipal register).',
      leaseTerms: '5-year lease minimum (Ley de Arrendamientos Urbanos, LAU 2023 reform). Landlord cannot terminate before 5 years unless personal need. Security deposit: 1 month legally (fianza). Rent increases capped by INE index (max 3% in 2024, 2% in 2025).',
      marketNotes: 'Costa Blanca has excellent availability of 2BR villas/chalets, especially in urbanizaciones (gated communities) outside city center. Playa de San Juan, Campello, Mutxamel offer good value. Many come with pool access.',
      sources: [
        { name: 'Idealista Alicante Rentals', url: 'https://www.idealista.com/en/alquiler-viviendas/alicante-alicante/' },
        { name: 'Spain LAU Rental Law', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003' }
      ]
    }
  },
  'portugal-lisbon': {
    rent: { min: 1100, max: 1800, typical: 1400, annualInflation: 0.035 },
    housing: {
      propertyType: '2-bedroom house (moradia)',
      monthlyBudget: { min: 1100, max: 1800, typical: 1400 },
      breakdown: {
        baseRentEUR: 1150,
        condominioFeesEUR: 30,
        totalEUR: 1180,
        exchangeRate: 1.08,
        totalUSD: 1274
      },
      taxNotes: 'No VAT on residential rent. IMI (property tax) is landlord responsibility. Landlord pays 25% tax on rental income (can impact pricing). Tenant stamp duty (Imposto de Selo) of 10% on rent applies — typically built into advertised rent. Condomínio fees for shared properties passed to tenant.',
      leaseTerms: 'Minimum lease varies: typically 1-year with automatic renewal up to 3 years. NRAU (New Urban Rental Law) governs. Security deposit usually 2 months. Rent increases capped by INE inflation coefficient (2.16% for 2025).',
      marketNotes: 'Lisbon city proper: 2BR houses extremely rare and expensive. Better value in Greater Lisbon: Cascais, Sintra, Almada, Setúbal. Algarve towns (Faro, Lagos, Tavira) offer more houses. Golden Visa demand inflated market but cooling since visa changes.',
      sources: [
        { name: 'Idealista Portugal Rentals', url: 'https://www.idealista.pt/en/arrendar-casas/lisboa/' },
        { name: 'Portugal NRAU Rental Law', url: 'https://www.portaldahabitacao.pt/arrendamento' }
      ]
    }
  },
  'panama-city': {
    rent: { min: 1000, max: 1700, typical: 1300, annualInflation: 0.03 },
    housing: {
      propertyType: '2-bedroom house',
      monthlyBudget: { min: 1000, max: 1700, typical: 1300 },
      breakdown: {
        baseRent: 1220,
        HOAFees: 50,
        garbageCollection: 15,
        municipalFee: 15,
        total: 1300
      },
      taxNotes: 'No rental tax in Panama. Property tax (impuesto de inmueble) is landlord responsibility with generous exemptions for new construction (up to 20 years tax-free). No VAT on residential rent. Panama uses USD (balboa pegged 1:1).',
      leaseTerms: 'Typical 1-year lease. Security deposit usually 1 month + last month rent. Panama Civil Code governs rentals. Pensionado visa holders get 25% off utility bills.',
      marketNotes: 'Panama City has both high-rise apartments and standalone houses. Houses more common in suburbs: Clayton, Ciudad del Saber, Albrook, Costa del Este. Gated communities (residenciales) popular with expats. AC essential year-round.',
      sources: [
        { name: 'Encuentra24 Panama Rentals', url: 'https://www.encuentra24.com/panama/bienes-raices-alquiler-casas' },
        { name: 'Panama Pensionado Benefits', url: 'https://www.visitpanama.com/plan/retirement-in-panama/' }
      ]
    }
  },
  'panama-boquete': {
    rent: { min: 700, max: 1200, typical: 900, annualInflation: 0.025 },
    housing: {
      propertyType: '2-bedroom house/cottage',
      monthlyBudget: { min: 700, max: 1200, typical: 900 },
      breakdown: {
        baseRent: 850,
        garbageCollection: 10,
        municipalFee: 10,
        total: 870
      },
      taxNotes: 'No rental tax in Panama. Property tax exemptions generous for new construction. No VAT on residential rent. Pensionado visa holders get 25% off utility bills and various discounts.',
      leaseTerms: '1-year typical but flexible. Many rentals are informal/expat-to-expat. Security deposit 1-2 months common.',
      marketNotes: 'Boquete is a small mountain town (pop ~25,000) with large expat community. Houses range from basic Panamanian to luxury expat-built. Cooler climate (60-80°F) means no AC needed. Good availability year-round. Many furnished options.',
      sources: [
        { name: 'Boquete Ning Expat Community', url: 'https://www.boquete.ning.com/' },
        { name: 'Encuentra24 Boquete Rentals', url: 'https://www.encuentra24.com/panama/bienes-raices-alquiler-casas/chiriqui-boquete' }
      ]
    }
  }
};

// ===== UPDATE ALL LOCATIONS =====
let updated = 0;

for (const [locId, data] of Object.entries(RENT_DATA)) {
  const locPath = join(LOCATIONS_DIR, locId, 'location.json');
  const dcPath = join(LOCATIONS_DIR, locId, 'detailed-costs.json');

  if (!existsSync(locPath)) {
    log('SKIP ' + locId + ' — no location.json');
    continue;
  }

  // Update location.json rent
  const loc = readJSON(locPath);
  loc.monthlyCosts.rent = {
    min: data.rent.min,
    max: data.rent.max,
    typical: data.rent.typical,
    type: data.housing.propertyType,
    annualInflation: data.rent.annualInflation,
    notes: data.housing.taxNotes.split('.')[0] + '.'
  };
  writeJSON(locPath, loc);
  log('Updated rent in ' + locId + '/location.json: $' + data.rent.typical + '/mo');

  // Update detailed-costs.json with housing section
  const dc = existsSync(dcPath) ? readJSON(dcPath) : {};
  dc.housing = data.housing;
  writeJSON(dcPath, dc);
  log('  Added housing section to ' + locId + '/detailed-costs.json');

  updated++;
}

log('');
log('Updated ' + updated + ' locations to 2-bedroom house rental costs.');
log('');
log('IMPORTANT: Run "node tools/build-db.js" to rebuild the SQLite database.');
