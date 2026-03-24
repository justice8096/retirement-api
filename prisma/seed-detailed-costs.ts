/**
 * Generate detailed-costs supplements for all 118 new seed locations.
 *
 * Uses existing detailed-costs.json files as templates:
 *   - US locations → us-virginia template
 *   - EU locations → france-brittany template
 *   - LATAM locations → panama-city template
 *
 * Scales prices based on each location's monthlyCosts vs the template's monthlyCosts.
 *
 * Usage:
 *   npx tsx prisma/seed-detailed-costs.ts
 *   npx tsx prisma/seed-detailed-costs.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ---------- Types ----------

interface MinTypMax {
  min: number;
  typical: number;
  max: number;
}

interface LocationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  cities?: string[];
  currency: string;
  exchangeRate: number;
  monthlyCosts: Record<string, { typical: number; min?: number; max?: number }>;
  [key: string]: unknown;
}

// ---------- Helpers ----------

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

function ri(n: number): number {
  return Math.round(n);
}

function scaleMinTypMax(base: MinTypMax, factor: number): MinTypMax {
  return { min: ri(base.min * factor), typical: ri(base.typical * factor), max: ri(base.max * factor) };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- Load templates ----------

const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'locations');

function loadTemplate(id: string): Record<string, any> {
  const p = join(DATA_DIR, id, 'detailed-costs.json');
  return JSON.parse(readFileSync(p, 'utf-8'));
}

const usTemplate = loadTemplate('us-virginia');
const euTemplate = loadTemplate('france-brittany');
const latamTemplate = loadTemplate('panama-city');

// Reference monthlyCosts from templates (approximate values used for ratio calc)
const usRefCosts: Record<string, number> = {
  rent: 3000,
  groceries: 712,
  utilities: 320,
  healthcare: 1109,
  transportation: 300,
  entertainment: 530,
  personalCare: 100,
  phoneCell: 62,
  medicine: 91,
  clothing: 100,
  insurance: 350,
};

const euRefCosts: Record<string, number> = {
  rent: 800,
  groceries: 520,
  utilities: 180,
  healthcare: 200,
  transportation: 150,
  entertainment: 390,
  personalCare: 60,
  phoneCell: 25,
  medicine: 36,
  clothing: 80,
  insurance: 100,
};

const latamRefCosts: Record<string, number> = {
  rent: 1500,
  groceries: 500,
  utilities: 180,
  healthcare: 350,
  transportation: 150,
  entertainment: 380,
  personalCare: 60,
  phoneCell: 35,
  medicine: 479,
  clothing: 60,
  insurance: 200,
};

// ---------- Country-specific metadata ----------

interface CountryMeta {
  pharmacyNote: string;
  prescriptionSystem: string;
  insuranceCoverage: string;
  visionInsurance: string;
  visionWait: string;
  visionSenior: string;
  dentalInsurance: string;
  dentalAvailability: string;
  transitSystem: string;
  seniorTransit: string;
  rideShareNote: string;
  walkability: string;
  seniorMinAge: number;
  discountNames: string[];
  discountDescs: string[];
  cellPlanName: string;
  cellPlanNotes: string;
  housingNotes: string;
  leaseTerms: string;
  marketNotes: string;
  healthcareSystem: string;
  hairNotes: string;
}

const US_META: CountryMeta = {
  pharmacyNote: 'CVS, Walgreens, Walmart pharmacies widely available. Mail-order via Medicare Part D plans.',
  prescriptionSystem: 'Medicare Part D prescription drug plan. Annual out-of-pocket cap $2,000 under Inflation Reduction Act.',
  insuranceCoverage: 'Medicare Part D covers most prescriptions with tiered copays. Generic drugs $0-15/month.',
  visionInsurance: 'Need separate vision plan or Medicare Advantage with vision. Standalone plans $15-25/month.',
  visionWait: '1-3 weeks for routine eye exams. Shorter waits at retail optometry.',
  visionSenior: 'Medicare covers cataract surgery and glaucoma screening. One pair of eyeglasses after cataract surgery.',
  dentalInsurance: 'Need separate dental plan ($20-50/month) or Medicare Advantage with dental.',
  dentalAvailability: 'Good availability. Many dentists accept dental discount plans for uninsured seniors.',
  transitSystem: 'Bus and/or light rail system. Varies by metro area.',
  seniorTransit: 'Seniors 65+ typically get reduced fares on public transit.',
  rideShareNote: 'Uber and Lyft available. GoGoGrandparent for seniors who prefer phone-based ordering.',
  walkability: 'Moderate. Walkable downtown areas; suburbs require a car.',
  seniorMinAge: 65,
  discountNames: ['Medicare', 'AARP Membership', 'Senior Transit Fare', 'SilverSneakers Fitness', 'America the Beautiful Senior Pass'],
  discountDescs: [
    'Federal health insurance at 65. Part A premium-free, Part B ~$185/mo, Part D $10-50/mo.',
    'Annual membership $16. Discounts on insurance, dining, travel, retail. Available at 50+.',
    'Reduced fares on public transit for riders 65+.',
    'Free gym membership through participating Medicare Advantage plans.',
    'Lifetime pass to all national parks for $80 (or $20/year) at 62+.',
  ],
  cellPlanName: 'T-Mobile 55+ Essentials',
  cellPlanNotes: '2 lines unlimited talk/text/data. 5G included.',
  housingNotes: 'No rental tax in most states. Property tax is landlord responsibility built into rent.',
  leaseTerms: '12-month standard lease. Security deposit typically 1-2 months rent. Pet deposit $300-500.',
  marketNotes: '2BR house availability varies by market. Apartments/townhomes more common in urban areas.',
  healthcareSystem: 'Medicare + Medigap supplement',
  hairNotes: 'Good variety of salons and barbershops available.',
};

const EU_COUNTRY_META: Record<string, Partial<CountryMeta>> = {
  France: {
    pharmacyNote: 'Pharmacies in every town. Pharmacie de garde for nights/weekends.',
    prescriptionSystem: 'Ordonnance from medecin traitant required. Carte Vitale for automatic reimbursement.',
    insuranceCoverage: 'Securite Sociale covers 70% of prescriptions. Mutuelle covers remaining 30%. ALD provides 100% for chronic conditions.',
    visionInsurance: '100% Sante offers zero-cost glasses every 2 years. Mutuelles cover up to 200-400 EUR on frames.',
    visionWait: '3-6 months for ophthalmologist. Orthoptists can renew prescriptions.',
    visionSenior: 'Annual eye exams recommended. 100% Sante valuable for progressive lenses.',
    dentalInsurance: '100% Sante reform guarantees zero-cost crowns and dentures. Good mutuelles cover implants partially.',
    dentalAvailability: 'Moderate availability. Larger cities have more dentists. Centres de sante dentaire offer lower fees.',
    transitSystem: 'Metro, tram, and bus networks in major cities. TER regional trains connect cities.',
    seniorTransit: 'Senior reduced fares (60+) on most transit systems.',
    rideShareNote: 'Uber available in larger cities. Taxis more common in smaller towns.',
    walkability: 'Generally walkable city centers. Good pedestrian infrastructure.',
    seniorMinAge: 60,
    discountNames: ['Carte Senior SNCF', 'Mutuelle Sante', 'Carte Senior Transport'],
    discountDescs: [
      '50% off TGV and Intercites tickets for 49.90 EUR/year.',
      'Complementary health insurance covering remaining costs after Securite Sociale.',
      'Reduced fares on local transport for seniors 60+.',
    ],
    cellPlanName: 'Free Mobile / SFR',
    cellPlanNotes: 'Competitive French mobile market. Plans from 2-20 EUR/line.',
    housingNotes: 'Taxe d\'habitation eliminated for primary residences. Taxe fonciere is landlord responsibility.',
    leaseTerms: '3-year lease (bail) standard. 1 month deposit for unfurnished, 2 months for furnished.',
    marketNotes: 'Rental market active in major cities. Smaller towns have lower rents but fewer options.',
    healthcareSystem: 'Securite Sociale + Mutuelle',
    hairNotes: 'Salons available in all towns. Prices generally lower than US.',
  },
  Spain: {
    pharmacyNote: 'Farmacia on nearly every block in cities. Green cross sign. Farmacia de guardia for after-hours.',
    prescriptionSystem: 'Receta medica from public health system doctor. Tarjeta Sanitaria for subsidized prescriptions.',
    insuranceCoverage: 'Public system covers prescriptions with copay 10-60% based on income. Retirees pay 10% capped at 8-18 EUR/mo.',
    visionInsurance: 'Public system covers basic eye exams. Private insurance available for glasses/contacts.',
    visionWait: '2-4 weeks for ophthalmologist through public system. Private available within days.',
    visionSenior: 'Regular eye exams important. Public system covers medically necessary procedures.',
    dentalInsurance: 'Dental mostly private in Spain. Private plans 15-30 EUR/mo. Basic checkups may be covered publicly.',
    dentalAvailability: 'Excellent availability. Dental clinics widely available. Competitive pricing.',
    transitSystem: 'Metro and bus in major cities. Cercanias commuter trains.',
    seniorTransit: 'Tarjeta dorada (golden card) for seniors 65+ gives 40% off Renfe trains.',
    rideShareNote: 'Uber/Cabify available in major cities. Taxis well-regulated and affordable.',
    walkability: 'Excellent walkability in most Spanish cities. Strong pedestrian culture.',
    seniorMinAge: 65,
    discountNames: ['Tarjeta Sanitaria', 'Tarjeta Dorada Renfe', 'Senior Municipal Discounts'],
    discountDescs: [
      'Public health card for subsidized healthcare and prescriptions.',
      '40% discount on Renfe trains for seniors 65+. Annual card 6 EUR.',
      'Municipal discounts on cultural activities, pools, and recreation for 65+.',
    ],
    cellPlanName: 'Movistar / Orange',
    cellPlanNotes: 'Competitive Spanish mobile market. Plans from 10-25 EUR/line.',
    housingNotes: 'IBI (property tax) is landlord responsibility. Rental agreements governed by LAU.',
    leaseTerms: '5-year minimum lease (LAU 2019). 2 months deposit standard.',
    marketNotes: 'Rental market competitive in coastal areas. Good availability in smaller cities.',
    healthcareSystem: 'Seguridad Social (public) + optional private',
    hairNotes: 'Affordable salons throughout. Peluquerias widely available.',
  },
  Portugal: {
    pharmacyNote: 'Farmacias widely available. Green cross sign. Farmacia de servico for after-hours.',
    prescriptionSystem: 'Receita medica from SNS doctor. ADSE or SNS for subsidized prescriptions.',
    insuranceCoverage: 'SNS covers prescriptions with copay system. Generic medications widely available at lower cost.',
    visionInsurance: 'SNS covers basic eye exams. Private insurance available. ADSE covers additional.',
    visionWait: '2-8 weeks for ophthalmologist through SNS. Private available within days.',
    visionSenior: 'Regular eye screening recommended. SNS covers medically necessary procedures.',
    dentalInsurance: 'Dental mostly private. Cheque dentista program provides some free dental care for seniors.',
    dentalAvailability: 'Good availability in cities. More limited in rural areas.',
    transitSystem: 'Metro and bus in Lisbon and Porto. CP trains connect cities.',
    seniorTransit: 'Lisboa Viva and Andante cards offer senior reduced fares for 65+.',
    rideShareNote: 'Uber and Bolt widely available. Taxis affordable with regulated meters.',
    walkability: 'Good walkability in city centers. Hilly terrain in some areas.',
    seniorMinAge: 65,
    discountNames: ['SNS Health Card', 'CP Senior Rail Discount', 'Senior Municipal Programs'],
    discountDescs: [
      'National health service card for subsidized healthcare.',
      'Reduced rail fares for seniors 65+ on CP trains.',
      'Municipal discounts on cultural events and recreation.',
    ],
    cellPlanName: 'MEO / NOS / Vodafone',
    cellPlanNotes: 'Portuguese mobile market. Plans from 10-20 EUR/line.',
    housingNotes: 'IMI (property tax) is landlord responsibility. Rental law reformed in 2012.',
    leaseTerms: '1-year minimum lease. 2 months deposit typical. Notice period 120 days for landlord.',
    marketNotes: 'Rental market tight in Lisbon/Porto. Better availability in Algarve and smaller cities.',
    healthcareSystem: 'SNS (public) + optional private/ADSE',
    hairNotes: 'Affordable salons. Good variety in urban areas.',
  },
  Italy: {
    pharmacyNote: 'Farmacia on most streets. Green cross. Farmacia di turno for after-hours.',
    prescriptionSystem: 'Ricetta medica from SSN doctor. Tessera Sanitaria for subsidized prescriptions.',
    insuranceCoverage: 'SSN covers most prescriptions with ticket (copay) varying by region. Many generics available.',
    visionInsurance: 'SSN covers basic eye exams. Private plans available for glasses/contacts.',
    visionWait: '2-6 weeks for ophthalmologist through SSN. Private available within days.',
    visionSenior: 'Regular eye exams covered. Cataract surgery covered by SSN.',
    dentalInsurance: 'Dental mostly private. SSN covers emergency dental and some procedures for low-income.',
    dentalAvailability: 'Good availability. Private dental clinics competitive on pricing.',
    transitSystem: 'Metro and bus in major cities. Trenitalia/Italo high-speed rail.',
    seniorTransit: 'Carta Argento for seniors 60+ gives 15% off Trenitalia.',
    rideShareNote: 'Uber limited. Free Now and local taxi apps available.',
    walkability: 'Excellent walkability in city centers. Strong pedestrian culture.',
    seniorMinAge: 65,
    discountNames: ['Tessera Sanitaria', 'Carta Argento Trenitalia', 'Senior Cultural Pass'],
    discountDescs: [
      'National health service card for subsidized healthcare.',
      '15% discount on Trenitalia for seniors 60+. Annual card 30 EUR.',
      'Reduced admission to museums and cultural sites for 65+.',
    ],
    cellPlanName: 'Iliad / TIM / Vodafone',
    cellPlanNotes: 'Italian mobile market. Iliad plans from 7-10 EUR/line.',
    housingNotes: 'IMU property tax is landlord responsibility. Cedolare secca flat tax option.',
    leaseTerms: '4+4 year lease standard. 2-3 months deposit.',
    marketNotes: 'Rental market varies greatly by region. Competitive in tourist areas.',
    healthcareSystem: 'SSN (Servizio Sanitario Nazionale)',
    hairNotes: 'Excellent salons. Competitive pricing.',
  },
  Greece: {
    pharmacyNote: 'Farmakeio widely available. Night pharmacy rotation system.',
    prescriptionSystem: 'Syntagi from EOPYY-contracted doctor. AMKA number for subsidized prescriptions.',
    insuranceCoverage: 'EOPYY covers prescriptions with copay 10-25%. Generics widely available.',
    visionInsurance: 'EOPYY covers basic eye exams. Private insurance available.',
    visionWait: '1-4 weeks for ophthalmologist. Private available quickly.',
    visionSenior: 'Regular screening recommended. EOPYY covers necessary procedures.',
    dentalInsurance: 'Limited public dental coverage. Private dental affordable.',
    dentalAvailability: 'Good availability in cities and islands. Affordable compared to Western Europe.',
    transitSystem: 'Metro and bus in Athens. KTEL buses connect cities.',
    seniorTransit: 'Reduced fares for seniors 65+ on Athens transit.',
    rideShareNote: 'Beat (FreeNow) app for taxis. Uber limited. Taxis affordable.',
    walkability: 'Good in city centers. Islands vary. Hilly terrain common.',
    seniorMinAge: 65,
    discountNames: ['AMKA Health Card', 'Senior Transit Card', 'Cultural Discounts'],
    discountDescs: [
      'Social insurance number for healthcare access.',
      'Reduced public transit fares for 65+.',
      'Free or reduced museum/archaeological site admission for EU seniors.',
    ],
    cellPlanName: 'Cosmote / Vodafone / Wind',
    cellPlanNotes: 'Greek mobile market. Plans from 10-20 EUR/line.',
    housingNotes: 'ENFIA property tax is landlord responsibility. Rental agreements need official stamp.',
    leaseTerms: '3-year minimum lease. 2 months deposit standard.',
    marketNotes: 'Rental market active. Good availability outside Athens center.',
    healthcareSystem: 'EOPYY public health insurance',
    hairNotes: 'Affordable salons throughout. Good variety.',
  },
  Croatia: {
    pharmacyNote: 'Ljekarna widely available. Duty pharmacy system for after-hours.',
    prescriptionSystem: 'Recept from HZZO-contracted doctor. Health card for subsidized prescriptions.',
    insuranceCoverage: 'HZZO covers prescriptions on basic list. Supplementary insurance covers copays.',
    visionInsurance: 'HZZO covers basic eye exams. Supplementary insurance for glasses.',
    visionWait: '2-4 weeks for ophthalmologist. Private available quickly.',
    visionSenior: 'Regular screening recommended. HZZO covers necessary procedures.',
    dentalInsurance: 'Basic dental covered by HZZO. Private dental very affordable.',
    dentalAvailability: 'Good availability. Croatia is a dental tourism destination.',
    transitSystem: 'Tram and bus in Zagreb. Bus networks in other cities.',
    seniorTransit: 'Senior discounts on ZET (Zagreb) transit for 65+.',
    rideShareNote: 'Bolt and Uber available. Taxis regulated and affordable.',
    walkability: 'Good in city centers. Coastal towns very walkable.',
    seniorMinAge: 65,
    discountNames: ['HZZO Health Card', 'Senior Transit', 'Cultural Discounts'],
    discountDescs: [
      'Croatian health insurance fund card for healthcare access.',
      'Reduced transit fares for seniors 65+.',
      'Reduced admission to museums and cultural sites.',
    ],
    cellPlanName: 'A1 / T-Hrvatski Telekom',
    cellPlanNotes: 'Croatian mobile market. Plans from 8-15 EUR/line.',
    housingNotes: 'Property tax reform ongoing. Rental agreements need notarization.',
    leaseTerms: '1-year minimum lease typical. 1-2 months deposit.',
    marketNotes: 'Rental market growing. Good value outside major tourist zones.',
    healthcareSystem: 'HZZO public health insurance',
    hairNotes: 'Affordable salons. Good quality.',
  },
  Cyprus: {
    pharmacyNote: 'Farmakeio available in all towns. Night pharmacy system.',
    prescriptionSystem: 'Prescription from GESY-registered doctor. GESY card for subsidized prescriptions.',
    insuranceCoverage: 'GESY covers prescriptions with small copay. Good coverage for chronic conditions.',
    visionInsurance: 'GESY covers basic eye exams. Private insurance available.',
    visionWait: '1-3 weeks for ophthalmologist. Private available quickly.',
    visionSenior: 'Regular screening recommended. GESY covers necessary procedures.',
    dentalInsurance: 'GESY covers basic dental. Private dental affordable for complex procedures.',
    dentalAvailability: 'Good availability. English widely spoken at dental clinics.',
    transitSystem: 'Bus networks in major cities. No rail system.',
    seniorTransit: 'Reduced bus fares for seniors.',
    rideShareNote: 'Bolt available. Taxis regulated. Limited ride-share options.',
    walkability: 'Moderate. City centers walkable. Car needed for rural areas.',
    seniorMinAge: 65,
    discountNames: ['GESY Health Card', 'Senior Bus Pass', 'Cultural Discounts'],
    discountDescs: [
      'General healthcare system card for subsidized healthcare.',
      'Reduced bus fares for seniors.',
      'Discounts on cultural activities.',
    ],
    cellPlanName: 'Cyta / Epic',
    cellPlanNotes: 'Cypriot mobile market. Plans from 15-25 EUR/line.',
    housingNotes: 'Property tax (IPT) is landlord responsibility.',
    leaseTerms: '1-year lease common. 1-2 months deposit.',
    marketNotes: 'Active rental market. Good availability in Paphos and Limassol.',
    healthcareSystem: 'GESY public health system',
    hairNotes: 'Good variety of salons. Reasonable prices.',
  },
  Malta: {
    pharmacyNote: 'Pharmacies available in all towns. Duty pharmacy rotation.',
    prescriptionSystem: 'Prescription from public health doctor. Entitlement card for free medications.',
    insuranceCoverage: 'Government health service covers many medications free of charge. Pink card for chronic conditions.',
    visionInsurance: 'Public system covers basic exams. Private insurance available.',
    visionWait: '2-6 weeks through public system. Private available quickly.',
    visionSenior: 'Regular screening recommended. Public system covers necessary procedures.',
    dentalInsurance: 'Limited public dental. Private dental affordable.',
    dentalAvailability: 'Good availability. Small island means short distances.',
    transitSystem: 'Malta Public Transport bus network covers entire island.',
    seniorTransit: 'Free public transport for residents 70+. Reduced fares for 60+.',
    rideShareNote: 'Bolt available. Taxis regulated. Small distances keep costs low.',
    walkability: 'Varies. Some areas walkable, others require transport. Hot summers limit walking.',
    seniorMinAge: 60,
    discountNames: ['Pink Card (Chronic Meds)', 'Senior Bus Card', 'Cultural Discounts'],
    discountDescs: [
      'Free medications for chronic conditions.',
      'Free or reduced bus fares for seniors.',
      'Reduced admission to Heritage Malta sites.',
    ],
    cellPlanName: 'GO / Melita / Epic',
    cellPlanNotes: 'Maltese mobile market. Plans from 10-20 EUR/line.',
    housingNotes: 'No property tax. Stamp duty on rental agreements.',
    leaseTerms: '1-year lease common. 1 month deposit typical.',
    marketNotes: 'Rental market competitive. Prices rising in popular areas.',
    healthcareSystem: 'Government health service (free)',
    hairNotes: 'Good variety. Reasonable prices.',
  },
  Ireland: {
    pharmacyNote: 'Pharmacies widely available. Late-night pharmacies in cities.',
    prescriptionSystem: 'Prescription from GP. Medical card or Drug Payment Scheme for subsidized medications.',
    insuranceCoverage: 'Drug Payment Scheme caps monthly spend at 80 EUR per family. Medical card holders get free medications.',
    visionInsurance: 'Medical card covers eye exams. PRSI covers some optical benefits.',
    visionWait: '4-8 weeks through public system. Private available within days.',
    visionSenior: 'Regular screening recommended. Medical card covers necessary procedures.',
    dentalInsurance: 'DTSS provides limited dental for medical card holders. Private dental plans 20-40 EUR/mo.',
    dentalAvailability: 'Good in cities. More limited in rural areas. Waiting lists for public dental.',
    transitSystem: 'Dublin Bus, Luas tram, DART rail. Bus Eireann for regional.',
    seniorTransit: 'Free Travel Pass for everyone 66+ on all public transport.',
    rideShareNote: 'FreeNow for taxis. Uber limited to licensed taxi drivers.',
    walkability: 'Good in city centers. Rural areas require a car.',
    seniorMinAge: 66,
    discountNames: ['Free Travel Pass', 'Medical Card', 'Senior Citizens Grant'],
    discountDescs: [
      'Free travel on all public transport for 66+.',
      'Free GP visits, prescriptions, and hospital care for qualifying seniors.',
      'Housing aid grant for home improvements for seniors.',
    ],
    cellPlanName: 'Three / Vodafone / Eir',
    cellPlanNotes: 'Irish mobile market. Plans from 15-25 EUR/line.',
    housingNotes: 'LPT (Local Property Tax) is landlord responsibility. Rent Pressure Zones limit increases.',
    leaseTerms: '1-year lease with Part 4 tenancy rights after 6 months.',
    marketNotes: 'Rental market very tight. Rent Pressure Zones cap increases at 2% per year.',
    healthcareSystem: 'HSE public + private insurance',
    hairNotes: 'Good variety of salons. Higher prices than continental Europe.',
  },
};

const LATAM_COUNTRY_META: Record<string, Partial<CountryMeta>> = {
  Panama: {
    pharmacyNote: 'Farmacias Arrocha and Super Farmacia widely available. Many OTC medications. Pensionado 15% discount.',
    prescriptionSystem: 'Prescriptions from licensed doctors. Many medications available OTC. Pensionado 15% discount on prescriptions.',
    insuranceCoverage: 'Private insurance standard for expats. Plans $200-400/mo. 70-80% medication coverage after deductible.',
    visionInsurance: 'Private plans cover annual exams. Pensionado 15% discount on consultations.',
    visionWait: '1-2 weeks for private ophthalmologists. Same-day sometimes available.',
    visionSenior: 'Excellent private ophthalmology. Cataract surgery 50-60% cheaper than US. Pensionado discount.',
    dentalInsurance: 'Dental insurance $30-60/mo. Pensionado 15% discount on all dental. 50-60% cheaper than US.',
    dentalAvailability: 'Excellent. Many US-trained dentists. English widely spoken.',
    transitSystem: 'Metro lines and MetroBus. RapiPass card system.',
    seniorTransit: 'Pensionado/jubilado RapiPass for free metro and bus.',
    rideShareNote: 'Uber and DiDi available. Yellow taxis use zones. InDriver for negotiated fares.',
    walkability: 'Moderate. Walkable in some neighborhoods. Hot climate limits walking.',
    seniorMinAge: 55,
    discountNames: ['Pensionado Visa', 'Jubilado Discounts', 'Senior Healthcare'],
    discountDescs: [
      'Pensionado visa with 15% discount on medical, dental, restaurants, utilities.',
      'Jubilado discounts 10-25% at restaurants, entertainment, and utilities by law.',
      'Affordable private healthcare 40-70% cheaper than US.',
    ],
    cellPlanName: '+Movil / Tigo',
    cellPlanNotes: 'Panama mobile market. Plans from $10-25/line. USD pricing.',
    housingNotes: 'No property tax for first 20 years on new construction. Panama uses USD.',
    leaseTerms: '1-year lease typical. 1-3 months deposit. Flexible terms for expats.',
    marketNotes: 'Active rental market. Good availability in expat-popular areas.',
    healthcareSystem: 'Private insurance + CSS public option',
    hairNotes: 'Affordable salons. Good variety in urban areas.',
  },
  Mexico: {
    pharmacyNote: 'Farmacias del Ahorro, Benavides widely available. Many OTC medications. Very affordable.',
    prescriptionSystem: 'Prescriptions from licensed doctors. Many medications available without prescription. Very low prices.',
    insuranceCoverage: 'IMSS public system or private insurance $100-300/mo. Medications very affordable out-of-pocket.',
    visionInsurance: 'IMSS covers basic eye exams. Private affordable. Salud Digna low-cost clinics.',
    visionWait: '1-2 weeks private. Public system longer waits.',
    visionSenior: 'Affordable eye care. INAPAM card for senior discounts.',
    dentalInsurance: 'IMSS covers basic dental. Private very affordable. Mexico is a dental tourism hub.',
    dentalAvailability: 'Excellent. Very competitive pricing. Many US-trained dentists in border/tourist areas.',
    transitSystem: 'Metro and bus in major cities. Colectivos and combis for local transport.',
    seniorTransit: 'INAPAM card gives free or reduced transit for 60+.',
    rideShareNote: 'Uber, DiDi, and InDriver widely available. Very affordable.',
    walkability: 'Good in city centers and colonial towns. Varies by location.',
    seniorMinAge: 60,
    discountNames: ['INAPAM Card', 'IMSS Coverage', 'Senior Cultural Pass'],
    discountDescs: [
      'National senior card (60+) for discounts on transport, medications, entertainment.',
      'Public health insurance covering doctor visits, medications, hospital stays.',
      'Free or reduced admission to museums and cultural sites.',
    ],
    cellPlanName: 'Telcel / AT&T Mexico',
    cellPlanNotes: 'Mexican mobile market. Plans from $8-20/line. Very competitive.',
    housingNotes: 'Predial (property tax) very low. Landlord responsibility.',
    leaseTerms: '1-year lease typical. 1-2 months deposit. Flexible terms.',
    marketNotes: 'Active rental market. Very affordable in most areas. Expat areas slightly higher.',
    healthcareSystem: 'IMSS (public) + private insurance',
    hairNotes: 'Very affordable salons. Good variety.',
  },
  'Costa Rica': {
    pharmacyNote: 'Farmacias widely available. Farmacia Chavarria, Fischel chains. Affordable medications.',
    prescriptionSystem: 'Prescriptions from CAJA or private doctors. CAJA system provides medications at low cost.',
    insuranceCoverage: 'CAJA public system covers medications. Private insurance $150-350/mo. Good generic availability.',
    visionInsurance: 'CAJA covers basic eye exams. Private affordable.',
    visionWait: '2-4 weeks through CAJA. Private available within days.',
    visionSenior: 'Affordable eye care. Ciudadano de Oro (Golden Citizen) card for 65+.',
    dentalInsurance: 'CAJA covers basic dental. Private very affordable.',
    dentalAvailability: 'Good. Growing dental tourism. Many bilingual dentists.',
    transitSystem: 'Bus networks in San Jose and major cities. No metro/rail system.',
    seniorTransit: 'Ciudadano de Oro card for reduced bus fares.',
    rideShareNote: 'Uber available but in legal gray area. DiDi growing. Red taxis regulated.',
    walkability: 'Moderate. Central Valley towns walkable. Beach areas vary.',
    seniorMinAge: 65,
    discountNames: ['Ciudadano de Oro', 'CAJA Coverage', 'Pensionado Visa'],
    discountDescs: [
      'Golden Citizen card (65+) for discounts on utilities, transport, entertainment.',
      'Public health system covering doctor visits, medications, hospital stays.',
      'Pensionado visa with tax benefits and residency rights.',
    ],
    cellPlanName: 'Kolbi / Claro / Movistar',
    cellPlanNotes: 'Costa Rican mobile market. Plans from $10-20/line.',
    housingNotes: 'Property tax very low (0.25% of assessed value). Landlord responsibility.',
    leaseTerms: '3-year minimum lease by law. 1 month deposit.',
    marketNotes: 'Active rental market. Central Valley most affordable. Beach areas higher.',
    healthcareSystem: 'CAJA (public) + private insurance',
    hairNotes: 'Affordable salons. Good variety in San Jose metro area.',
  },
  Colombia: {
    pharmacyNote: 'Farmatodo and Drogueria widely available. Very affordable medications.',
    prescriptionSystem: 'Prescriptions from EPS or private doctors. EPS system provides medications.',
    insuranceCoverage: 'EPS public system covers many medications. Private plans $100-250/mo. Very affordable OOP.',
    visionInsurance: 'EPS covers basic eye exams. Private very affordable.',
    visionWait: '1-3 weeks through EPS. Private available quickly.',
    visionSenior: 'Affordable eye care. Colombia is a medical tourism hub.',
    dentalInsurance: 'EPS covers basic dental. Private dental very affordable and high quality.',
    dentalAvailability: 'Excellent. Many modern clinics. Competitive pricing.',
    transitSystem: 'TransMilenio in Bogota. Metro in Medellin. Bus networks.',
    seniorTransit: 'Senior discounts on public transit in most cities.',
    rideShareNote: 'Uber, DiDi, InDriver widely available. Very affordable.',
    walkability: 'Good in city centers. Medellin famous for walkability.',
    seniorMinAge: 62,
    discountNames: ['EPS Health Card', 'Senior Transit Discount', 'Cultural Discounts'],
    discountDescs: [
      'Public health system card for subsidized healthcare.',
      'Reduced transit fares for seniors 62+.',
      'Free or reduced admission to museums and cultural sites.',
    ],
    cellPlanName: 'Claro / Movistar / Tigo',
    cellPlanNotes: 'Colombian mobile market. Plans from $8-15/line. Very affordable.',
    housingNotes: 'Predial (property tax) landlord responsibility. Estrato system affects utility costs.',
    leaseTerms: '1-year lease typical. 1-2 months deposit.',
    marketNotes: 'Very affordable. Active rental market. Estrato system means tiered pricing.',
    healthcareSystem: 'EPS (public) + private insurance',
    hairNotes: 'Very affordable salons. Excellent variety.',
  },
  Ecuador: {
    pharmacyNote: 'Farmacias widely available. Fybeca and Pharmacys chains. Affordable medications.',
    prescriptionSystem: 'Prescriptions from IESS or private doctors. IESS covers medications for enrolled.',
    insuranceCoverage: 'IESS public system covers medications. Private plans $100-250/mo. Very affordable OOP.',
    visionInsurance: 'IESS covers basic eye exams. Private affordable.',
    visionWait: '1-4 weeks through IESS. Private available quickly.',
    visionSenior: 'Affordable eye care. Cuenca has excellent medical facilities.',
    dentalInsurance: 'IESS covers basic dental. Private dental very affordable.',
    dentalAvailability: 'Good availability in cities. Cuenca especially popular for dental care.',
    transitSystem: 'Trolebus and Ecovia in Quito. Tranvia in Cuenca. Bus networks.',
    seniorTransit: 'Seniors 65+ ride free or half-fare on most transit. Reduced domestic flights.',
    rideShareNote: 'InDriver popular. Uber in Quito/Guayaquil. Taxis very affordable.',
    walkability: 'Good in city centers. Cuenca very walkable. Altitude affects comfort.',
    seniorMinAge: 65,
    discountNames: ['Senior Card', 'IESS Coverage', 'Tax Benefits'],
    discountDescs: [
      'Seniors 65+ get 50% discount on utilities, transit, entertainment by law.',
      'Public health system covering doctor visits, medications.',
      'Tax exemptions on property and income for seniors.',
    ],
    cellPlanName: 'Claro / Movistar / CNT',
    cellPlanNotes: 'Ecuadorian mobile market. Plans from $10-20/line. USD pricing.',
    housingNotes: 'Low property tax. Ecuador uses USD. Very affordable.',
    leaseTerms: '1-year lease typical. 1-2 months deposit.',
    marketNotes: 'Very affordable rental market. Cuenca and coastal areas popular with expats.',
    healthcareSystem: 'IESS (public) + private insurance',
    hairNotes: 'Very affordable salons. Good variety in cities.',
  },
  Uruguay: {
    pharmacyNote: 'Farmacias widely available. Affordable medications.',
    prescriptionSystem: 'Prescriptions from FONASA or private doctors. FONASA covers medications.',
    insuranceCoverage: 'FONASA public system covers medications. Private mutualistas $100-200/mo.',
    visionInsurance: 'FONASA covers basic eye exams. Private available.',
    visionWait: '2-4 weeks through public system. Private available quickly.',
    visionSenior: 'Affordable eye care. Good medical facilities in Montevideo.',
    dentalInsurance: 'Basic dental through public system. Private affordable.',
    dentalAvailability: 'Good in Montevideo. More limited in smaller cities.',
    transitSystem: 'Bus network in Montevideo. Intercity buses connect cities.',
    seniorTransit: 'Reduced fares for seniors on public transit.',
    rideShareNote: 'Uber and Cabify available. Taxis affordable.',
    walkability: 'Good in Montevideo and Punta del Este. Car needed elsewhere.',
    seniorMinAge: 65,
    discountNames: ['BPS Benefits', 'Senior Transit', 'Cultural Discounts'],
    discountDescs: [
      'Social security benefits and healthcare coverage.',
      'Reduced transit fares for seniors.',
      'Discounts on cultural activities.',
    ],
    cellPlanName: 'Antel / Movistar / Claro',
    cellPlanNotes: 'Uruguayan mobile market. Plans from $10-20/line. USD pricing.',
    housingNotes: 'Property tax (contribucion inmobiliaria) landlord responsibility.',
    leaseTerms: '2-year lease typical. 2-3 months deposit or bank guarantee.',
    marketNotes: 'Active rental market. Montevideo most options. Beach areas seasonal.',
    healthcareSystem: 'FONASA (public) + private mutualistas',
    hairNotes: 'Good variety of salons. Moderate prices.',
  },
};

// Default EU meta fallback
const EU_DEFAULT_META: CountryMeta = {
  pharmacyNote: 'Pharmacies widely available. Duty pharmacy system for after-hours.',
  prescriptionSystem: 'Prescription from public health system doctor required.',
  insuranceCoverage: 'Public health system covers most prescriptions with copay. Supplementary insurance available.',
  visionInsurance: 'Public system covers basic eye exams. Private insurance available for glasses/contacts.',
  visionWait: '2-4 weeks for ophthalmologist through public system. Private available within days.',
  visionSenior: 'Regular eye exams recommended. Public system covers medically necessary procedures.',
  dentalInsurance: 'Limited public dental. Private dental plans available and affordable.',
  dentalAvailability: 'Good availability in cities.',
  transitSystem: 'Bus and rail networks. Good intercity connections.',
  seniorTransit: 'Reduced fares for seniors on public transit.',
  rideShareNote: 'Ride-share apps available in cities. Taxis regulated.',
  walkability: 'Generally walkable city centers.',
  seniorMinAge: 65,
  discountNames: ['Public Health Card', 'Senior Transit Pass', 'Cultural Discounts'],
  discountDescs: [
    'Public health system card for subsidized healthcare.',
    'Reduced transit fares for seniors.',
    'Reduced admission to cultural sites.',
  ],
  cellPlanName: 'Local Carrier',
  cellPlanNotes: 'Competitive EU mobile market with EU roaming.',
  housingNotes: 'Property tax is landlord responsibility. EU rental protections apply.',
  leaseTerms: '1-year lease typical. 1-2 months deposit.',
  marketNotes: 'Active rental market.',
  healthcareSystem: 'Public health system + optional private',
  hairNotes: 'Salons widely available.',
};

const LATAM_DEFAULT_META: CountryMeta = {
  pharmacyNote: 'Pharmacies widely available. Many medications available without prescription.',
  prescriptionSystem: 'Prescriptions from licensed doctors. Many medications affordable OOP.',
  insuranceCoverage: 'Private insurance standard for expats. Public system available for residents.',
  visionInsurance: 'Private insurance covers eye exams. Affordable without insurance.',
  visionWait: '1-2 weeks for appointments.',
  visionSenior: 'Affordable eye care. Significant savings vs US prices.',
  dentalInsurance: 'Private dental affordable. Significant savings vs US prices.',
  dentalAvailability: 'Good availability. Many English-speaking dentists.',
  transitSystem: 'Bus networks. Metro in some cities.',
  seniorTransit: 'Senior discounts on public transit available.',
  rideShareNote: 'Uber/DiDi/InDriver available. Taxis affordable.',
  walkability: 'Varies by location. City centers generally walkable.',
  seniorMinAge: 60,
  discountNames: ['Senior Card', 'Healthcare Access', 'Utility Discounts'],
  discountDescs: [
    'Senior discounts on various services.',
    'Affordable healthcare access.',
    'Discounts on utilities for seniors.',
  ],
  cellPlanName: 'Local Carrier',
  cellPlanNotes: 'Affordable mobile plans. USD pricing in dollarized economies.',
  housingNotes: 'Property tax is landlord responsibility. Generally low.',
  leaseTerms: '1-year lease typical. 1-2 months deposit.',
  marketNotes: 'Active rental market. Good value.',
  healthcareSystem: 'Public + private insurance',
  hairNotes: 'Affordable salons available.',
};

function getMeta(loc: LocationSeed): CountryMeta {
  if (loc.currency === 'USD' && (loc.country === 'United States' || loc.region?.includes('US'))) {
    return US_META;
  }
  if (loc.currency === 'EUR') {
    return { ...EU_DEFAULT_META, ...(EU_COUNTRY_META[loc.country] || {}) };
  }
  return { ...LATAM_DEFAULT_META, ...(LATAM_COUNTRY_META[loc.country] || {}) };
}

function getTemplate(loc: LocationSeed): Record<string, any> {
  if (loc.currency === 'USD' && (loc.country === 'United States' || loc.region?.includes('US'))) return usTemplate;
  if (loc.currency === 'EUR') return euTemplate;
  return latamTemplate;
}

function getRefCosts(loc: LocationSeed): Record<string, number> {
  if (loc.currency === 'USD' && (loc.country === 'United States' || loc.region?.includes('US'))) return usRefCosts;
  if (loc.currency === 'EUR') return euRefCosts;
  return latamRefCosts;
}

function costRatio(loc: LocationSeed, category: string, refCosts: Record<string, number>): number {
  const locVal = loc.monthlyCosts?.[category]?.typical ?? refCosts[category] ?? 100;
  const refVal = refCosts[category] ?? 100;
  return refVal > 0 ? locVal / refVal : 1;
}

// ---------- Generator ----------

function generateDetailedCosts(loc: LocationSeed): Record<string, any> {
  const template = getTemplate(loc);
  const refCosts = getRefCosts(loc);
  const meta = getMeta(loc);
  const isUS = loc.currency === 'USD' && (loc.country === 'United States' || loc.region?.includes('US'));
  const isEU = loc.currency === 'EUR';
  const isLatam = !isUS && !isEU;

  const medRatio = costRatio(loc, 'medicine', refCosts);
  const healthRatio = costRatio(loc, 'healthcare', refCosts);
  const entRatio = costRatio(loc, 'entertainment', refCosts);
  const transRatio = costRatio(loc, 'transportation', refCosts);
  const grocRatio = costRatio(loc, 'groceries', refCosts);
  const rentRatio = costRatio(loc, 'rent', refCosts);
  const phoneRatio = costRatio(loc, 'phoneCell', refCosts);
  const careRatio = costRatio(loc, 'personalCare', refCosts);
  const clothRatio = costRatio(loc, 'clothing', refCosts);
  const overallRatio = (medRatio + entRatio + transRatio + grocRatio + rentRatio) / 5;

  const cityName = loc.cities?.[0] || loc.name.split(',')[0].trim();

  // ---- Medicine ----
  const tplMed = template.medicine;
  const medicine: Record<string, any> = {
    monthlyPrescriptionCosts: scaleMinTypMax(tplMed.monthlyPrescriptionCosts, medRatio),
    commonMedications: tplMed.commonMedications.map((med: any) => ({
      name: med.name,
      monthlyCost: ri(med.monthlyCost * medRatio),
      withoutInsurance: ri(med.withoutInsurance * medRatio),
      coverageNote: med.coverageNote,
    })),
    pharmacyAccess: meta.pharmacyNote.replace(/Northern Virginia|NoVA/g, cityName),
    prescriptionSystem: meta.prescriptionSystem,
    insuranceCoverage: meta.insuranceCoverage,
    sources: tplMed.sources || [],
  };

  // ---- Vision ----
  const tplVis = template.vision;
  const visionScale = clamp(healthRatio, 0.3, 3);
  const vision: Record<string, any> = {
    annualExamCost: {
      withInsurance: ri(tplVis.annualExamCost.withInsurance * visionScale),
      withoutInsurance: ri(tplVis.annualExamCost.withoutInsurance * visionScale),
      notes: tplVis.annualExamCost.notes,
    },
    eyeglasses: {
      basicFrameAndLens: scaleMinTypMax(tplVis.eyeglasses.basicFrameAndLens, visionScale),
      progressiveLens: scaleMinTypMax(tplVis.eyeglasses.progressiveLens, visionScale),
      contactLensesMonthly: scaleMinTypMax(tplVis.eyeglasses.contactLensesMonthly, visionScale),
    },
    insuranceCoverage: meta.visionInsurance,
    specialistWaitTime: meta.visionWait.replace(/Northern Virginia|NoVA/g, cityName),
    seniorConsiderations: meta.visionSenior,
    sources: tplVis.sources || [],
  };

  // ---- Dental ----
  const tplDen = template.dental;
  const dentalScale = clamp(healthRatio, 0.3, 3);
  const dental: Record<string, any> = {
    annualCleaningCost: {
      withInsurance: ri(tplDen.annualCleaningCost.withInsurance * dentalScale),
      withoutInsurance: ri(tplDen.annualCleaningCost.withoutInsurance * dentalScale),
      notes: tplDen.annualCleaningCost.notes,
    },
    commonProcedures: tplDen.commonProcedures.map((proc: any) => {
      // Handle both US format (name/withInsurance/withoutInsurance) and EU/LATAM format (procedure/cost)
      if (proc.name) {
        return {
          name: proc.name,
          withInsurance: ri(proc.withInsurance * dentalScale),
          withoutInsurance: ri(proc.withoutInsurance * dentalScale),
        };
      }
      return {
        procedure: proc.procedure,
        cost: scaleMinTypMax(proc.cost, dentalScale),
        coverageNote: proc.coverageNote,
      };
    }),
    insuranceCoverage: meta.dentalInsurance,
    dentistAvailability: meta.dentalAvailability.replace(/Northern Virginia|NoVA/g, cityName),
    sources: tplDen.sources || [],
  };

  // ---- Entertainment ----
  const tplEnt = template.entertainment;
  const diningScale = clamp(entRatio, 0.4, 3);
  // Streaming prices are mostly global
  const netflixPrice = isUS ? 18 : isEU ? 16 : 14;
  const primePrice = isUS ? 15 : isEU ? 8 : 7;
  const appleTvPrice = isUS ? 13 : isEU ? 11 : 10;

  const entCategories = tplEnt.categories.map((cat: any) => {
    let cost = cat.monthlyCost;
    const name = cat.name;
    if (name === 'Dining Out') {
      cost = ri(cat.monthlyCost * diningScale);
    } else if (name.includes('Netflix')) {
      cost = netflixPrice;
    } else if (name.includes('Amazon Prime')) {
      cost = primePrice;
    } else if (name.includes('Apple TV')) {
      cost = appleTvPrice;
    } else if (name.includes('Cable') || name.includes('Internet')) {
      cost = ri(cat.monthlyCost * clamp(entRatio, 0.5, 2));
    } else if (name.includes('Gym') || name.includes('Fitness')) {
      cost = ri(cat.monthlyCost * clamp(overallRatio, 0.4, 2));
    } else if (name.includes('Coffee') || name.includes('Cafe')) {
      cost = ri(cat.monthlyCost * clamp(diningScale, 0.4, 2));
    } else if (name.includes('Books') || name.includes('Library') || name.includes('Media')) {
      cost = ri(cat.monthlyCost * clamp(overallRatio, 0.5, 2));
    } else if (name.includes('Parks') || name.includes('Outdoors')) {
      cost = ri(cat.monthlyCost * clamp(overallRatio, 0.5, 1.5));
    } else if (name.includes('NFL') || name.includes('RedZone')) {
      cost = ri(cat.monthlyCost * 1); // Fixed global price
    } else {
      cost = ri(cat.monthlyCost * entRatio);
    }
    return {
      name: cat.name,
      monthlyCost: cost,
      seniorDiscounts: cat.seniorDiscounts || '',
      notes: cat.notes || '',
    };
  });

  const entTotal = entCategories.reduce((s: number, c: any) => s + c.monthlyCost, 0);
  const entertainment: Record<string, any> = {
    monthlyBudget: {
      min: ri(entTotal * 0.8),
      typical: ri(entTotal),
      max: ri(entTotal * 1.25),
    },
    categories: entCategories,
    sources: tplEnt.sources || [],
  };

  // ---- Transportation ----
  const tplTrans = template.transportation;
  const tScale = clamp(transRatio, 0.2, 3);
  const transportation: Record<string, any> = {
    monthlyBudget: scaleMinTypMax(tplTrans.monthlyBudget, tScale),
    publicTransit: {
      monthlyPass: {
        regular: ri(tplTrans.publicTransit.monthlyPass.regular * tScale),
        senior: ri(tplTrans.publicTransit.monthlyPass.senior * tScale),
        notes: meta.transitSystem,
      },
      singleRide: r(tplTrans.publicTransit.singleRide * tScale),
      coverage: meta.transitSystem,
      seniorDiscount: meta.seniorTransit,
    },
    rideShare: {
      baseFare: r(tplTrans.rideShare.baseFare * tScale),
      perKm: r(tplTrans.rideShare.perKm * tScale),
      typicalCrossTownTrip: scaleMinTypMax(tplTrans.rideShare.typicalCrossTownTrip, tScale),
      availability: meta.rideShareNote.replace(/Northern Virginia|NoVA/g, cityName),
      notes: meta.rideShareNote,
    },
    carOwnership: {
      registration: {
        annualCost: ri(tplTrans.carOwnership.registration.annualCost * tScale),
        initialRegistration: scaleMinTypMax(tplTrans.carOwnership.registration.initialRegistration, tScale),
        notes: '',
      },
      insurance: {
        monthlyMin: ri(tplTrans.carOwnership.insurance.monthlyMin * tScale),
        monthlyTypical: ri(tplTrans.carOwnership.insurance.monthlyTypical * tScale),
        monthlyMax: ri(tplTrans.carOwnership.insurance.monthlyMax * tScale),
        notes: '',
      },
      fuel: {
        pricePerLiter: r(tplTrans.carOwnership.fuel.pricePerLiter * tScale),
        monthlyEstimate: scaleMinTypMax(tplTrans.carOwnership.fuel.monthlyEstimate, tScale),
        notes: '',
      },
      parking: {
        monthlyResident: scaleMinTypMax(tplTrans.carOwnership.parking.monthlyResident, tScale),
        hourlyStreet: r(tplTrans.carOwnership.parking.hourlyStreet * tScale),
        notes: '',
      },
      ...(tplTrans.carOwnership.tolls
        ? { tolls: { monthlyEstimate: ri(tplTrans.carOwnership.tolls.monthlyEstimate * tScale), notes: '' } }
        : {}),
      seniorDiscounts: meta.seniorTransit,
    },
    walkability: meta.walkability,
    cycling: tplTrans.cycling
      ? {
          bikeShareMonthly: ri((tplTrans.cycling.bikeShareMonthly || 8) * tScale),
          infrastructure: 'Bicycle infrastructure available in urban areas.',
          notes: '',
        }
      : undefined,
    sources: tplTrans.sources || [],
  };
  // Add controle technique for France
  if (loc.country === 'France' && tplTrans.carOwnership.contrôleTechnique) {
    transportation.carOwnership.contrôleTechnique = {
      cost: ri(tplTrans.carOwnership.contrôleTechnique.cost * tScale),
      frequency: tplTrans.carOwnership.contrôleTechnique.frequency,
      notes: tplTrans.carOwnership.contrôleTechnique.notes,
    };
  }

  // ---- Senior Discounts ----
  const seniorDiscounts: Record<string, any> = {
    minimumAge: meta.seniorMinAge,
    discounts: meta.discountNames.map((name: string, i: number) => ({
      name,
      description: meta.discountDescs[i] || '',
      eligibilityAge: meta.seniorMinAge,
    })),
  };

  // ---- Cell Phone ----
  const tplCell = template.cellPhone;
  const cellScale = clamp(phoneRatio, 0.3, 3);
  const cellBudget = scaleMinTypMax(tplCell.monthlyBudget, cellScale);
  const cellPhone: Record<string, any> = {
    monthlyBudget: cellBudget,
    plans: [
      {
        name: isUS ? 'T-Mobile 55+ Essentials' : meta.cellPlanName,
        type: isUS ? 'US Domestic' : 'Local',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: ri(cellBudget.typical * 0.85),
        taxesAndFees: ri(cellBudget.typical * 0.15),
        monthlyTotal: cellBudget.typical,
        notes: meta.cellPlanNotes,
      },
      {
        name: isUS ? 'T-Mobile 55+ Unlimited Plus' : `${meta.cellPlanName} Premium`,
        type: isUS ? 'US Domestic' : 'Local Premium',
        lines: 2,
        dataPerLine: 'Unlimited (100GB priority)',
        baseCost: ri(cellBudget.max * 0.85),
        taxesAndFees: ri(cellBudget.max * 0.15),
        monthlyTotal: cellBudget.max,
        notes: 'Premium plan with higher data priority and additional perks.',
      },
    ],
    sources: tplCell.sources || [],
  };

  // ---- Housing ----
  const tplHousing = template.housing;
  const hScale = clamp(rentRatio, 0.2, 5);
  const baseRent = ri(tplHousing.breakdown.baseRent * hScale);
  const rentersIns = ri(tplHousing.breakdown.rentersInsurance * hScale);
  const localFees = ri((tplHousing.breakdown.localTaxesFees || 0) * hScale);
  const housing: Record<string, any> = {
    propertyType: '2-bedroom single-family house',
    monthlyBudget: {
      min: ri(tplHousing.monthlyBudget.min * hScale),
      typical: ri(tplHousing.monthlyBudget.typical * hScale),
      max: ri(tplHousing.monthlyBudget.max * hScale),
    },
    breakdown: {
      baseRent,
      rentersInsurance: rentersIns,
      localTaxesFees: localFees,
      total: baseRent + rentersIns + localFees,
      notes: tplHousing.breakdown.notes || 'Water, sewage, and trash are separate utility bills.',
    },
    taxNotes: meta.housingNotes,
    leaseTerms: meta.leaseTerms,
    marketNotes: meta.marketNotes.replace(/NoVA|Northern Virginia|Fairfax County/g, cityName),
    sources: tplHousing.sources || [],
  };

  // ---- Groceries ----
  const tplGroc = template.groceries;
  const gScale = clamp(grocRatio, 0.3, 3);
  const groceries: Record<string, any> = {
    categories: tplGroc.categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      items: cat.items.map((item: any) => ({
        name: item.name,
        monthlyCost: ri(item.monthlyCost * gScale),
        quantity: item.quantity,
        unit: item.unit,
        forWhom: item.forWhom,
        notes: item.notes || '',
      })),
    })),
    monthlyTotal: ri((tplGroc.monthlyTotal || 712) * gScale),
  };

  // ---- Personal Care ----
  const pcScale = clamp(careRatio, 0.3, 3);
  const personalCare: Record<string, any> = {
    blackHairCare: {
      label: 'Black Hair Care',
      priceRange: {
        cut: scaleRange('35-65', pcScale),
        color: scaleRange('85-150', pcScale),
        fullService: scaleRange('120-250', pcScale),
      },
      notes: `${meta.hairNotes} ${cityName} area.`,
      providers: [],
    },
    whiteHairCare: {
      label: 'White/Caucasian Hair Care',
      priceRange: {
        cut: scaleRange('30-55', pcScale),
        color: scaleRange('80-150', pcScale),
        highlights: scaleRange('120-200', pcScale),
      },
      notes: `${meta.hairNotes} ${cityName} area.`,
      providers: [],
    },
    mensBigTall: {
      label: "Men's Big & Tall Clothing",
      priceRange: {
        shirts: scaleRange('30-80', clothRatio),
        pants: scaleRange('40-70', clothRatio),
        suits: scaleRange('150-400', clothRatio),
      },
      notes: isUS
        ? 'DXL and Nordstrom for in-store. Amazon and King Size for online.'
        : isEU
          ? 'Kiabi, C&A, and online retailers for extended sizes.'
          : 'Local markets and online retailers. Limited specialty stores.',
      providers: [],
    },
    womensClothing: {
      label: "Women's Regular Clothing",
      priceRange: {
        casual: scaleRange('25-60', clothRatio),
        dresses: scaleRange('50-120', clothRatio),
        professional: scaleRange('60-150', clothRatio),
      },
      notes: isUS
        ? 'Good shopping variety from budget to mid-range options.'
        : isEU
          ? 'H&M, Zara, local boutiques. Good variety at competitive prices.'
          : 'Local shops and markets. International brands in malls.',
      providers: [],
    },
    shoes: {
      label: 'Shoes',
      priceRange: {
        casual: scaleRange('40-90', clothRatio),
        dress: scaleRange('70-150', clothRatio),
        athletic: scaleRange('60-130', clothRatio),
        wideWidth: scaleRange('50-120', clothRatio),
      },
      notes: isUS
        ? 'DSW, Nordstrom Rack for variety including wide widths.'
        : isEU
          ? 'Variety of shoe stores. European sizing. Good quality.'
          : 'Local shops and international chains in malls.',
      providers: [],
    },
  };

  return {
    medicine,
    vision,
    dental,
    entertainment,
    transportation,
    seniorDiscounts,
    cellPhone,
    housing,
    groceries,
    personalCare,
  };
}

function scaleRange(range: string, factor: number): string {
  const [lo, hi] = range.split('-').map(Number);
  return `${ri(lo * factor)}-${ri(hi * factor)}`;
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\nDetailed-Costs Generator for 118 Seed Locations`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE (writing to database)'}\n`);

  // Load seed files
  const files = ['seed-locations-us.json', 'seed-locations-eu.json', 'seed-locations-latam.json'];
  const allLocations: LocationSeed[] = [];

  for (const file of files) {
    const filePath = join(__dirname, file);
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LocationSeed[];
    console.log(`  ${file}: ${data.length} locations`);
    allLocations.push(...data);
  }

  console.log(`  Total: ${allLocations.length} locations\n`);

  let success = 0;
  let errors = 0;

  for (let i = 0; i < allLocations.length; i++) {
    const loc = allLocations[i];
    const pct = Math.round(((i + 1) / allLocations.length) * 100);

    try {
      const detailedCosts = generateDetailedCosts(loc);

      if (dryRun) {
        const sections = Object.keys(detailedCosts);
        console.log(`  [${pct}%] ${loc.id} — ${sections.length} sections generated`);
      } else {
        await prisma.adminLocationSupplement.upsert({
          where: { locationId_dataType: { locationId: loc.id, dataType: 'detailed-costs' } },
          create: { locationId: loc.id, dataType: 'detailed-costs', data: detailedCosts },
          update: { data: detailedCosts },
        });
        console.log(`  [${pct}%] ${loc.id} — upserted`);
      }
      success++;
    } catch (err) {
      console.error(`  [${pct}%] ${loc.id} — ERROR: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\nComplete: ${success} succeeded, ${errors} errors.`);
  if (dryRun) {
    console.log('DRY RUN — no database writes. Remove --dry-run to write.\n');
  }
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
