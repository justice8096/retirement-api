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

// ===== PET DAYCARE / PET SITTER DATA =====
// User request: 2 days/week pet sitter where doggy daycare not widely available
// For Bernese Mountain Dog (large breed, ~100 lbs)
// Pet sitter = in-home visit or full-day care by hired sitter
// Daycare = commercial facility (Camp Bow Wow, Dogtopia, etc.)
//
// Availability assessment:
//   US locations: Commercial daycare widely available → keep daycare
//   France: Limited commercial daycare (garde d'animaux / pension canine more common) → pet sitter
//   Spain: Very limited commercial daycare → pet sitter
//   Portugal: Very limited commercial daycare → pet sitter
//   Panama City: Some facilities but limited for large breeds → pet sitter
//   Panama Boquete: Very limited → pet sitter (already noted in data)

const PET_DATA = {
  // ===== US LOCATIONS: Commercial daycare available =====
  // 2 days/week × ~4.3 weeks/month = ~8.7 days/month
  'us-virginia': {
    type: 'daycare',
    min: 340,
    max: 520,
    typical: 420,
    annualInflation: 0.035,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$48/day). Camp Bow Wow, Dogtopia, Whole Dogz in Fairfax area. NoVA premium pricing.'
  },
  'us-cherry-hill': {
    type: 'daycare',
    min: 300,
    max: 460,
    typical: 370,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$43/day). Camp Bow Wow Maple Shade, Dogtopia Cherry Hill. South Jersey pricing.'
  },
  'us-philadelphia': {
    type: 'daycare',
    min: 310,
    max: 470,
    typical: 380,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$44/day). Camp Bow Wow, Zoom Room, Lucky Dog Daycare. Prices vary by neighborhood.'
  },
  'us-richmond': {
    type: 'daycare',
    min: 270,
    max: 400,
    typical: 330,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$38/day). Holiday Barn, Camp Bow Wow, Dogtopia Richmond.'
  },
  'us-savannah': {
    type: 'daycare',
    min: 260,
    max: 390,
    typical: 320,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$37/day). Camp Bow Wow Savannah, Bark Avenue. Moderate Southern pricing.'
  },
  'us-florida': {
    type: 'daycare',
    min: 300,
    max: 470,
    typical: 380,
    annualInflation: 0.035,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$44/day). Camp Bow Wow, Dogtopia locations across FL. Prices rising with demand.'
  },
  'us-atlanta': {
    type: 'daycare',
    min: 290,
    max: 440,
    typical: 360,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$42/day). Camp Bow Wow, Dogtopia Atlanta. Metro Atlanta pricing slightly higher than rural GA.'
  },
  'us-punta-gorda': {
    type: 'daycare',
    min: 270,
    max: 420,
    typical: 340,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate. Fewer options than major metros; local kennels and pet resorts.'
  },
  'us-raleigh': {
    type: 'daycare',
    min: 280,
    max: 430,
    typical: 350,
    annualInflation: 0.03,
    notes: 'Doggy daycare 2 days/week, large breed rate (~$40/day). Camp Bow Wow, Dogtopia Raleigh.'
  },

  // ===== FRANCE: Pet sitter (garde d'animaux à domicile) =====
  // Professional pet sitter visiting home, ~6-8 hours, 2 days/week
  // France rates: €15-25/visit for full-day home visit, large dog surcharge common
  'france-brittany': {
    type: 'pet sitter',
    min: 200,
    max: 340,
    typical: 260,
    annualInflation: 0.025,
    notes: 'Hired pet sitter 2 days/week (~€28/visit). Commercial daycare (garde canine) limited in Brittany; in-home pet sitting more common. Large breed surcharge applies. Rover.com and local garde d\'animaux services.'
  },
  'france-lyon': {
    type: 'pet sitter',
    min: 230,
    max: 380,
    typical: 300,
    annualInflation: 0.025,
    notes: 'Hired pet sitter 2 days/week (~€32/visit). Some commercial facilities exist in Lyon suburbs but limited for large breeds. Rover.com, Animaute, and local pet sitters. CESU payment option for tax deduction.'
  },
  'france-montpellier': {
    type: 'pet sitter',
    min: 210,
    max: 350,
    typical: 270,
    annualInflation: 0.025,
    notes: 'Hired pet sitter 2 days/week (~€29/visit). Limited commercial daycare in Montpellier area. In-home pet sitting via Rover.com, Animaute. CESU eligible for tax credit (50% of costs).'
  },
  'france-toulouse': {
    type: 'pet sitter',
    min: 210,
    max: 350,
    typical: 270,
    annualInflation: 0.025,
    notes: 'Hired pet sitter 2 days/week (~€29/visit). Few commercial daycare facilities in Toulouse. In-home pet care via local garde d\'animaux, Rover.com. CESU eligible for 50% tax credit.'
  },

  // ===== SPAIN: Pet sitter (cuidador de mascotas) =====
  'spain-alicante': {
    type: 'pet sitter',
    min: 170,
    max: 290,
    typical: 220,
    annualInflation: 0.03,
    notes: 'Hired pet sitter 2 days/week (~€24/visit). Commercial daycare very limited on Costa Blanca. In-home pet sitting via Rover.com, Gudog, local cuidadores. Many expat pet sitters available.'
  },

  // ===== PORTUGAL: Pet sitter (pet sitter / cuidador de animais) =====
  'portugal-lisbon': {
    type: 'pet sitter',
    min: 180,
    max: 310,
    typical: 240,
    annualInflation: 0.03,
    notes: 'Hired pet sitter 2 days/week (~€26/visit). Limited commercial daycare in Greater Lisbon. In-home pet sitting via Rover.com, PetSitting.pt, local services. Algarve has fewer options than Lisbon.'
  },

  // ===== PANAMA: Pet sitter =====
  'panama-city': {
    type: 'pet sitter',
    min: 140,
    max: 250,
    typical: 190,
    annualInflation: 0.03,
    notes: 'Hired pet sitter 2 days/week (~$22/visit). Some commercial facilities in Panama City but limited for large breeds. Expat-run pet sitting services available. Pensionado discounts may apply.'
  },
  'panama-boquete': {
    type: 'pet sitter',
    min: 110,
    max: 200,
    typical: 150,
    annualInflation: 0.025,
    notes: 'Hired pet sitter 2 days/week (~$17/visit). No commercial daycare in Boquete. Expat community has informal pet sitting network. Lower cost of living reflected in rates.'
  }
};

// ===== UPDATE ALL LOCATIONS =====
let updated = 0;

for (const [locId, data] of Object.entries(PET_DATA)) {
  const locPath = join(LOCATIONS_DIR, locId, 'location.json');
  if (!existsSync(locPath)) {
    log('SKIP ' + locId + ' — no location.json');
    continue;
  }

  const loc = readJSON(locPath);
  const oldTypical = loc.monthlyCosts.petDaycare ? loc.monthlyCosts.petDaycare.typical : 0;

  loc.monthlyCosts.petDaycare = {
    min: data.min,
    max: data.max,
    typical: data.typical,
    annualInflation: data.annualInflation,
    notes: data.notes
  };

  writeJSON(locPath, loc);
  const label = data.type === 'pet sitter' ? 'Pet Sitter' : 'Daycare';
  log('Updated ' + locId + ': ' + label + ' $' + oldTypical + ' → $' + data.typical + '/mo (2 days/week)');
  updated++;
}

log('');
log('Updated ' + updated + ' locations — pet daycare/sitter for 2 days/week.');
log('US locations: commercial daycare retained (widely available)');
log('Non-US locations: switched to hired pet sitter (daycare limited/unavailable)');
log('');
log('IMPORTANT: Run "node tools/build-db.js" to rebuild the SQLite database.');
