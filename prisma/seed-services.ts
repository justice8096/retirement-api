/**
 * Seed script: generates services + attractions data for all 118 new locations
 * and upserts into adminLocationSupplement with dataType = 'services'.
 *
 * Usage:
 *   npx tsx prisma/seed-services.ts              # Run
 *   npx tsx prisma/seed-services.ts --dry-run    # Preview without writing
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  cities: string[];
  currency: string;
  [key: string]: unknown;
}

interface Service {
  categoryId: string;
  name: string;
  distanceKm: number;
  notes: string;
}

interface Attraction {
  type: string;
  name: string;
  description: string;
  distanceKm: number;
  estimatedCostUSD?: number;
  estimatedCostEUR?: number;
  frequency: string;
}

// ─── Deterministic seeded random (simple LCG) ────────────────────────────────

function makeRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(h) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randBetween(rng: () => number, min: number, max: number): number {
  return Math.round((min + rng() * (max - min)) * 10) / 10;
}

// ─── Country-specific naming patterns ────────────────────────────────────────

interface CountryConfig {
  hospital: (city: string) => string;
  hospitalNote: string;
  pharmacy: (city: string) => string;
  pharmacyNote: string;
  grocery: (city: string) => string;
  groceryNote: string;
  bank: (city: string) => string;
  bankNote: string;
  doctor: (city: string) => string;
  doctorNote: string;
  dentist: (city: string) => string;
  dentistNote: string;
  vet: (city: string) => string;
  vetNote: string;
  dogPark: (city: string) => string;
  dogParkNote: string;
  gym: (city: string) => string;
  gymNote: string;
  airport: (city: string) => string;
  airportNote: string;
  transit: (city: string) => string;
  transitNote: string;
}

const countryConfigs: Record<string, CountryConfig> = {
  'United States': {
    hospital: (c) => `${c} Regional Medical Center`,
    hospitalNote: 'Full-service hospital with emergency department, accepts Medicare',
    pharmacy: (c) => `CVS Pharmacy — ${c}`,
    pharmacyNote: '24-hour pharmacy with drive-through, vaccinations available',
    grocery: (c) => `Kroger — ${c}`,
    groceryNote: 'Full-service supermarket with pharmacy and deli',
    bank: (c) => `Bank of America — ${c}`,
    bankNote: 'Full-service branch with ATM, financial advisors available',
    doctor: (c) => `${c} Primary Care Associates`,
    doctorNote: 'Family medicine practice accepting new patients, Medicare accepted',
    dentist: (c) => `${c} Family Dentistry`,
    dentistNote: 'General and cosmetic dentistry, same-day appointments',
    vet: (c) => `${c} Animal Hospital`,
    vetNote: 'Full-service veterinary hospital with emergency referrals',
    dogPark: (c) => `${c} Community Dog Park`,
    dogParkNote: 'Fenced off-leash park with separate small and large dog areas',
    gym: (c) => `Planet Fitness — ${c}`,
    gymNote: 'Affordable gym with cardio equipment, strength training, group classes',
    airport: (c) => `${c} Regional Airport`,
    airportNote: 'Regional airport with domestic connections to major hubs',
    transit: (c) => `${c} Public Transit Center`,
    transitNote: 'Local bus service with connections to regional transit',
  },
  Portugal: {
    hospital: (c) => `Hospital Central de ${c}`,
    hospitalNote: 'SNS public hospital, emergency department, some English-speaking staff',
    pharmacy: (c) => `Farmácia Central de ${c}`,
    pharmacyNote: 'Pharmacy with extended hours, prescription medications, basic health checks',
    grocery: (c) => `Continente — ${c}`,
    groceryNote: 'Large supermarket chain with fresh produce, bakery, deli section',
    bank: (c) => `Millennium BCP — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff, ATM network',
    doctor: (c) => `Centro de Saúde de ${c}`,
    doctorNote: 'Public health center with GPs, appointments via SNS portal',
    dentist: (c) => `Clínica Dentária de ${c}`,
    dentistNote: 'Private dental practice, English available by appointment',
    vet: (c) => `Clínica Veterinária de ${c}`,
    vetNote: 'Full-service veterinary clinic with emergency referrals',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Fenced dog exercise area, water fountains',
    gym: (c) => `Fitness Hut — ${c}`,
    gymNote: 'Modern fitness center with equipment, classes, and pool',
    airport: (c) => `Aeroporto de ${c}`,
    airportNote: 'Regional airport with European connections',
    transit: (c) => `Estação de ${c}`,
    transitNote: 'Train and bus station with regional connections',
  },
  Spain: {
    hospital: (c) => `Hospital General de ${c}`,
    hospitalNote: 'Public hospital under SNS, emergency department, European Health Insurance Card accepted',
    pharmacy: (c) => `Farmacia Central — ${c}`,
    pharmacyNote: 'Pharmacy with extended hours, prescription medications',
    grocery: (c) => `Mercadona — ${c}`,
    groceryNote: 'Large supermarket with fresh produce, bakery, competitive prices',
    bank: (c) => `CaixaBank — ${c}`,
    bankNote: 'Full-service bank with some English-speaking staff, ATM network',
    doctor: (c) => `Centro de Salud de ${c}`,
    doctorNote: 'Public health center, appointments via SAS/regional health portal',
    dentist: (c) => `Clínica Dental ${c}`,
    dentistNote: 'Private dental clinic, some English-speaking dentists',
    vet: (c) => `Clínica Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic with boarding',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Fenced off-leash area with shade and water',
    gym: (c) => `Basic-Fit — ${c}`,
    gymNote: 'Affordable gym with modern equipment and group classes',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic and European connections',
    transit: (c) => `Estación de ${c}`,
    transitNote: 'Bus and/or train station with intercity connections',
  },
  France: {
    hospital: (c) => `Centre Hospitalier de ${c}`,
    hospitalNote: 'Public hospital, urgences (emergency dept), Carte Vitale accepted',
    pharmacy: (c) => `Pharmacie Centrale de ${c}`,
    pharmacyNote: 'Pharmacy with extended hours, some English spoken',
    grocery: (c) => `Carrefour — ${c}`,
    groceryNote: 'Major supermarket with fresh produce, bakery, deli',
    bank: (c) => `BNP Paribas — ${c}`,
    bankNote: 'Full-service branch with English-speaking advisors available',
    doctor: (c) => `Maison de Santé de ${c}`,
    doctorNote: 'Multi-practitioner clinic, appointments via Doctolib',
    dentist: (c) => `Cabinet Dentaire de ${c}`,
    dentistNote: 'Dental practice, Doctolib booking available',
    vet: (c) => `Clinique Vétérinaire de ${c}`,
    vetNote: 'Full-service veterinary clinic with emergency care',
    dogPark: (c) => `Parc Canin de ${c}`,
    dogParkNote: 'Dog-friendly park with off-leash areas',
    gym: (c) => `Fitness Park — ${c}`,
    gymNote: 'Modern gym with 24/7 access, group classes',
    airport: (c) => `Aéroport de ${c}`,
    airportNote: 'Airport with domestic and European connections',
    transit: (c) => `Gare de ${c}`,
    transitNote: 'Train station with TGV and regional connections',
  },
  Greece: {
    hospital: (c) => `General Hospital of ${c}`,
    hospitalNote: 'ESY public hospital, emergency department, EHIC accepted',
    pharmacy: (c) => `Central Pharmacy — ${c}`,
    pharmacyNote: 'Pharmacy with prescription medications, rotating night service',
    grocery: (c) => `Sklavenitis — ${c}`,
    groceryNote: 'Major Greek supermarket chain with fresh produce and bakery',
    bank: (c) => `National Bank of Greece — ${c}`,
    bankNote: 'Full-service branch with ATM, English-speaking staff available',
    doctor: (c) => `${c} Health Center`,
    doctorNote: 'Public health center with GPs, some English-speaking doctors',
    dentist: (c) => `${c} Dental Clinic`,
    dentistNote: 'Private dental practice, English commonly spoken',
    vet: (c) => `${c} Veterinary Clinic`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `${c} Dog Park`,
    dogParkNote: 'Municipal dog-friendly area',
    gym: (c) => `Gym Station — ${c}`,
    gymNote: 'Fitness center with modern equipment and classes',
    airport: (c) => `${c} International Airport`,
    airportNote: 'Airport with European and seasonal international flights',
    transit: (c) => `${c} Bus Station (KTEL)`,
    transitNote: 'Intercity bus service with regional connections',
  },
  Italy: {
    hospital: (c) => `Ospedale Civile di ${c}`,
    hospitalNote: 'SSN public hospital, Pronto Soccorso (emergency), EHIC accepted',
    pharmacy: (c) => `Farmacia Centrale — ${c}`,
    pharmacyNote: 'Pharmacy with prescription medications, rotating night service',
    grocery: (c) => `Conad — ${c}`,
    groceryNote: 'Major Italian supermarket with fresh produce, bakery, deli',
    bank: (c) => `Intesa Sanpaolo — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff available at appointment',
    doctor: (c) => `ASL Ambulatorio di ${c}`,
    doctorNote: 'Public health service GP, appointments via regional ASL portal',
    dentist: (c) => `Studio Dentistico ${c}`,
    dentistNote: 'Private dental practice, some English-speaking dentists',
    vet: (c) => `Clinica Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic with emergency referrals',
    dogPark: (c) => `Area Cani ${c}`,
    dogParkNote: 'Municipal fenced dog exercise area',
    gym: (c) => `McFIT — ${c}`,
    gymNote: 'Affordable gym chain with modern equipment',
    airport: (c) => `Aeroporto di ${c}`,
    airportNote: 'Airport with domestic and European connections',
    transit: (c) => `Stazione di ${c}`,
    transitNote: 'Train station with Trenitalia and regional connections',
  },
  Ireland: {
    hospital: (c) => `University Hospital ${c}`,
    hospitalNote: 'HSE public hospital, emergency department, English-speaking',
    pharmacy: (c) => `Boots Pharmacy — ${c}`,
    pharmacyNote: 'Full-service pharmacy with prescription medications',
    grocery: (c) => `SuperValu — ${c}`,
    groceryNote: 'Major Irish supermarket with fresh produce and bakery',
    bank: (c) => `AIB — ${c}`,
    bankNote: 'Full-service bank with personal banking advisors',
    doctor: (c) => `${c} Medical Centre`,
    doctorNote: 'GP practice, appointments available, medical card accepted',
    dentist: (c) => `${c} Dental Surgery`,
    dentistNote: 'General dental practice, PRSI dental scheme accepted',
    vet: (c) => `${c} Veterinary Clinic`,
    vetNote: 'Full-service veterinary practice with emergency referrals',
    dogPark: (c) => `${c} Dog Park`,
    dogParkNote: 'Council-maintained off-leash dog area',
    gym: (c) => `Flyefit — ${c}`,
    gymNote: '24/7 gym with modern equipment and classes',
    airport: (c) => `${c} Airport`,
    airportNote: 'Airport with domestic and European connections',
    transit: (c) => `${c} Bus & Rail Station`,
    transitNote: 'Bus Éireann and Irish Rail connections',
  },
  Croatia: {
    hospital: (c) => `Opća bolnica ${c}`,
    hospitalNote: 'HZZO public hospital, emergency department, EHIC accepted',
    pharmacy: (c) => `Ljekarna — ${c}`,
    pharmacyNote: 'Pharmacy with prescription medications',
    grocery: (c) => `Konzum — ${c}`,
    groceryNote: 'Major Croatian supermarket chain with fresh produce',
    bank: (c) => `Zagrebačka banka — ${c}`,
    bankNote: 'Full-service bank, English available at larger branches',
    doctor: (c) => `Dom zdravlja ${c}`,
    doctorNote: 'Public health center with GPs, some English-speaking staff',
    dentist: (c) => `Stomatološka ordinacija ${c}`,
    dentistNote: 'Dental practice, affordable private dental tourism hub',
    vet: (c) => `Veterinarska ambulanta ${c}`,
    vetNote: 'Veterinary clinic with full services',
    dogPark: (c) => `Park za pse ${c}`,
    dogParkNote: 'Municipal dog exercise area',
    gym: (c) => `Fitness Centar — ${c}`,
    gymNote: 'Local gym with modern equipment',
    airport: (c) => `Zračna luka ${c}`,
    airportNote: 'Airport with European connections, seasonal charters',
    transit: (c) => `Autobusni kolodvor ${c}`,
    transitNote: 'Bus station with intercity and regional connections',
  },
  Cyprus: {
    hospital: (c) => `${c} General Hospital`,
    hospitalNote: 'GeSY public hospital, emergency department, EHIC accepted',
    pharmacy: (c) => `Central Pharmacy — ${c}`,
    pharmacyNote: 'Pharmacy with prescription medications, rotating schedule',
    grocery: (c) => `Alphamega — ${c}`,
    groceryNote: 'Major Cypriot supermarket with imported goods and fresh produce',
    bank: (c) => `Bank of Cyprus — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff',
    doctor: (c) => `${c} Medical Center`,
    doctorNote: 'Private medical center with English-speaking GPs',
    dentist: (c) => `${c} Dental Center`,
    dentistNote: 'Private dental clinic, English commonly spoken',
    vet: (c) => `${c} Veterinary Clinic`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `${c} Dog Park`,
    dogParkNote: 'Municipal dog-friendly area, limited but growing',
    gym: (c) => `Gold's Gym — ${c}`,
    gymNote: 'Well-equipped gym with group fitness classes',
    airport: (c) => `${c} International Airport`,
    airportNote: 'International airport with European connections year-round',
    transit: (c) => `${c} Bus Station`,
    transitNote: 'Intercity bus service, limited rail (bus-dependent island)',
  },
  Malta: {
    hospital: (c) => `Mater Dei Hospital`,
    hospitalNote: "Malta's main acute hospital, emergency department, English-speaking staff",
    pharmacy: (c) => `Brown's Pharmacy — ${c}`,
    pharmacyNote: 'Pharmacy chain with extended hours, English spoken',
    grocery: (c) => `Pavi Supermarket — ${c}`,
    groceryNote: 'Major Maltese supermarket with imported goods',
    bank: (c) => `Bank of Valletta — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff',
    doctor: (c) => `${c} Health Centre`,
    doctorNote: 'Government health center with GPs, English spoken',
    dentist: (c) => `${c} Dental Clinic`,
    dentistNote: 'Private dental clinic, English standard',
    vet: (c) => `${c} Veterinary Surgery`,
    vetNote: 'Full-service veterinary practice',
    dogPark: (c) => `${c} Dog Area`,
    dogParkNote: 'Designated dog-friendly area, limited spaces on the island',
    gym: (c) => `Body Zone — ${c}`,
    gymNote: 'Fitness center with equipment and classes',
    airport: (_c) => `Malta International Airport (MLA)`,
    airportNote: 'Single international airport serving all of Malta, European and North African routes',
    transit: (c) => `${c} Bus Hub`,
    transitNote: 'Malta Public Transport bus network, no rail system',
  },
  Panama: {
    hospital: (c) => `Hospital Nacional de ${c}`,
    hospitalNote: 'General hospital with emergency services, some English-speaking staff',
    pharmacy: (c) => `Farmacia Arrocha — ${c}`,
    pharmacyNote: 'Major pharmacy chain with prescription medications',
    grocery: (c) => `Super 99 — ${c}`,
    groceryNote: 'Major supermarket chain with imported and local goods',
    bank: (c) => `Banco General — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff available',
    doctor: (c) => `Centro Médico de ${c}`,
    doctorNote: 'Private medical center, some English-speaking doctors',
    dentist: (c) => `Clínica Dental ${c}`,
    dentistNote: 'Private dental practice, affordable by US standards',
    vet: (c) => `Clínica Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Dog-friendly park area',
    gym: (c) => `PowerClub — ${c}`,
    gymNote: 'Modern gym chain with equipment and classes',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic and international connections',
    transit: (c) => `Terminal de Buses de ${c}`,
    transitNote: 'Bus terminal with regional connections',
  },
  'Costa Rica': {
    hospital: (c) => `Hospital de ${c}`,
    hospitalNote: 'CCSS public hospital, emergency services, some English-speaking staff',
    pharmacy: (c) => `Farmacia Fischel — ${c}`,
    pharmacyNote: 'Major pharmacy chain with prescription medications',
    grocery: (c) => `Auto Mercado — ${c}`,
    groceryNote: 'Upscale supermarket with imported goods and fresh produce',
    bank: (c) => `BAC Credomatic — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff',
    doctor: (c) => `Clínica de ${c}`,
    doctorNote: 'Private clinic with English-speaking doctors available',
    dentist: (c) => `Dental Clínica ${c}`,
    dentistNote: 'Private dental practice, dental tourism hub',
    vet: (c) => `Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque para Perros — ${c}`,
    dogParkNote: 'Dog-friendly park area, growing trend',
    gym: (c) => `MultiSpa — ${c}`,
    gymNote: 'Modern fitness center with pool and classes',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic connections; international via SJO/LIR',
    transit: (c) => `Terminal de Buses ${c}`,
    transitNote: 'Bus terminal with regional connections',
  },
  Mexico: {
    hospital: (c) => `Hospital General de ${c}`,
    hospitalNote: 'General hospital with emergency services, bilingual staff in expat areas',
    pharmacy: (c) => `Farmacia Guadalajara — ${c}`,
    pharmacyNote: 'Major pharmacy chain, many medications available without prescription',
    grocery: (c) => `Soriana — ${c}`,
    groceryNote: 'Major supermarket with fresh produce, bakery, imported goods',
    bank: (c) => `BBVA — ${c}`,
    bankNote: 'Full-service bank with English-speaking staff in major branches',
    doctor: (c) => `Centro Médico de ${c}`,
    doctorNote: 'Private medical center, English-speaking doctors available in expat areas',
    dentist: (c) => `Dental Express ${c}`,
    dentistNote: 'Private dental practice, popular dental tourism destination',
    vet: (c) => `Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Dog-friendly park area',
    gym: (c) => `Smart Fit — ${c}`,
    gymNote: 'Modern affordable gym chain with equipment and classes',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic and some international connections',
    transit: (c) => `Central de Autobuses de ${c}`,
    transitNote: 'Bus station with first-class intercity and regional services',
  },
  Colombia: {
    hospital: (c) => `Hospital Universitario de ${c}`,
    hospitalNote: 'Major hospital with emergency services, some English-speaking staff',
    pharmacy: (c) => `Droguería Olímpica — ${c}`,
    pharmacyNote: 'Major pharmacy chain with prescription medications',
    grocery: (c) => `Éxito — ${c}`,
    groceryNote: 'Major Colombian supermarket chain with fresh produce',
    bank: (c) => `Bancolombia — ${c}`,
    bankNote: 'Full-service bank, largest in Colombia, English support in major cities',
    doctor: (c) => `Centro Médico de ${c}`,
    doctorNote: 'Private medical center, English-speaking doctors in expat areas',
    dentist: (c) => `Clínica Dental ${c}`,
    dentistNote: 'Private dental practice, medical tourism destination',
    vet: (c) => `Clínica Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Dog-friendly park with off-leash areas',
    gym: (c) => `BodyTech — ${c}`,
    gymNote: 'Premium gym chain with modern equipment and classes',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic and international connections',
    transit: (c) => `Terminal de Transporte de ${c}`,
    transitNote: 'Bus terminal with intercity connections',
  },
  Ecuador: {
    hospital: (c) => `Hospital General de ${c}`,
    hospitalNote: 'Public hospital with emergency services, limited English',
    pharmacy: (c) => `Farmacia Cruz Azul — ${c}`,
    pharmacyNote: 'Major pharmacy chain with prescription medications',
    grocery: (c) => `Supermaxi — ${c}`,
    groceryNote: 'Major Ecuadorian supermarket with fresh produce and imported goods',
    bank: (c) => `Banco Pichincha — ${c}`,
    bankNote: 'Full-service bank, largest in Ecuador',
    doctor: (c) => `Centro Médico de ${c}`,
    doctorNote: 'Private medical center, some English-speaking doctors',
    dentist: (c) => `Clínica Dental ${c}`,
    dentistNote: 'Private dental practice, affordable care',
    vet: (c) => `Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque para Mascotas — ${c}`,
    dogParkNote: 'Dog-friendly park area',
    gym: (c) => `Taurus Gym — ${c}`,
    gymNote: 'Local gym with modern equipment',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with domestic connections',
    transit: (c) => `Terminal Terrestre de ${c}`,
    transitNote: 'Bus terminal with intercity connections',
  },
  Uruguay: {
    hospital: (c) => `Hospital de ${c}`,
    hospitalNote: 'Public hospital with emergency services, FONASA coverage',
    pharmacy: (c) => `Farmacia San Roque — ${c}`,
    pharmacyNote: 'Major pharmacy chain with prescription medications',
    grocery: (c) => `Tienda Inglesa — ${c}`,
    groceryNote: 'Upscale supermarket with imported goods and fresh produce',
    bank: (c) => `BROU — ${c}`,
    bankNote: 'State-owned bank, full-service branch',
    doctor: (c) => `Mutualista de ${c}`,
    doctorNote: 'Private mutual health provider with GP services',
    dentist: (c) => `Dental Clínica ${c}`,
    dentistNote: 'Private dental practice',
    vet: (c) => `Veterinaria ${c}`,
    vetNote: 'Full-service veterinary clinic',
    dogPark: (c) => `Parque Canino de ${c}`,
    dogParkNote: 'Dog-friendly park area',
    gym: (c) => `Smart Fit — ${c}`,
    gymNote: 'Affordable gym chain with modern equipment',
    airport: (c) => `Aeropuerto de ${c}`,
    airportNote: 'Airport with regional connections',
    transit: (c) => `Terminal de Ómnibus de ${c}`,
    transitNote: 'Bus terminal with intercity connections',
  },
};

// Fallback for any country not explicitly listed
const defaultConfig: CountryConfig = {
  hospital: (c) => `${c} General Hospital`,
  hospitalNote: 'General hospital with emergency department',
  pharmacy: (c) => `Central Pharmacy — ${c}`,
  pharmacyNote: 'Pharmacy with prescription medications',
  grocery: (c) => `Main Supermarket — ${c}`,
  groceryNote: 'Supermarket with fresh produce and imported goods',
  bank: (c) => `National Bank — ${c}`,
  bankNote: 'Full-service bank with ATM',
  doctor: (c) => `${c} Medical Center`,
  doctorNote: 'Medical center with GPs',
  dentist: (c) => `${c} Dental Clinic`,
  dentistNote: 'Dental practice',
  vet: (c) => `${c} Veterinary Clinic`,
  vetNote: 'Full-service veterinary clinic',
  dogPark: (c) => `${c} Dog Park`,
  dogParkNote: 'Dog-friendly park area',
  gym: (c) => `Fitness Center — ${c}`,
  gymNote: 'Gym with modern equipment',
  airport: (c) => `${c} Airport`,
  airportNote: 'Regional airport',
  transit: (c) => `${c} Bus Station`,
  transitNote: 'Bus station with regional connections',
};

// ─── Attraction generators by country group ──────────────────────────────────

interface AttractionTemplate {
  type: string;
  nameFn: (city: string) => string;
  descFn: (city: string) => string;
  distMin: number;
  distMax: number;
  costMin: number;
  costMax: number;
  frequency: string;
}

function getAttractionTemplates(country: string, _region: string): AttractionTemplate[] {
  const base: AttractionTemplate[] = [
    {
      type: 'cultural',
      nameFn: (c) => `${c} Museum of Art & History`,
      descFn: (c) => `Regional art and history museum showcasing ${c}'s cultural heritage`,
      distMin: 0.5, distMax: 5, costMin: 0, costMax: 15, frequency: 'Tue-Sun, varies seasonally',
    },
    {
      type: 'nature',
      nameFn: (c) => `${c} Botanical Gardens`,
      descFn: (c) => `Botanical gardens and nature trails near ${c}`,
      distMin: 2, distMax: 20, costMin: 0, costMax: 10, frequency: 'Daily, dawn to dusk',
    },
    {
      type: 'historical',
      nameFn: (c) => `Historic ${c} Old Town`,
      descFn: (c) => `Historic district with preserved architecture and walking tours in ${c}`,
      distMin: 0.2, distMax: 5, costMin: 0, costMax: 10, frequency: 'Open daily, guided tours available',
    },
    {
      type: 'outdoor',
      nameFn: (c) => `${c} Riverside / Waterfront Trail`,
      descFn: (c) => `Scenic walking and cycling path near ${c}`,
      distMin: 1, distMax: 8, costMin: 0, costMax: 0, frequency: 'Open 24/7, year-round',
    },
    {
      type: 'dining',
      nameFn: (c) => `${c} Central Market & Food Hall`,
      descFn: (c) => `Local market with fresh produce, prepared foods, and regional specialties in ${c}`,
      distMin: 0.3, distMax: 5, costMin: 10, costMax: 30, frequency: 'Mon-Sat morning to early afternoon',
    },
    {
      type: 'entertainment',
      nameFn: (c) => `${c} Performing Arts Center`,
      descFn: (c) => `Theater and concert venue with regular cultural programming in ${c}`,
      distMin: 1, distMax: 8, costMin: 15, costMax: 50, frequency: 'Event schedule varies, check listings',
    },
  ];

  // Add country-specific extras
  if (country === 'United States') {
    base.push(
      {
        type: 'sports',
        nameFn: (c) => `${c} Sports Arena`,
        descFn: (c) => `Stadium/arena hosting professional and college sports near ${c}`,
        distMin: 3, distMax: 30, costMin: 20, costMax: 80, frequency: 'Seasonal, check team schedules',
      },
      {
        type: 'nature',
        nameFn: (c) => `State Park near ${c}`,
        descFn: (c) => `State park with hiking trails, camping, and scenic views near ${c}`,
        distMin: 15, distMax: 80, costMin: 5, costMax: 25, frequency: 'Daily, dawn to dusk, vehicle fee may apply',
      },
    );
  } else if (['France', 'Italy', 'Spain', 'Portugal', 'Greece'].includes(country)) {
    base.push(
      {
        type: 'nature',
        nameFn: (c) => `Coastal Walk / Beach near ${c}`,
        descFn: (c) => `Mediterranean or Atlantic coastline accessible from ${c}`,
        distMin: 2, distMax: 50, costMin: 0, costMax: 5, frequency: 'Open year-round, best Apr-Oct',
      },
      {
        type: 'historical',
        nameFn: (c) => `Medieval Quarter / Castle near ${c}`,
        descFn: (c) => `Historic medieval architecture and fortifications near ${c}`,
        distMin: 1, distMax: 30, costMin: 0, costMax: 12, frequency: 'Open daily, guided tours available',
      },
    );
  } else if (['Panama', 'Costa Rica', 'Mexico', 'Colombia', 'Ecuador', 'Uruguay'].includes(country)) {
    base.push(
      {
        type: 'nature',
        nameFn: (c) => `Nature Reserve / Wildlife near ${c}`,
        descFn: (c) => `Protected area with tropical wildlife and nature trails near ${c}`,
        distMin: 5, distMax: 60, costMin: 5, costMax: 20, frequency: 'Daily, guided tours recommended',
      },
      {
        type: 'social',
        nameFn: (c) => `Expat Community Center — ${c}`,
        descFn: (c) => `English-speaking community gathering point with events and social activities in ${c}`,
        distMin: 0.5, distMax: 5, costMin: 0, costMax: 5, frequency: 'Weekly events, check schedule',
      },
    );
  }

  return base;
}

// ─── Generate services for a location ────────────────────────────────────────

function generateServices(loc: LocationSeed, rng: () => number): { services: Service[]; attractions: Attraction[] } {
  const city = loc.cities[0];
  const cfg = countryConfigs[loc.country] || defaultConfig;
  const isUS = loc.country === 'United States';
  const costField = isUS || loc.currency === 'USD' ? 'estimatedCostUSD' : 'estimatedCostEUR';

  const services: Service[] = [
    { categoryId: 'hospital', name: cfg.hospital(city), distanceKm: randBetween(rng, 2, 15), notes: cfg.hospitalNote },
    { categoryId: 'pharmacy', name: cfg.pharmacy(city), distanceKm: randBetween(rng, 0.3, 3), notes: cfg.pharmacyNote },
    { categoryId: 'grocery', name: cfg.grocery(city), distanceKm: randBetween(rng, 0.3, 4), notes: cfg.groceryNote },
    { categoryId: 'bank', name: cfg.bank(city), distanceKm: randBetween(rng, 0.5, 4), notes: cfg.bankNote },
    { categoryId: 'doctor_gp', name: cfg.doctor(city), distanceKm: randBetween(rng, 1, 6), notes: cfg.doctorNote },
    { categoryId: 'dentist', name: cfg.dentist(city), distanceKm: randBetween(rng, 0.5, 5), notes: cfg.dentistNote },
    { categoryId: 'vet', name: cfg.vet(city), distanceKm: randBetween(rng, 1, 6), notes: cfg.vetNote },
    { categoryId: 'dog_park', name: cfg.dogPark(city), distanceKm: randBetween(rng, 1, 8), notes: cfg.dogParkNote },
    { categoryId: 'gym', name: cfg.gym(city), distanceKm: randBetween(rng, 0.5, 5), notes: cfg.gymNote },
    { categoryId: 'airport', name: cfg.airport(city), distanceKm: randBetween(rng, 5, 25), notes: cfg.airportNote },
    { categoryId: 'public_transit', name: cfg.transit(city), distanceKm: randBetween(rng, 0.5, 4), notes: cfg.transitNote },
  ];

  const templates = getAttractionTemplates(loc.country, loc.region);
  const attractions: Attraction[] = templates.map((t) => {
    const cost = randBetween(rng, t.costMin, t.costMax);
    const attr: Attraction = {
      type: t.type,
      name: t.nameFn(city),
      description: t.descFn(city),
      distanceKm: randBetween(rng, t.distMin, t.distMax),
      frequency: t.frequency,
    };
    if (costField === 'estimatedCostUSD') {
      attr.estimatedCostUSD = cost;
    } else {
      attr.estimatedCostEUR = cost;
    }
    return attr;
  });

  return { services, attractions };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n--- Seed Services for 118 new locations ---`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  // Load seed files
  const files = ['seed-locations-us.json', 'seed-locations-eu.json', 'seed-locations-latam.json'];
  const allLocations: LocationSeed[] = [];

  for (const file of files) {
    const filePath = join(__dirname, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LocationSeed[];
      console.log(`  Loaded ${file}: ${data.length} locations`);
      allLocations.push(...data);
    } catch (err) {
      console.error(`  Failed to read ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n  Total: ${allLocations.length} locations\n`);

  if (dryRun) {
    for (const loc of allLocations) {
      const rng = makeRng(loc.id + '-services');
      const data = generateServices(loc, rng);
      console.log(`  ${loc.id}: ${data.services.length} services, ${data.attractions.length} attractions`);
    }
    console.log(`\n  Dry run complete.\n`);
    return;
  }

  let upserted = 0;
  let errors = 0;

  for (const loc of allLocations) {
    const rng = makeRng(loc.id + '-services');
    const data = generateServices(loc, rng);

    try {
      await prisma.adminLocationSupplement.upsert({
        where: {
          locationId_dataType: {
            locationId: loc.id,
            dataType: 'services',
          },
        },
        create: {
          locationId: loc.id,
          dataType: 'services',
          data: data as unknown as Record<string, unknown>,
        },
        update: {
          data: data as unknown as Record<string, unknown>,
        },
      });
      upserted++;
      console.log(`  [${upserted}/${allLocations.length}] ${loc.id} — ${data.services.length} services, ${data.attractions.length} attractions`);
    } catch (err) {
      console.error(`  ERROR ${loc.id}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n  Results: ${upserted} upserted, ${errors} errors`);
  console.log(`  Done.\n`);
}

main()
  .catch((e) => {
    console.error('Seed services failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
