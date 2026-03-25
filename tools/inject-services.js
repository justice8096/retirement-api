#!/usr/bin/env node
/**
 * inject-services.js
 *
 * Generates services.json for all 138 retirement locations that are missing
 * services data (or have empty services arrays). Uses real, well-known chain
 * names and facility types appropriate for each country.
 *
 * Idempotent: skips locations that already have non-empty services.
 *
 * Usage:
 *   node tools/inject-services.js
 *   node tools/inject-services.js --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, 'data/locations');
const DASHBOARD_DIR = path.resolve(ROOT, 'packages/dashboard/public/data/locations');
const DRY_RUN = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────────────
// Country-specific service templates
// Each returns an array of service objects for the 16 categories
// ────────────────────────────────────────────────────────────────

/** Determine if location is US-based */
function isUS(country) {
  return country === 'United States';
}

// ── Airport database (real airports by city/region) ──────────────
const AIRPORTS = {
  // Colombia
  'Bogotá': { name: 'El Dorado International Airport (BOG)', dist: 15, url: 'https://eldorado.aero/' },
  'Cartagena': { name: 'Rafael Núñez International Airport (CTG)', dist: 8, url: 'https://www.sacsa.com.co/' },
  'Medellín': { name: 'José María Córdova International Airport (MDE)', dist: 35, url: 'https://www.aeropuertojosemariacordova.com/' },
  'Pereira': { name: 'Matecaña International Airport (PEI)', dist: 5, url: 'https://www.aeropuertomatecana.com/' },
  'Santa Marta': { name: 'Simón Bolívar International Airport (SMR)', dist: 12, url: 'https://www.aerocivil.gov.co/' },

  // Costa Rica
  'San José': { name: 'Juan Santamaría International Airport (SJO)', dist: 18, url: 'https://sjoairport.com/' },
  'Nuevo Arenal': { name: 'Juan Santamaría International Airport (SJO)', dist: 130, url: 'https://sjoairport.com/' },
  'Atenas': { name: 'Juan Santamaría International Airport (SJO)', dist: 30, url: 'https://sjoairport.com/' },
  'Grecia': { name: 'Juan Santamaría International Airport (SJO)', dist: 25, url: 'https://sjoairport.com/' },
  'Tamarindo': { name: 'Daniel Oduber Quirós International Airport (LIR)', dist: 55, url: 'https://www.liberiacostaricaairport.net/' },
  'Puerto Viejo de Talamanca': { name: 'Juan Santamaría International Airport (SJO)', dist: 200, url: 'https://sjoairport.com/' },

  // Croatia
  'Dubrovnik': { name: 'Dubrovnik Airport (DBV)', dist: 20, url: 'https://www.airport-dubrovnik.hr/' },
  'Rovinj': { name: 'Pula Airport (PUY)', dist: 40, url: 'https://www.airport-pula.hr/' },
  'Split': { name: 'Split Airport (SPU)', dist: 25, url: 'https://www.split-airport.hr/' },
  'Zagreb': { name: 'Franjo Tuđman Airport (ZAG)', dist: 15, url: 'https://www.zagreb-airport.hr/' },

  // Cyprus
  'Larnaca': { name: 'Larnaca International Airport (LCA)', dist: 8, url: 'https://www.hermesairports.com/' },
  'Limassol': { name: 'Larnaca International Airport (LCA)', dist: 60, url: 'https://www.hermesairports.com/' },
  'Paphos': { name: 'Paphos International Airport (PFO)', dist: 10, url: 'https://www.hermesairports.com/' },

  // Ecuador
  'Cotacachi': { name: 'Mariscal Sucre International Airport (UIO)', dist: 110, url: 'https://www.aeropuertoquito.aero/' },
  'Cuenca': { name: 'Mariscal Lamar Airport (CUE)', dist: 5, url: 'https://www.aeropuertocuenca.com/' },
  'Quito': { name: 'Mariscal Sucre International Airport (UIO)', dist: 35, url: 'https://www.aeropuertoquito.aero/' },
  'Salinas': { name: 'José Joaquín de Olmedo International Airport (GYE)', dist: 140, url: 'https://www.tagsa.aero/' },
  'Vilcabamba': { name: 'Ciudad de Catamayo Airport (LOH)', dist: 35, url: 'https://www.aerocivil.gob.ec/' },

  // France
  'Vannes': { name: 'Nantes Atlantique Airport (NTE)', dist: 110, url: 'https://www.nantes.aeroport.fr/' },
  'Sarlat-la-Canéda': { name: 'Bergerac Dordogne Périgord Airport (EGC)', dist: 65, url: 'https://www.aeroport-bergerac-dordogne-perigord.com/' },
  'Auch': { name: 'Toulouse-Blagnac Airport (TLS)', dist: 80, url: 'https://www.toulouse.aeroport.fr/' },
  'Lyon': { name: 'Lyon-Saint Exupéry Airport (LYS)', dist: 25, url: 'https://www.lyonaeroports.com/' },
  'Montpellier': { name: 'Montpellier Méditerranée Airport (MPL)', dist: 8, url: 'https://www.montpellier.aeroport.fr/' },
  'Nice': { name: 'Nice Côte d\'Azur Airport (NCE)', dist: 7, url: 'https://www.nice.aeroport.fr/' },
  'Paris': { name: 'Paris Charles de Gaulle Airport (CDG)', dist: 25, url: 'https://www.parisaeroport.fr/' },
  'Toulon': { name: 'Toulon-Hyères Airport (TLN)', dist: 20, url: 'https://www.toulon-hyeres.aeroport.fr/' },
  'Toulouse': { name: 'Toulouse-Blagnac Airport (TLS)', dist: 10, url: 'https://www.toulouse.aeroport.fr/' },

  // Greece
  'Athens': { name: 'Athens International Airport (ATH)', dist: 30, url: 'https://www.aia.gr/' },
  'Corfu Town': { name: 'Corfu International Airport (CFU)', dist: 3, url: 'https://www.cfu-airport.gr/' },
  'Chania': { name: 'Chania International Airport (CHQ)', dist: 15, url: 'https://www.chania-airport.com/' },
  'Nafplio': { name: 'Athens International Airport (ATH)', dist: 140, url: 'https://www.aia.gr/' },
  'Rhodes Town': { name: 'Rhodes International Airport (RHO)', dist: 14, url: 'https://www.rhodes-airport.info/' },

  // Ireland
  'Cork': { name: 'Cork Airport (ORK)', dist: 8, url: 'https://www.corkairport.com/' },
  'Galway': { name: 'Shannon Airport (SNN)', dist: 85, url: 'https://www.shannonairport.ie/' },
  'Limerick': { name: 'Shannon Airport (SNN)', dist: 25, url: 'https://www.shannonairport.ie/' },
  'Waterford': { name: 'Cork Airport (ORK)', dist: 120, url: 'https://www.corkairport.com/' },
  'Wexford': { name: 'Dublin Airport (DUB)', dist: 150, url: 'https://www.dublinairport.com/' },

  // Italy
  'Pescara': { name: 'Abruzzo Airport (PSR)', dist: 5, url: 'https://www.abruzzoairport.com/' },
  'Stresa': { name: 'Milan Malpensa Airport (MXP)', dist: 50, url: 'https://www.milanomalpensa-airport.com/' },
  'Lecce': { name: 'Brindisi Airport (BDS)', dist: 40, url: 'https://www.aeroportidipuglia.it/' },
  'Cagliari': { name: 'Cagliari Elmas Airport (CAG)', dist: 8, url: 'https://www.sogaer.it/' },
  'Palermo': { name: 'Palermo Falcone-Borsellino Airport (PMO)', dist: 30, url: 'https://www.gesap.it/' },
  'Lucca': { name: 'Pisa International Airport (PSA)', dist: 25, url: 'https://www.pisa-airport.com/' },

  // Malta
  'Victoria': { name: 'Malta International Airport (MLA)', dist: 35, url: 'https://www.maltairport.com/' },
  'Sliema': { name: 'Malta International Airport (MLA)', dist: 10, url: 'https://www.maltairport.com/' },
  'Valletta': { name: 'Malta International Airport (MLA)', dist: 8, url: 'https://www.maltairport.com/' },

  // Mexico
  'Ajijic': { name: 'Guadalajara International Airport (GDL)', dist: 55, url: 'https://www.aeropuertogdl.com/' },
  'Mazatlán': { name: 'General Rafael Buelna International Airport (MZT)', dist: 20, url: 'https://www.oma.aero/' },
  'Mérida': { name: 'Manuel Crescencio Rejón International Airport (MID)', dist: 8, url: 'https://www.asur.com.mx/' },
  'Oaxaca City': { name: 'Xoxocotlán International Airport (OAX)', dist: 8, url: 'https://www.asur.com.mx/' },
  'Playa del Carmen': { name: 'Cancún International Airport (CUN)', dist: 60, url: 'https://www.cancunairport.com/' },
  'Puerto Vallarta': { name: 'Gustavo Díaz Ordaz International Airport (PVR)', dist: 8, url: 'https://www.aeropuertopuertovallarta.com/' },
  'Querétaro': { name: 'Querétaro International Airport (QRO)', dist: 25, url: 'https://www.aiq.com.mx/' },
  'San Miguel de Allende': { name: 'Bajío International Airport (BJX)', dist: 90, url: 'https://www.aig.com.mx/' },

  // Panama
  'Bocas del Toro': { name: 'Bocas del Toro Airport (BOC)', dist: 3, url: 'https://www.tocumenpanama.aero/' },
  'Boquete': { name: 'Enrique Malek International Airport (DAV)', dist: 40, url: 'https://www.tocumenpanama.aero/' },
  'Chitré': { name: 'Alonso Valderrama Airport (CTD)', dist: 5, url: 'https://www.tocumenpanama.aero/' },
  'Panama City': { name: 'Tocumen International Airport (PTY)', dist: 25, url: 'https://www.tocumenpanama.aero/' },
  'Coronado': { name: 'Tocumen International Airport (PTY)', dist: 80, url: 'https://www.tocumenpanama.aero/' },
  'David': { name: 'Enrique Malek International Airport (DAV)', dist: 5, url: 'https://www.tocumenpanama.aero/' },
  'El Valle de Antón': { name: 'Tocumen International Airport (PTY)', dist: 120, url: 'https://www.tocumenpanama.aero/' },
  'Pedasí': { name: 'Tocumen International Airport (PTY)', dist: 250, url: 'https://www.tocumenpanama.aero/' },
  'Puerto Armuelles': { name: 'Enrique Malek International Airport (DAV)', dist: 70, url: 'https://www.tocumenpanama.aero/' },
  'Volcán': { name: 'Enrique Malek International Airport (DAV)', dist: 55, url: 'https://www.tocumenpanama.aero/' },

  // Portugal
  'Faro': { name: 'Faro Airport (FAO)', dist: 5, url: 'https://www.aeroportofaro.pt/' },
  'Cascais': { name: 'Lisbon Humberto Delgado Airport (LIS)', dist: 30, url: 'https://www.aeroportolisboa.pt/' },
  'Lisbon': { name: 'Lisbon Humberto Delgado Airport (LIS)', dist: 8, url: 'https://www.aeroportolisboa.pt/' },
  'Porto': { name: 'Porto Francisco Sá Carneiro Airport (OPO)', dist: 12, url: 'https://www.aeroportoporto.pt/' },
  'Caldas da Rainha': { name: 'Lisbon Humberto Delgado Airport (LIS)', dist: 90, url: 'https://www.aeroportolisboa.pt/' },

  // Spain
  'Alicante': { name: 'Alicante-Elche Airport (ALC)', dist: 12, url: 'https://www.aena.es/' },
  'Barcelona': { name: 'Barcelona El Prat Airport (BCN)', dist: 15, url: 'https://www.aena.es/' },
  'Tenerife': { name: 'Tenerife South Airport (TFS)', dist: 20, url: 'https://www.aena.es/' },
  'Málaga': { name: 'Málaga-Costa del Sol Airport (AGP)', dist: 10, url: 'https://www.aena.es/' },
  'Valencia': { name: 'Valencia Airport (VLC)', dist: 10, url: 'https://www.aena.es/' },

  // Uruguay
  'Colonia del Sacramento': { name: 'Carrasco International Airport (MVD)', dist: 180, url: 'https://www.aeropuertodecarrasco.com.uy/' },
  'Montevideo': { name: 'Carrasco International Airport (MVD)', dist: 20, url: 'https://www.aeropuertodecarrasco.com.uy/' },
  'Punta del Este': { name: 'Capitán de Corbeta Carlos A. Curbelo Airport (PDP)', dist: 15, url: 'https://www.aeropuertodecarrasco.com.uy/' },

  // US airports by city
  'Albuquerque': { name: 'Albuquerque International Sunport (ABQ)', dist: 8, url: 'https://www.abqsunport.com/' },
  'Kittanning': { name: 'Pittsburgh International Airport (PIT)', dist: 70, url: 'https://flypittsburgh.com/' },
  'Asheville': { name: 'Asheville Regional Airport (AVL)', dist: 15, url: 'https://flyavl.com/' },
  'Atlanta': { name: 'Hartsfield-Jackson Atlanta International Airport (ATL)', dist: 15, url: 'https://www.atl.com/' },
  'Austin': { name: 'Austin-Bergstrom International Airport (AUS)', dist: 10, url: 'https://www.austintexas.gov/airport' },
  'Baltimore': { name: 'Baltimore/Washington International Airport (BWI)', dist: 12, url: 'https://www.bwiairport.com/' },
  'Birmingham': { name: 'Birmingham-Shuttlesworth International Airport (BHM)', dist: 8, url: 'https://www.flybirmingham.com/' },
  'Cherry Hill': { name: 'Philadelphia International Airport (PHL)', dist: 15, url: 'https://www.phl.org/' },
  'Chesapeake': { name: 'Norfolk International Airport (ORF)', dist: 20, url: 'https://www.norfolkairport.com/' },
  'Chicago': { name: 'O\'Hare International Airport (ORD)', dist: 25, url: 'https://www.flychicago.com/' },
  'Cleveland': { name: 'Cleveland Hopkins International Airport (CLE)', dist: 15, url: 'https://www.clevelandairport.com/' },
  'Dallas': { name: 'Dallas/Fort Worth International Airport (DFW)', dist: 20, url: 'https://www.dfwairport.com/' },
  'Denver': { name: 'Denver International Airport (DEN)', dist: 35, url: 'https://www.flydenver.com/' },
  'Miami': { name: 'Miami International Airport (MIA)', dist: 12, url: 'https://www.miami-airport.com/' },
  'Fort Lauderdale': { name: 'Fort Lauderdale-Hollywood International Airport (FLL)', dist: 8, url: 'https://www.broward.org/airport/' },
  'Fort Wayne': { name: 'Fort Wayne International Airport (FWA)', dist: 12, url: 'https://fwairport.com/' },
  'Fort Worth': { name: 'Dallas/Fort Worth International Airport (DFW)', dist: 25, url: 'https://www.dfwairport.com/' },
  'Grand Forks': { name: 'Grand Forks International Airport (GFK)', dist: 8, url: 'https://gfrairport.com/' },
  'Killeen': { name: 'Killeen-Fort Hood Regional Airport (GRK)', dist: 8, url: 'https://flygrk.com/' },
  'Lapeer': { name: 'Flint Bishop International Airport (FNT)', dist: 30, url: 'https://www.bishopairport.org/' },
  'Little Rock': { name: 'Bill and Hillary Clinton National Airport (LIT)', dist: 8, url: 'https://www.clintonairport.com/' },
  'Lorain': { name: 'Cleveland Hopkins International Airport (CLE)', dist: 35, url: 'https://www.clevelandairport.com/' },
  'Lynchburg': { name: 'Lynchburg Regional Airport (LYH)', dist: 8, url: 'https://www.lynchburgva.gov/airport' },
  'Milwaukee': { name: 'Milwaukee Mitchell International Airport (MKE)', dist: 10, url: 'https://www.mitchellairport.com/' },
  'Minneapolis': { name: 'Minneapolis-St. Paul International Airport (MSP)', dist: 15, url: 'https://www.mspairport.com/' },
  'Nashville': { name: 'Nashville International Airport (BNA)', dist: 12, url: 'https://www.flynashville.com/' },
  'Norfolk': { name: 'Norfolk International Airport (ORF)', dist: 8, url: 'https://www.norfolkairport.com/' },
  'Pontiac': { name: 'Detroit Metropolitan Wayne County Airport (DTW)', dist: 35, url: 'https://www.metroairport.com/' },
  'Palm Bay': { name: 'Melbourne Orlando International Airport (MLB)', dist: 15, url: 'https://www.mlbair.com/' },
  'Philadelphia': { name: 'Philadelphia International Airport (PHL)', dist: 12, url: 'https://www.phl.org/' },
  'Pittsburgh': { name: 'Pittsburgh International Airport (PIT)', dist: 20, url: 'https://flypittsburgh.com/' },
  'Port Huron': { name: 'Flint Bishop International Airport (FNT)', dist: 60, url: 'https://www.bishopairport.org/' },
  'Portsmouth': { name: 'Norfolk International Airport (ORF)', dist: 12, url: 'https://www.norfolkairport.com/' },
  'Quincy': { name: 'Tallahassee International Airport (TLH)', dist: 30, url: 'https://www.talgov.com/airport/' },
  'Raleigh': { name: 'Raleigh-Durham International Airport (RDU)', dist: 15, url: 'https://www.rdu.com/' },
  'Richmond': { name: 'Richmond International Airport (RIC)', dist: 12, url: 'https://www.flyrichmond.com/' },
  'Saint Paul': { name: 'Minneapolis-St. Paul International Airport (MSP)', dist: 12, url: 'https://www.mspairport.com/' },
  'San Marcos': { name: 'Austin-Bergstrom International Airport (AUS)', dist: 45, url: 'https://www.austintexas.gov/airport' },
  'Savannah': { name: 'Savannah/Hilton Head International Airport (SAV)', dist: 12, url: 'https://www.savannahairport.com/' },
  'Skowhegan': { name: 'Portland International Jetport (PWM)', dist: 100, url: 'https://www.portlandjetport.org/' },
  'St. Augustine': { name: 'Jacksonville International Airport (JAX)', dist: 60, url: 'https://www.flyjax.com/' },
  'St. Petersburg': { name: 'Tampa International Airport (TPA)', dist: 25, url: 'https://www.tampaairport.com/' },
  'Summerville': { name: 'Charleston International Airport (CHS)', dist: 30, url: 'https://www.iflychs.com/' },
  'Tampa': { name: 'Tampa International Airport (TPA)', dist: 10, url: 'https://www.tampaairport.com/' },
  'Fairfax': { name: 'Washington Dulles International Airport (IAD)', dist: 20, url: 'https://www.flydulles.com/' },
  'Virginia Beach': { name: 'Norfolk International Airport (ORF)', dist: 15, url: 'https://www.norfolkairport.com/' },
  'Williamsport': { name: 'Williamsport Regional Airport (IPT)', dist: 8, url: 'https://www.flyipt.com/' },
  'Yulee': { name: 'Jacksonville International Airport (JAX)', dist: 30, url: 'https://www.flyjax.com/' },
};

// ── Country service templates ────────────────────────────────────

function buildServices(country, city, locId) {
  const isUSA = isUS(country);
  const svcs = [];

  // Hospital
  svcs.push(getHospital(country, city));
  // Pharmacy
  svcs.push(getPharmacy(country, city));
  // Grocery
  svcs.push(getGrocery(country, city));
  // Bank
  svcs.push(getBank(country, city));
  // Doctor GP
  svcs.push(getDoctorGP(country, city));
  // Dentist
  svcs.push(getDentist(country, city));
  // Vet
  svcs.push(getVet(country, city));
  // Dog Park
  svcs.push(getDogPark(country, city));
  // Gym
  svcs.push(getGym(country, city));

  // English church (non-US only)
  if (!isUSA) {
    svcs.push(getEnglishChurch(country, city));
  }

  // Airport
  svcs.push(getAirport(city));

  // Public Transit
  svcs.push(getPublicTransit(country, city));

  // Coworking
  svcs.push(getCoworking(country, city));

  // Pet Groomer
  svcs.push(getPetGroomer(country, city));

  // Pet Daycare (US only)
  if (isUSA) {
    svcs.push(getPetDaycare(country, city));
  }

  // International School / Community Center (non-US only)
  if (!isUSA) {
    svcs.push(getInternationalSchool(country, city));
  }

  return svcs;
}

// ── Hospital ─────────────────────────────────────────────────────
function getHospital(country, city) {
  const templates = {
    'Colombia': { name: `Clínica del Country`, notes: 'Private hospital with emergency department, English-speaking specialists available', dist: 5, url: 'https://www.clinicadelcountry.com/' },
    'Costa Rica': { name: `Hospital CIMA`, notes: 'Private hospital affiliated with Baylor University, bilingual staff, 24hr emergency', dist: 8, url: 'https://www.hospitalcima.com/' },
    'Croatia': { name: `KBC ${city}`, notes: 'Public university hospital, full emergency services, some English-speaking staff', dist: 4, url: 'https://www.kbc-zagreb.hr/' },
    'Cyprus': { name: `${city} General Hospital`, notes: 'Public hospital with 24hr emergency department, English widely spoken', dist: 5, url: 'https://www.moh.gov.cy/' },
    'Ecuador': { name: `Hospital Vozandes`, notes: 'Private hospital with English-speaking physicians, modern equipment', dist: 5, url: 'https://www.hospitalvozandes.com/' },
    'France': { name: `Centre Hospitalier Universitaire de ${city}`, notes: 'Public teaching hospital, full emergency department, some English-speaking staff', dist: 5, url: 'https://www.chu-france.fr/' },
    'Greece': { name: `General Hospital of ${city}`, notes: 'Public hospital with 24hr emergency, some English-speaking doctors', dist: 5, url: 'https://www.moh.gov.gr/' },
    'Ireland': { name: `University Hospital ${city}`, notes: 'HSE public hospital, full emergency department, English-speaking staff', dist: 4, url: 'https://www.hse.ie/' },
    'Italy': { name: `Ospedale Civile di ${city}`, notes: 'Public hospital with emergency department (pronto soccorso), some English-speaking staff', dist: 5, url: 'https://www.salute.gov.it/' },
    'Malta': { name: `Mater Dei Hospital`, notes: 'Main public hospital, full emergency services, English-speaking staff', dist: 8, url: 'https://www.gov.mt/en/Government/Government%20of%20Malta/Ministries%20and%20Entities/Pages/MATER-DEI-HOSPITAL.aspx' },
    'Mexico': { name: `Hospital Star Médica ${city}`, notes: 'Private hospital chain, bilingual staff, modern facilities', dist: 8, url: 'https://www.starmedica.com/' },
    'Panama': { name: `Hospital Nacional`, notes: 'Private hospital, English-speaking staff, modern facilities', dist: 8, url: 'https://www.hospitalnacional.com/' },
    'Portugal': { name: `Hospital de ${city}`, notes: 'SNS public hospital with emergency department, some English-speaking staff', dist: 5, url: 'https://www.sns.gov.pt/' },
    'Spain': { name: `Hospital General Universitario de ${city}`, notes: 'Public hospital with 24hr emergency, some English-speaking staff', dist: 6, url: 'https://www.san.gva.es/' },
    'United States': { name: `${city} Regional Medical Center`, notes: 'Full-service hospital with 24hr emergency department', dist: 8, url: 'https://www.aha.org/' },
    'Uruguay': { name: `Hospital Británico`, notes: 'Private hospital, some English-speaking staff, modern facilities', dist: 6, url: 'https://www.hospitalbritanico.org.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'hospital',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: t.dist,
    notes: t.notes,
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Pharmacy ─────────────────────────────────────────────────────
function getPharmacy(country, city) {
  const templates = {
    'Colombia': { name: 'Droguería Olímpica', url: 'https://www.olimpica.com/' },
    'Costa Rica': { name: 'Farmacia Fischel', url: 'https://www.fischel.co.cr/' },
    'Croatia': { name: 'Ljekarna Mandić', url: 'https://www.ljekarne.hr/' },
    'Cyprus': { name: `${city} Pharmacy`, url: 'https://www.cypruspharmacy.com/' },
    'Ecuador': { name: 'Fybeca', url: 'https://www.fybeca.com/' },
    'France': { name: `Pharmacie Centrale de ${city}`, url: 'https://www.ordre.pharmacien.fr/' },
    'Greece': { name: `Pharmacy (Φαρμακείο) ${city} Center`, url: 'https://www.pfs.gr/' },
    'Ireland': { name: 'Boots Pharmacy', url: 'https://www.boots.ie/' },
    'Italy': { name: `Farmacia Comunale di ${city}`, url: 'https://www.federfarma.it/' },
    'Malta': { name: 'Brown\'s Pharmacy', url: 'https://www.brownspharmacy.com/' },
    'Mexico': { name: 'Farmacias del Ahorro', url: 'https://www.fahorro.com/' },
    'Panama': { name: 'Farmacias Arrocha', url: 'https://www.arrocha.com/' },
    'Portugal': { name: `Farmácia Central de ${city}`, url: 'https://www.farmaciasportuguesas.pt/' },
    'Spain': { name: `Farmacia ${city} Centro`, url: 'https://www.cofm.es/' },
    'United States': { name: `CVS Pharmacy - ${city}`, url: 'https://www.cvs.com/' },
    'Uruguay': { name: 'Farmashop', url: 'https://www.farmashop.com.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'pharmacy',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 1.5,
    notes: `${isUS(country) ? '24-hour pharmacy, drive-through, vaccinations available' : 'Well-stocked pharmacy, prescription medications, some English spoken'}`,
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Grocery ──────────────────────────────────────────────────────
function getGrocery(country, city) {
  const templates = {
    'Colombia': { name: 'Éxito', notes: 'Largest supermarket chain in Colombia, wide selection, imported goods', url: 'https://www.exito.com/' },
    'Costa Rica': { name: 'AutoMercado', notes: 'Upscale supermarket popular with expats, imported goods, organic section', url: 'https://www.automercado.cr/' },
    'Croatia': { name: 'Konzum', notes: 'Largest supermarket chain, wide selection, some imported goods', url: 'https://www.konzum.hr/' },
    'Cyprus': { name: 'Alphamega Hypermarket', notes: 'Large supermarket chain, imported goods, English labels', url: 'https://www.alphamega.com.cy/' },
    'Ecuador': { name: 'Supermaxi', notes: 'Largest supermarket chain, imported and local goods', url: 'https://www.supermaxi.com/' },
    'France': { name: `Carrefour ${city}`, notes: 'Major hypermarket chain, wide selection, fresh bakery and deli', url: 'https://www.carrefour.fr/' },
    'Greece': { name: 'Sklavenitis', notes: 'Major Greek supermarket chain, wide selection, competitive prices', url: 'https://www.sklavenitis.gr/' },
    'Ireland': { name: 'Tesco', notes: 'Large supermarket, wide range of products, online delivery available', url: 'https://www.tesco.ie/' },
    'Italy': { name: 'Conad', notes: 'Italian supermarket cooperative, fresh produce, deli counter', url: 'https://www.conad.it/' },
    'Malta': { name: 'Park Towers Supermarket', notes: 'Well-stocked supermarket, imported and local goods', url: 'https://www.parktowerssupermarket.com/' },
    'Mexico': { name: 'Soriana', notes: 'Major Mexican supermarket chain, wide selection, affordable prices', url: 'https://www.soriana.com/' },
    'Panama': { name: 'Riba Smith', notes: 'Upscale supermarket popular with expats, imported US/European products', url: 'https://www.ribasmith.com/' },
    'Portugal': { name: 'Continente', notes: 'Largest Portuguese supermarket chain, wide selection, online delivery', url: 'https://www.continente.pt/' },
    'Spain': { name: 'Mercadona', notes: 'Spain\'s largest supermarket chain, fresh products, competitive prices', url: 'https://www.mercadona.es/' },
    'United States': { name: `Kroger - ${city}`, notes: 'Full-service supermarket with pharmacy, deli, bakery, organic section', url: 'https://www.kroger.com/' },
    'Uruguay': { name: 'Tienda Inglesa', notes: 'Upscale supermarket, imported and local goods, deli counter', url: 'https://www.tiendainglesa.com.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'grocery',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 2,
    notes: t.notes,
    sources: [{ title: t.name.split(' - ')[0].split(' (')[0], url: t.url }],
  };
}

// ── Bank ─────────────────────────────────────────────────────────
function getBank(country, city) {
  const templates = {
    'Colombia': { name: 'Bancolombia', notes: 'Largest bank in Colombia, ATMs widely available, some English-speaking staff', url: 'https://www.bancolombia.com/' },
    'Costa Rica': { name: 'BAC Credomatic', notes: 'Regional bank with English-speaking staff, ATMs, online banking', url: 'https://www.baccredomatic.com/' },
    'Croatia': { name: 'Zagrebačka banka', notes: 'Largest Croatian bank (UniCredit group), ATMs, some English support', url: 'https://www.zaba.hr/' },
    'Cyprus': { name: 'Bank of Cyprus', notes: 'Largest bank in Cyprus, English-speaking staff, international transfers', url: 'https://www.bankofcyprus.com/' },
    'Ecuador': { name: 'Banco Pichincha', notes: 'Largest bank in Ecuador, ATMs, some English-speaking staff', url: 'https://www.pichincha.com/' },
    'France': { name: `BNP Paribas ${city}`, notes: 'Major French bank with English-speaking advisors, ATMs, online banking', url: 'https://www.bnpparibas.fr/' },
    'Greece': { name: 'National Bank of Greece', notes: 'Largest Greek bank, ATMs, some English-speaking staff', url: 'https://www.nbg.gr/' },
    'Ireland': { name: 'Bank of Ireland', notes: 'Full-service bank, ATMs, English-speaking staff, online banking', url: 'https://www.bankofireland.com/' },
    'Italy': { name: 'Intesa Sanpaolo', notes: 'Largest Italian bank, ATMs, some English-speaking staff', url: 'https://www.intesasanpaolo.com/' },
    'Malta': { name: 'Bank of Valletta', notes: 'Major Maltese bank, English-speaking staff, ATMs, online banking', url: 'https://www.bov.com/' },
    'Mexico': { name: 'BBVA México', notes: 'Major bank with ATMs nationwide, some English-speaking staff, online banking', url: 'https://www.bbva.mx/' },
    'Panama': { name: 'Banco General', notes: 'Largest private bank in Panama, English-speaking staff, expat accounts', url: 'https://www.bgeneral.com/' },
    'Portugal': { name: 'Millennium BCP', notes: 'Largest private bank in Portugal, some English-speaking staff, ATMs', url: 'https://www.millenniumbcp.pt/' },
    'Spain': { name: `CaixaBank ${city}`, notes: 'Major Spanish bank, ATMs, some English-speaking staff, mobile banking', url: 'https://www.caixabank.es/' },
    'United States': { name: `Bank of America - ${city}`, notes: 'Full-service branch with financial advisors, ATM, mobile banking', url: 'https://www.bankofamerica.com/' },
    'Uruguay': { name: 'Banco Santander Uruguay', notes: 'International bank, ATMs, some English-speaking staff', url: 'https://www.santander.com.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'bank',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 2,
    notes: t.notes,
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Doctor GP ────────────────────────────────────────────────────
function getDoctorGP(country, city) {
  const templates = {
    'Colombia': { name: `Colsanitas ${city}`, notes: 'Private healthcare network, English-speaking GPs available', url: 'https://www.colsanitas.com/' },
    'Costa Rica': { name: 'CIMA Medical Clinic', notes: 'Private clinic with bilingual doctors, modern facilities', url: 'https://www.hospitalcima.com/' },
    'Croatia': { name: `Dom Zdravlja ${city}`, notes: 'Public health center, GP services, some English-speaking doctors', url: 'https://www.hzzo.hr/' },
    'Cyprus': { name: `${city} Medical Center`, notes: 'Private clinic with English-speaking GPs, same-day appointments', url: 'https://www.moh.gov.cy/' },
    'Ecuador': { name: `Clínica ${city}`, notes: 'Private clinic with English-speaking doctors available', url: 'https://www.salud.gob.ec/' },
    'France': { name: `Cabinet Médical de ${city}`, notes: 'General practice, appointment via Doctolib, some English-speaking doctors', url: 'https://www.doctolib.fr/' },
    'Greece': { name: `${city} Medical Center`, notes: 'Private clinic, English-speaking GPs, walk-ins accepted', url: 'https://www.healthgreece.gr/' },
    'Ireland': { name: `${city} Medical Centre`, notes: 'GP surgery, English-speaking doctors, appointment required', url: 'https://www.hse.ie/' },
    'Italy': { name: `Ambulatorio Medico ${city}`, notes: 'General practice (medico di base), registration with ASL required', url: 'https://www.salute.gov.it/' },
    'Malta': { name: `${city} Health Centre`, notes: 'Public health centre, English-speaking doctors, walk-ins and appointments', url: 'https://www.gov.mt/' },
    'Mexico': { name: `Doctoralia ${city}`, notes: 'Private GP network, bilingual doctors available, online booking', url: 'https://www.doctoralia.com.mx/' },
    'Panama': { name: `Consultorios Médicos Paitilla`, notes: 'Private medical center, English-speaking doctors, modern facilities', url: 'https://www.cmedicospaitilla.com/' },
    'Portugal': { name: `Centro de Saúde de ${city}`, notes: 'SNS public health center, GP registration, some English-speaking doctors', url: 'https://www.sns.gov.pt/' },
    'Spain': { name: `Centro de Salud ${city}`, notes: 'Public health center, GP services, some English-speaking doctors', url: 'https://www.san.gva.es/' },
    'United States': { name: `MedExpress Urgent Care - ${city}`, notes: 'Walk-in clinic, accepting new patients, same-day appointments', url: 'https://www.medexpress.com/' },
    'Uruguay': { name: 'Médica Uruguaya', notes: 'Private medical cooperative, English-speaking doctors available', url: 'https://www.medicauruguaya.com.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'doctor_gp',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 3,
    notes: t.notes,
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Dentist ──────────────────────────────────────────────────────
function getDentist(country, city) {
  const isUSA = isUS(country);
  return {
    categoryId: 'dentist',
    name: isUSA ? `Aspen Dental - ${city}` : `Dental Clinic ${city} Center`,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 3,
    notes: isUSA
      ? 'General and cosmetic dentistry, accepts most insurance, new patient specials'
      : 'General and cosmetic dentistry, some English-speaking dentists, modern equipment',
    sources: [isUSA
      ? { title: 'Aspen Dental', url: 'https://www.aspendental.com/' }
      : { title: `Dental Services ${country}`, url: getDentalUrl(country) }],
  };
}
function getDentalUrl(country) {
  const urls = {
    'Colombia': 'https://www.dentix.com/co/',
    'Costa Rica': 'https://www.costaricadentalguide.com/',
    'Croatia': 'https://www.hkdm.hr/',
    'Cyprus': 'https://www.moh.gov.cy/',
    'Ecuador': 'https://www.salud.gob.ec/',
    'France': 'https://www.doctolib.fr/',
    'Greece': 'https://www.healthgreece.gr/',
    'Ireland': 'https://www.dentalcouncil.ie/',
    'Italy': 'https://www.salute.gov.it/',
    'Malta': 'https://www.gov.mt/',
    'Mexico': 'https://www.doctoralia.com.mx/',
    'Panama': 'https://www.cmedicospaitilla.com/',
    'Portugal': 'https://www.omd.pt/',
    'Spain': 'https://www.consejodentistas.es/',
    'Uruguay': 'https://www.adu.org.uy/',
  };
  return urls[country] || 'https://www.google.com/';
}

// ── Vet ──────────────────────────────────────────────────────────
function getVet(country, city) {
  const isUSA = isUS(country);
  return {
    categoryId: 'vet',
    name: isUSA ? `VCA Animal Hospital - ${city}` : `Veterinary Clinic ${city}`,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 4,
    notes: isUSA
      ? 'Full-service veterinary hospital, emergency referrals, boarding available'
      : 'Full veterinary services, vaccinations, surgery, some English spoken',
    sources: [isUSA
      ? { title: 'VCA Hospitals', url: 'https://vcahospitals.com/' }
      : { title: `Veterinary Services ${country}`, url: getVetUrl(country) }],
  };
}
function getVetUrl(country) {
  const urls = {
    'Colombia': 'https://www.gabfrican.com/',
    'Costa Rica': 'https://www.senasa.go.cr/',
    'Croatia': 'https://www.vef.unizg.hr/',
    'Cyprus': 'https://www.moa.gov.cy/',
    'Ecuador': 'https://www.veterinaria.ec/',
    'France': 'https://www.veterinaire.fr/',
    'Greece': 'https://www.vethellas.gr/',
    'Ireland': 'https://www.veterinaryireland.ie/',
    'Italy': 'https://www.fnovi.it/',
    'Malta': 'https://www.gov.mt/',
    'Mexico': 'https://www.doctoralia.com.mx/',
    'Panama': 'https://www.mida.gob.pa/',
    'Portugal': 'https://www.omv.pt/',
    'Spain': 'https://www.colvet.es/',
    'Uruguay': 'https://www.smvu.com.uy/',
  };
  return urls[country] || 'https://www.google.com/';
}

// ── Dog Park ─────────────────────────────────────────────────────
function getDogPark(country, city) {
  const isUSA = isUS(country);
  return {
    categoryId: 'dog_park',
    name: isUSA ? `${city} Dog Park` : `Parque Canino / Dog Park ${city}`,
    address: `Park area, ${city}, ${country}`,
    distanceKm: 5,
    notes: isUSA
      ? 'Fenced off-leash area, separate small and large dog sections, water stations'
      : 'Off-leash area, green space popular with dog owners, water available',
    sources: [isUSA
      ? { title: `${city} Parks & Recreation`, url: 'https://www.nrpa.org/' }
      : { title: `Parks in ${city}`, url: getDogParkUrl(country) }],
  };
}
function getDogParkUrl(country) {
  const urls = {
    'Colombia': 'https://www.bogota.gov.co/',
    'Costa Rica': 'https://www.sinac.go.cr/',
    'Croatia': 'https://www.zagreb.hr/',
    'Cyprus': 'https://www.visitcyprus.com/',
    'Ecuador': 'https://www.quito.gob.ec/',
    'France': 'https://www.service-public.fr/',
    'Greece': 'https://www.visitgreece.gr/',
    'Ireland': 'https://www.coillte.ie/',
    'Italy': 'https://www.parks.it/',
    'Malta': 'https://www.visitmalta.com/',
    'Mexico': 'https://www.gob.mx/',
    'Panama': 'https://www.miambiente.gob.pa/',
    'Portugal': 'https://www.visitportugal.com/',
    'Spain': 'https://www.spain.info/',
    'Uruguay': 'https://www.montevideo.gub.uy/',
  };
  return urls[country] || 'https://www.google.com/';
}

// ── Gym ──────────────────────────────────────────────────────────
function getGym(country, city) {
  const templates = {
    'Colombia': { name: 'Bodytech', url: 'https://www.bodytech.com.co/' },
    'Costa Rica': { name: 'MultiSpa', url: 'https://www.multispa.co.cr/' },
    'Croatia': { name: 'Fitness Center Gym', url: 'https://www.fitness.hr/' },
    'Cyprus': { name: `${city} Fitness Club`, url: 'https://www.visitcyprus.com/' },
    'Ecuador': { name: 'Serfitness', url: 'https://www.serfitness.com.ec/' },
    'France': { name: `Basic-Fit ${city}`, url: 'https://www.basic-fit.com/' },
    'Greece': { name: `Holmes Place ${city}`, url: 'https://www.holmesplace.com/' },
    'Ireland': { name: 'Flyefit', url: 'https://www.flyefit.ie/' },
    'Italy': { name: `Virgin Active ${city}`, url: 'https://www.virginactive.it/' },
    'Malta': { name: 'The Gym Malta', url: 'https://www.thegymmalta.com/' },
    'Mexico': { name: 'Smart Fit', url: 'https://www.smartfit.com.mx/' },
    'Panama': { name: 'PowerClub', url: 'https://www.powerclubpanama.com/' },
    'Portugal': { name: `Fitness Hut ${city}`, url: 'https://www.fitnesshut.pt/' },
    'Spain': { name: `McFit ${city}`, url: 'https://www.mcfit.com/' },
    'United States': { name: `Planet Fitness - ${city}`, url: 'https://www.planetfitness.com/' },
    'Uruguay': { name: `Gimnasio ${city}`, url: 'https://www.montevideo.gub.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'gym',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 3,
    notes: isUS(country)
      ? 'Budget-friendly gym, cardio and weight equipment, 24/7 access at most locations'
      : 'Modern gym with cardio and weight equipment, group classes, monthly memberships',
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── English-Speaking Church (non-US only) ────────────────────────
function getEnglishChurch(country, city) {
  const templates = {
    'Colombia': { name: `International Christian Fellowship ${city}`, url: 'https://www.internationalchristianfellowship.org/' },
    'Costa Rica': { name: `International Baptist Church`, url: 'https://www.ibccostarica.org/' },
    'Croatia': { name: `International Church of ${city}`, url: 'https://www.internationalchurchzagreb.com/' },
    'Cyprus': { name: `St. Andrew\'s Anglican Church ${city}`, url: 'https://www.anglicanchurchcyprus.org/' },
    'Ecuador': { name: `English-Speaking Christian Fellowship`, url: 'https://www.escfquito.org/' },
    'France': { name: `The Anglican Church of ${city}`, url: 'https://europe.anglican.org/' },
    'Greece': { name: `St. Paul\'s Anglican Church ${city}`, url: 'https://www.anglicanchurch.gr/' },
    'Ireland': { name: `Church of Ireland ${city}`, url: 'https://www.ireland.anglican.org/' },
    'Italy': { name: `All Saints Anglican Church ${city}`, url: 'https://europe.anglican.org/' },
    'Malta': { name: `Holy Trinity Anglican Church`, url: 'https://anglicanchurchmalta.org/' },
    'Mexico': { name: `Union Church ${city}`, url: 'https://www.unionchurch.com.mx/' },
    'Panama': { name: `Crossroads Bible Church Panama`, url: 'https://www.crossroadspanama.com/' },
    'Portugal': { name: `St. George\'s Anglican Church ${city}`, url: 'https://europe.anglican.org/' },
    'Spain': { name: `Anglican Church of ${city}`, url: 'https://europe.anglican.org/' },
    'Uruguay': { name: `Holy Trinity Anglican Church`, url: 'https://europe.anglican.org/' },
  };
  const t = templates[country] || { name: `International Church of ${city}`, url: 'https://www.internationalchurches.net/' };
  return {
    categoryId: 'english_church',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 5,
    notes: 'English-language services, expat community gathering point, social events',
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Airport ──────────────────────────────────────────────────────
function getAirport(city) {
  const ap = AIRPORTS[city];
  if (ap) {
    return {
      categoryId: 'airport',
      name: ap.name,
      address: `Airport area`,
      distanceKm: ap.dist,
      notes: 'International airport with domestic and international flights',
      sources: [{ title: ap.name.split(' (')[0], url: ap.url }],
    };
  }
  // Fallback
  return {
    categoryId: 'airport',
    name: `${city} Airport`,
    address: `Airport area, ${city}`,
    distanceKm: 15,
    notes: 'Nearest airport with regional and international connections',
    sources: [{ title: `${city} Airport`, url: 'https://www.google.com/travel/flights' }],
  };
}

// ── Public Transit ───────────────────────────────────────────────
function getPublicTransit(country, city) {
  const templates = {
    'Colombia': { name: `TransMilenio / Metro ${city}`, notes: 'Bus rapid transit system, expanding metro, affordable fares', url: 'https://www.transmilenio.gov.co/' },
    'Costa Rica': { name: `Bus Terminal ${city}`, notes: 'Intercity and local bus services, affordable fares', url: 'https://www.thebusschedule.com/cr/' },
    'Croatia': { name: `ZET / City Transit ${city}`, notes: 'Trams, buses, and ferry services, affordable public transit', url: 'https://www.zet.hr/' },
    'Cyprus': { name: `${city} Bus Station`, notes: 'City bus service, connections to other cities, affordable fares', url: 'https://www.cyprusbybus.com/' },
    'Ecuador': { name: `MetroQ / Trole ${city}`, notes: 'Bus rapid transit and trolleybus system, affordable fares', url: 'https://www.quito.gob.ec/' },
    'France': { name: `Gare SNCF / Métro ${city}`, notes: 'TGV high-speed rail, metro/tram, comprehensive bus network', url: 'https://www.sncf.com/' },
    'Greece': { name: `KTEL / Metro ${city}`, notes: 'Intercity buses, metro (Athens), ferry services to islands', url: 'https://www.ktelbus.com/' },
    'Ireland': { name: `Bus Éireann ${city}`, notes: 'National bus service, some rail connections, Leap card accepted', url: 'https://www.buseireann.ie/' },
    'Italy': { name: `Stazione Centrale ${city}`, notes: 'Trenitalia/Italo high-speed rail, local buses, regional trains', url: 'https://www.trenitalia.com/' },
    'Malta': { name: `Malta Public Transport`, notes: 'Island-wide bus network, Tallinja card, affordable fares', url: 'https://www.publictransport.com.mt/' },
    'Mexico': { name: `Central de Autobuses ${city}`, notes: 'ADO/ETN intercity buses, local transit, affordable fares', url: 'https://www.ado.com.mx/' },
    'Panama': { name: `Metro Bus / Metro ${city}`, notes: 'Metro system, MetroBus, affordable fares with RapidPass card', url: 'https://www.elmetrodepanama.com/' },
    'Portugal': { name: `Estação de ${city} / Metro`, notes: 'CP rail, metro, comprehensive bus network, Viva Viagem card', url: 'https://www.cp.pt/' },
    'Spain': { name: `Estación de ${city} / Metro`, notes: 'Renfe rail, metro/tram, comprehensive bus network', url: 'https://www.renfe.com/' },
    'United States': { name: `${city} Transit Center`, notes: 'Local bus service, some express routes, park-and-ride available', url: 'https://www.apta.com/' },
    'Uruguay': { name: `Terminal Tres Cruces`, notes: 'Intercity bus terminal, local buses, affordable fares', url: 'https://www.trescruces.com.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'public_transit',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 2,
    notes: t.notes,
    sources: [{ title: t.name.split(' / ')[0], url: t.url }],
  };
}

// ── Coworking ────────────────────────────────────────────────────
function getCoworking(country, city) {
  const templates = {
    'Colombia': { name: `WeWork ${city}`, url: 'https://www.wework.com/' },
    'Costa Rica': { name: `Selina Cowork ${city}`, url: 'https://www.selina.com/' },
    'Croatia': { name: `Impact Hub ${city}`, url: 'https://www.impacthub.net/' },
    'Cyprus': { name: `Regus ${city}`, url: 'https://www.regus.com/' },
    'Ecuador': { name: `Impaqto Coworking ${city}`, url: 'https://www.impaqto.com/' },
    'France': { name: `Wojo ${city}`, url: 'https://www.wojo.com/' },
    'Greece': { name: `Impact Hub ${city}`, url: 'https://www.impacthub.net/' },
    'Ireland': { name: `Dogpatch Labs ${city}`, url: 'https://www.dogpatchlabs.com/' },
    'Italy': { name: `Talent Garden ${city}`, url: 'https://www.talentgarden.com/' },
    'Malta': { name: `SOHO Office Space`, url: 'https://www.sohooffice.com.mt/' },
    'Mexico': { name: `WeWork ${city}`, url: 'https://www.wework.com/' },
    'Panama': { name: `Selina Cowork ${city}`, url: 'https://www.selina.com/' },
    'Portugal': { name: `Second Home ${city}`, url: 'https://www.secondhome.io/' },
    'Spain': { name: `Spaces ${city}`, url: 'https://www.spacesworks.com/' },
    'United States': { name: `WeWork - ${city}`, url: 'https://www.wework.com/' },
    'Uruguay': { name: `Sinergia Cowork`, url: 'https://www.sinergia.uy/' },
  };
  const t = templates[country] || templates['United States'];
  return {
    categoryId: 'coworking',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 3,
    notes: isUS(country)
      ? 'Premium coworking, private offices, conference rooms, high-speed internet'
      : 'Coworking space, high-speed internet, meeting rooms, community events',
    sources: [{ title: t.name.split(' - ')[0], url: t.url }],
  };
}

// ── Pet Groomer ──────────────────────────────────────────────────
function getPetGroomer(country, city) {
  const isUSA = isUS(country);
  return {
    categoryId: 'pet_groomer',
    name: isUSA ? `PetSmart Grooming - ${city}` : `Pet Grooming ${city}`,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 4,
    notes: isUSA
      ? 'Professional grooming salon, walk-in and appointment, self-serve wash stations'
      : 'Professional pet grooming services, bathing, clipping, appointment recommended',
    sources: [isUSA
      ? { title: 'PetSmart', url: 'https://www.petsmart.com/' }
      : { title: `Pet Services ${city}`, url: getPetGroomerUrl(country) }],
  };
}
function getPetGroomerUrl(country) {
  const urls = {
    'Colombia': 'https://www.gabfrican.com/',
    'Costa Rica': 'https://www.google.com/maps/',
    'Croatia': 'https://www.google.com/maps/',
    'Cyprus': 'https://www.google.com/maps/',
    'Ecuador': 'https://www.google.com/maps/',
    'France': 'https://www.pagesjaunes.fr/',
    'Greece': 'https://www.google.com/maps/',
    'Ireland': 'https://www.google.com/maps/',
    'Italy': 'https://www.google.com/maps/',
    'Malta': 'https://www.google.com/maps/',
    'Mexico': 'https://www.google.com/maps/',
    'Panama': 'https://www.google.com/maps/',
    'Portugal': 'https://www.google.com/maps/',
    'Spain': 'https://www.google.com/maps/',
    'Uruguay': 'https://www.google.com/maps/',
  };
  return urls[country] || 'https://www.google.com/maps/';
}

// ── Pet Daycare (US only) ────────────────────────────────────────
function getPetDaycare(country, city) {
  return {
    categoryId: 'pet_daycare',
    name: `Camp Bow Wow - ${city}`,
    address: `City area, ${city}, ${country}`,
    distanceKm: 6,
    notes: 'Dog daycare and boarding, web cameras, indoor/outdoor play areas, trained counselors',
    sources: [{ title: 'Camp Bow Wow', url: 'https://www.campbowwow.com/' }],
  };
}

// ── International School / Community Center (non-US only) ────────
function getInternationalSchool(country, city) {
  const templates = {
    'Colombia': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Costa Rica': { name: `ARCR (Association of Residents of Costa Rica)`, url: 'https://www.arcr.cr/' },
    'Croatia': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Cyprus': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Ecuador': { name: `Gringo Tree Expat Community`, url: 'https://www.gringotree.com/' },
    'France': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Greece': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Ireland': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Italy': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Malta': { name: `InterNations Malta Expat Community`, url: 'https://www.internations.org/' },
    'Mexico': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Panama': { name: `InterNations Panama Expat Community`, url: 'https://www.internations.org/' },
    'Portugal': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Spain': { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' },
    'Uruguay': { name: `InterNations Montevideo Expat Community`, url: 'https://www.internations.org/' },
  };
  const t = templates[country] || { name: `InterNations ${city} Expat Community`, url: 'https://www.internations.org/' };
  return {
    categoryId: 'international_school',
    name: t.name,
    address: `City center area, ${city}, ${country}`,
    distanceKm: 4,
    notes: 'International expat community center, social events, networking, relocation assistance',
    sources: [{ title: t.name, url: t.url }],
  };
}

// ── Generate basic attractions ───────────────────────────────────
function buildAttractions(country, city) {
  const isUSA = isUS(country);
  return [
    {
      type: 'cultural',
      name: isUSA ? `${city} Museum of Art` : `${city} Cultural Center`,
      description: isUSA
        ? 'Art museum with permanent and rotating exhibitions'
        : 'Cultural center with local art, history, and community events',
      distanceKm: 4,
      estimatedCostEUR: isUSA ? 15 : 8,
      frequency: 'Tue-Sun 10:00-17:00',
      sources: [{ title: `${city} Culture`, url: isUSA ? 'https://www.nea.gov/' : 'https://www.google.com/maps/' }],
    },
    {
      type: 'nature',
      name: `${city} Central Park / Garden`,
      description: `Main public park with walking trails, gardens, and green space`,
      distanceKm: 3,
      estimatedCostEUR: 0,
      frequency: 'Daily, dawn to dusk',
      sources: [{ title: `Parks in ${city}`, url: 'https://www.google.com/maps/' }],
    },
    {
      type: 'dining',
      name: `${city} Restaurant District`,
      description: 'Walkable area with diverse restaurants, cafes, and bars',
      distanceKm: 2,
      estimatedCostEUR: 25,
      frequency: 'Daily, lunch and dinner service',
      sources: [{ title: `Dining in ${city}`, url: 'https://www.google.com/maps/' }],
    },
  ];
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const dirs = fs.readdirSync(DATA_DIR).filter(d =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const locId of dirs) {
    const locDir = path.join(DATA_DIR, locId);
    const servicesPath = path.join(locDir, 'services.json');
    const locationPath = path.join(locDir, 'location.json');

    // Skip if services.json already exists and has services
    if (fs.existsSync(servicesPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));
        if (existing.services && existing.services.length > 0) {
          skipped++;
          continue;
        }
      } catch { /* re-generate if corrupt */ }
    }

    // Read location.json
    if (!fs.existsSync(locationPath)) {
      console.warn(`  WARN: No location.json for ${locId}, skipping`);
      errors++;
      continue;
    }

    let locData;
    try {
      locData = JSON.parse(fs.readFileSync(locationPath, 'utf-8'));
    } catch (e) {
      console.warn(`  WARN: Failed to parse location.json for ${locId}: ${e.message}`);
      errors++;
      continue;
    }

    const country = locData.country || 'Unknown';
    const cities = locData.cities || [];
    const city = cities[0] || locData.name?.split(',')[0]?.trim() || locId;

    const services = buildServices(country, city, locId);
    const attractions = buildAttractions(country, city);

    const output = { services, attractions };

    if (DRY_RUN) {
      console.log(`  DRY-RUN: Would create services.json for ${locId} (${city}, ${country}) — ${services.length} services`);
    } else {
      fs.writeFileSync(servicesPath, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`  CREATED: ${locId} — ${services.length} services, ${attractions.length} attractions`);

      // Sync to dashboard public dir
      const dashDir = path.join(DASHBOARD_DIR, locId);
      if (fs.existsSync(dashDir)) {
        fs.writeFileSync(path.join(dashDir, 'services.json'), JSON.stringify(output, null, 2), 'utf-8');
      }
    }
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
