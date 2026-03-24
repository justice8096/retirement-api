/**
 * Seed script for neighborhoods supplemental data for all 118 new seed locations.
 *
 * Generates 4 neighborhoods per location based on the location's cities array,
 * country, and rent data. Upserts into AdminLocationSupplement with dataType='neighborhoods'.
 *
 * Usage:
 *   npx tsx prisma/seed-neighborhoods.ts              # Upsert all
 *   npx tsx prisma/seed-neighborhoods.ts --dry-run    # Preview without writing
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  cities: string[];
  currency: string;
  exchangeRate: number;
  monthlyCosts: { rent: { typical: number } };
  lifestyle?: { expatCommunity?: number };
  [key: string]: unknown;
}

interface Neighborhood {
  id: string;
  name: string;
  description: string;
  character: string;
  housing: Record<string, unknown>;
  walkabilityScore: number;
  transitScore: number;
  safetyRating: string;
  expats: { communitySize: string; englishPrevalence: string };
  character_notes: string;
  sources: { title: string; url: string }[];
}

interface NeighborhoodData {
  city: string;
  neighborhoods: Neighborhood[];
}

// ---------------------------------------------------------------------------
// Neighborhood name generators per region/country
// ---------------------------------------------------------------------------

// For each location we generate 4 neighborhoods:
//  [0] City center / downtown (1.2x rent)
//  [1] Nice residential / suburb (1.0x rent)
//  [2] Affordable area (0.85x rent)
//  [3] Expat / trendy district (1.1x rent)

interface NeighborhoodTemplate {
  nameSuffix: string;
  character: string;
  descriptionTemplate: string;
  characterNotesTemplate: string;
  walkabilityBase: number;
  transitBase: number;
  safety: string;
  housingType: string;
  rentMultiplier: number;
}

const US_TEMPLATES: NeighborhoodTemplate[] = [
  {
    nameSuffix: 'Downtown',
    character: 'urban',
    descriptionTemplate: 'The walkable city center with restaurants, shops, cultural venues, and easy access to public transit',
    characterNotesTemplate: 'Most walkable area. Close to hospitals, dining, and entertainment. Higher rents but lower transportation costs.',
    walkabilityBase: 85,
    transitBase: 65,
    safety: 'moderate-high',
    housingType: 'Apartments, condos, and some converted historic buildings',
    rentMultiplier: 1.2,
  },
  {
    nameSuffix: 'Residential',
    character: 'suburban',
    descriptionTemplate: 'A quiet residential neighborhood with tree-lined streets, parks, and good schools nearby',
    characterNotesTemplate: 'Family-friendly with larger homes and yards. Car helpful but bike-friendly. Local shops and cafes within reach.',
    walkabilityBase: 55,
    transitBase: 35,
    safety: 'high',
    housingType: 'Single-family homes, townhomes, and garden-style apartments',
    rentMultiplier: 1.0,
  },
  {
    nameSuffix: 'Affordable',
    character: 'residential',
    descriptionTemplate: 'An affordable area with a mix of housing types and practical amenities for everyday living',
    characterNotesTemplate: 'Best value for rent. Growing area with improving amenities. Car recommended for most errands.',
    walkabilityBase: 40,
    transitBase: 25,
    safety: 'moderate',
    housingType: 'Older apartments, duplexes, and modest single-family homes',
    rentMultiplier: 0.85,
  },
  {
    nameSuffix: 'Arts/Trendy',
    character: 'historic',
    descriptionTemplate: 'An artsy, revitalized district with breweries, galleries, independent shops, and a creative community feel',
    characterNotesTemplate: 'Popular with creatives and young professionals. Walkable core with strong restaurant scene. Gentrifying with rising rents.',
    walkabilityBase: 75,
    transitBase: 50,
    safety: 'moderate-high',
    housingType: 'Renovated lofts, townhomes, and mixed-use apartment buildings',
    rentMultiplier: 1.1,
  },
];

const EU_TEMPLATES: NeighborhoodTemplate[] = [
  {
    nameSuffix: 'Centre Historique',
    character: 'historic',
    descriptionTemplate: 'The historic center with centuries-old architecture, central market, pedestrian streets, and cultural landmarks',
    characterNotesTemplate: 'Most walkable with best access to amenities. Tourist traffic in peak season. Rich cultural life year-round.',
    walkabilityBase: 90,
    transitBase: 70,
    safety: 'high',
    housingType: 'Renovated apartments in historic buildings',
    rentMultiplier: 1.2,
  },
  {
    nameSuffix: 'Residential Quarter',
    character: 'residential',
    descriptionTemplate: 'A pleasant residential quarter with local markets, parks, and a quieter pace of life than the center',
    characterNotesTemplate: 'Good balance of affordability and access. Local shops and weekly market. Well-connected by bus or tram.',
    walkabilityBase: 65,
    transitBase: 55,
    safety: 'high',
    housingType: 'Modern apartments, some townhouses and villas',
    rentMultiplier: 1.0,
  },
  {
    nameSuffix: 'Affordable Outskirts',
    character: 'suburban',
    descriptionTemplate: 'An outer neighborhood offering lower rents with access to nature, larger living spaces, and a relaxed atmosphere',
    characterNotesTemplate: 'Most affordable option. Quieter lifestyle with garden possibilities. Bus connections to center. Car useful.',
    walkabilityBase: 40,
    transitBase: 30,
    safety: 'high',
    housingType: 'Houses, villas, and low-rise apartment complexes',
    rentMultiplier: 0.85,
  },
  {
    nameSuffix: 'Expat Quarter',
    character: 'urban',
    descriptionTemplate: 'A cosmopolitan area popular with international residents, featuring diverse dining, co-working spaces, and English-friendly services',
    characterNotesTemplate: 'Highest English prevalence. International restaurants and social groups. Good for newcomers integrating into local life.',
    walkabilityBase: 78,
    transitBase: 60,
    safety: 'high',
    housingType: 'Modern apartments and refurbished flats in mixed-use buildings',
    rentMultiplier: 1.1,
  },
];

const LATAM_TEMPLATES: NeighborhoodTemplate[] = [
  {
    nameSuffix: 'Centro',
    character: 'urban',
    descriptionTemplate: 'The bustling city center with markets, plazas, local restaurants, and the main commercial district',
    characterNotesTemplate: 'Most walkable with best transit access. Can be noisy. Rich street life and affordable dining. Medical facilities nearby.',
    walkabilityBase: 82,
    transitBase: 60,
    safety: 'moderate',
    housingType: 'Apartments in mid-rise buildings and converted colonial houses',
    rentMultiplier: 1.2,
  },
  {
    nameSuffix: 'Residential',
    character: 'residential',
    descriptionTemplate: 'A middle-class residential area with parks, local tiendas, and a quieter family-oriented atmosphere',
    characterNotesTemplate: 'Good value with residential character. Local markets and pharmacies. Taxi or bus for most trips. Growing amenities.',
    walkabilityBase: 55,
    transitBase: 40,
    safety: 'moderate-high',
    housingType: 'Houses, townhomes, and small apartment buildings',
    rentMultiplier: 1.0,
  },
  {
    nameSuffix: 'Budget',
    character: 'village',
    descriptionTemplate: 'An outlying area with the most affordable housing, local character, and proximity to countryside or coast',
    characterNotesTemplate: 'Best prices for rent and daily expenses. Less English spoken. Authentic local experience. Car or mototaxi helpful.',
    walkabilityBase: 35,
    transitBase: 20,
    safety: 'moderate',
    housingType: 'Basic houses, older apartments, and some new construction',
    rentMultiplier: 0.85,
  },
  {
    nameSuffix: 'Expat Zone',
    character: 'urban',
    descriptionTemplate: 'The main expat hub with international restaurants, English-speaking services, and an active social scene for foreign residents',
    characterNotesTemplate: 'Where most expats settle initially. Higher prices but easier transition. English menus and bilingual staff common.',
    walkabilityBase: 72,
    transitBase: 50,
    safety: 'moderate-high',
    housingType: 'Modern condos, gated apartments, and furnished rentals',
    rentMultiplier: 1.1,
  },
];

// ---------------------------------------------------------------------------
// Realistic neighborhood name generation
// ---------------------------------------------------------------------------

// Maps of well-known neighborhoods for specific locations
const KNOWN_NEIGHBORHOODS: Record<string, string[]> = {
  // US
  'us-asheville-nc': ['Downtown Asheville', 'West Asheville', 'Biltmore Village', 'River Arts District'],
  'us-tampa-fl': ['Downtown Tampa', 'South Tampa', 'Seminole Heights', 'Hyde Park'],
  'us-st-petersburg-fl': ['Downtown St. Pete', 'Old Northeast', 'Gulfport', 'Grand Central District'],
  'us-pittsburgh-pa': ['Downtown Pittsburgh', 'Squirrel Hill', 'Lawrenceville', 'Shadyside'],
  'us-nashville-tn': ['Downtown Nashville', 'Green Hills', 'East Nashville', 'Germantown'],
  'us-austin-tx': ['Downtown Austin', 'South Lamar', 'East Austin', 'South Congress'],
  'us-denver-co': ['Downtown Denver', 'Wash Park', 'Lakewood', 'RiNo (River North)'],
  'us-albuquerque-nm': ['Downtown Albuquerque', 'Nob Hill', 'North Valley', 'Old Town'],
  'us-fort-lauderdale-fl': ['Downtown Fort Lauderdale', 'Victoria Park', 'Wilton Manors', 'Las Olas'],
  'us-miami-fl': ['Brickell', 'Coral Gables', 'Little Havana', 'Coconut Grove'],
  'us-chicago-il': ['The Loop', 'Lincoln Park', 'Rogers Park', 'Wicker Park'],
  'us-saint-paul-mn': ['Downtown Saint Paul', 'Highland Park', 'Frogtown', 'Cathedral Hill'],
  'us-cleveland-oh': ['Downtown Cleveland', 'Tremont', 'Lakewood', 'Ohio City'],
  'us-birmingham-al': ['Downtown Birmingham', 'Homewood', 'Hoover', 'Avondale'],
  'us-baltimore-md': ['Inner Harbor', 'Roland Park', 'Hampden', 'Federal Hill'],
  'us-dallas-tx': ['Downtown Dallas', 'Highland Park', 'Oak Cliff', 'Deep Ellum'],
  'us-milwaukee-wi': ['Downtown Milwaukee', 'Wauwatosa', 'Bay View', 'Third Ward'],
  'us-fort-worth-tx': ['Downtown Fort Worth', 'Arlington Heights', 'Southside', 'Near Southside / Fairmount'],
  'us-palm-bay-fl': ['Downtown Palm Bay', 'West Melbourne', 'Port Malabar', 'Bayside Lakes'],
  'us-norfolk-va': ['Downtown Norfolk', 'Ghent', 'Ocean View', 'Riverview'],
  'us-virginia-beach-va': ['Town Center', 'Great Neck', 'Kempsville', 'Hilltop'],
  'us-portsmouth-va': ['Olde Towne', 'Churchland', 'Western Branch', 'Cradock'],
  'us-lynchburg-va': ['Downtown Lynchburg', 'Boonsboro', 'Forest', 'Rivermont'],
  'us-little-rock-ar': ['Downtown Little Rock', 'Hillcrest', 'West Little Rock', 'SoMa (South Main)'],
  'us-san-marcos-tx': ['Downtown San Marcos', 'Spring Lake Hills', 'Blanco River Area', 'Midtown'],
  'us-killeen-tx': ['Downtown Killeen', 'Harker Heights', 'Clear Creek', 'Nolanville'],
  'us-st-augustine-fl': ['Historic District', 'Vilano Beach', 'Anastasia Island', 'Uptown'],
  'us-quincy-fl': ['Downtown Quincy', 'Havana', 'Greensboro', 'Gadsden County Estates'],
  'us-lorain-oh': ['Downtown Lorain', 'South Lorain', 'Lakeview', 'Charleston Village'],
  'us-fort-wayne-in': ['Downtown Fort Wayne', 'Aboite', 'West Central', 'Lakeside'],
  'us-lapeer-mi': ['Downtown Lapeer', 'Elba Township', 'Mayfield', 'Metamora'],
  'us-port-huron-mi': ['Downtown Port Huron', 'Fort Gratiot', 'Marysville', 'Military Street Area'],
  'us-oakland-county-mi': ['Royal Oak Downtown', 'Troy', 'Farmington Hills', 'Pontiac Arts District'],
  'us-armstrong-county-pa': ['Downtown Kittanning', 'Ford City', 'Freeport', 'Worthington'],
  'us-williamsport-pa': ['Downtown Williamsport', 'Loyalsock Township', 'Montoursville', 'Newberry'],
  'us-minneapolis-mn': ['Downtown Minneapolis', 'Uptown', 'Northeast', 'Linden Hills'],
  'us-skowhegan-me': ['Downtown Skowhegan', 'Norridgewock', 'Canaan', 'Lakewood'],
  'us-grand-forks-nd': ['Downtown Grand Forks', 'South End', 'University District', 'Riverside'],
  'us-yulee-fl': ['Downtown Yulee', 'Amelia Island', 'Nassauville', 'Callahan'],

  // Portugal
  'portugal-algarve': ['Faro Centro', 'Lagos Marina', 'Albufeira Velha', 'Tavira'],
  'portugal-porto': ['Ribeira (Porto)', 'Foz do Douro', 'Vila Nova de Gaia', 'Cedofeita'],
  'portugal-silver-coast': ['Caldas da Rainha Centro', 'Nazaré Praia', 'São Martinho do Porto', 'Foz do Arelho'],
  'portugal-cascais': ['Cascais Centro', 'Estoril', 'Monte Estoril', 'Sintra Vila'],

  // Spain
  'spain-costa-del-sol': ['Málaga Centro', 'Fuengirola', 'Marbella Casco Antiguo', 'Benalmádena'],
  'spain-valencia': ['El Carmen (Valencia)', 'Ruzafa', 'El Cabanyal', 'Gandía Playa'],
  'spain-barcelona': ['El Born', 'Gràcia', 'Poblenou', 'Sitges'],
  'spain-canary-islands': ['Santa Cruz Centro', 'Los Cristianos', 'Las Palmas Vegueta', 'Puerto de la Cruz'],

  // Greece
  'greece-athens': ['Plaka', 'Kifisia', 'Glyfada', 'Kolonaki'],
  'greece-crete': ['Chania Old Town', 'Heraklion Center', 'Rethymno', 'Agios Nikolaos'],
  'greece-corfu': ['Corfu Old Town', 'Sidari', 'Kassiopi', 'Benitses'],
  'greece-rhodes': ['Rhodes Old Town', 'Ialyssos', 'Lindos', 'Faliraki'],
  'greece-peloponnese': ['Nafplio Old Town', 'Kalamata Center', 'Patras Waterfront', 'Tolo'],

  // France
  'france-languedoc': ['Montpellier Écusson', 'Béziers Centre', 'Narbonne Ville', 'Port Camargue'],
  'france-dordogne': ['Sarlat Centre', 'Bergerac Vieux Quartier', 'Périgueux Ville', 'Montignac'],
  'france-gascony': ['Auch Centre', 'Condom Ville', 'Mirande', 'Lectoure'],
  'france-nice': ['Vieux Nice', 'Cimiez', 'Antibes Juan-les-Pins', 'Cagnes-sur-Mer'],
  'france-paris': ['Le Marais', 'Montmartre', 'Saint-Germain-des-Prés', 'Belleville'],
  'france-toulon': ['Toulon Centre', 'Hyères Centre', 'La Seyne-sur-Mer', 'Le Mourillon'],

  // Italy
  'italy-abruzzo': ['Pescara Lungomare', 'Chieti Alta', "L'Aquila Centro", 'Giulianova'],
  'italy-puglia': ['Lecce Centro', 'Ostuni Old Town', 'Bari Vecchia', 'Martina Franca'],
  'italy-sicily': ['Palermo Centro', 'Taormina', 'Cefalù', 'Catania Ursino'],
  'italy-tuscany': ['Lucca Walls', 'Siena Centro', 'Arezzo', 'Cortona'],
  'italy-sardinia': ['Cagliari Castello', 'Alghero Centro', 'Olbia', 'Villasimius'],
  'italy-lake-region': ['Stresa Lungolago', 'Bellagio Centro', 'Verbania', 'Baveno'],

  // Ireland
  'ireland-galway': ['Galway City Centre', 'Salthill', 'Oranmore', 'Knocknacarra'],
  'ireland-cork': ['Cork City Centre', 'Cobh', 'Douglas', 'Kinsale'],
  'ireland-limerick': ['Limerick City Centre', 'Adare', 'Castletroy', 'Ennis Road'],
  'ireland-wexford': ['Wexford Town Centre', 'Enniscorthy', 'Gorey', 'Rosslare'],

  // Croatia
  'croatia-dubrovnik': ['Dubrovnik Old Town', 'Lapad', 'Cavtat', 'Gruž'],
  'croatia-split': ['Split Diocletian Palace', 'Firule', 'Trogir', 'Kaštela'],
  'croatia-istria': ['Rovinj Old Town', 'Pula Arena Area', 'Poreč', 'Novigrad'],
  'croatia-zagreb': ['Zagreb Gornji Grad', 'Maksimir', 'Novi Zagreb', 'Samobor'],

  // Cyprus
  'cyprus-paphos': ['Paphos Harbour', 'Peyia', 'Coral Bay', 'Polis Chrysochous'],
  'cyprus-limassol': ['Limassol Old Town', 'Germasogeia', 'Episkopi', 'Agios Athanasios'],
  'cyprus-larnaca': ['Larnaca Centre', 'Pervolia', 'Kiti', 'Dhekelia'],

  // Malta
  'malta-valletta': ['Valletta Centre', 'Floriana', 'Senglea', 'Vittoriosa'],
  'malta-sliema': ['Sliema Seafront', "St. Julian's", 'Gżira', 'San Ġwann'],
  'malta-gozo': ['Victoria (Rabat)', 'Marsalforn', 'Xlendi', 'Xagħra'],

  // Panama
  'panama-city-bella-vista': ['Bella Vista Centro', 'Calle Uruguay Area', 'Marbella', 'Avenida Balboa'],
  'panama-city-el-cangrejo': ['El Cangrejo Centro', 'Via Argentina', 'Obarrio', 'El Carmen'],
  'panama-city-casco-viejo': ['Casco Antiguo', 'San Felipe', 'Santa Ana', 'Calidonia'],
  'panama-city-punta-pacifica': ['Punta Pacifica Towers', 'Paitilla', 'San Francisco', 'Costa del Este Entry'],
  'panama-city-costa-del-este': ['Costa del Este Centro', 'Panama Pacifico', 'Parque Lefevre', 'Ciudad del Saber'],
  'panama-coronado': ['Coronado Centro', 'Playa Coronado', 'San Carlos', 'El Palmar'],
  'panama-el-valle': ['El Valle Centro', 'La Mesa', 'El Hato', 'Chica'],
  'panama-chitre': ['Chitré Centro', 'La Arena', 'Monagrillo', 'Los Santos'],
  'panama-david': ['David Centro', 'Las Lomas', 'Pedregal', 'San Pablo Viejo'],
  'panama-pedasi': ['Pedasí Centro', 'Playa Venao', 'Los Destiladeros', 'Cañas'],
  'panama-volcan': ['Volcán Centro', 'Cerro Punta', 'Bambito', 'Paso Ancho'],
  'panama-bocas-del-toro': ['Bocas Town', 'Red Frog Beach', 'Bastimentos', 'Big Creek'],
  'panama-puerto-armuelles': ['Puerto Armuelles Centro', 'Corotú', 'Limones', 'Bella Vista (PA)'],

  // Costa Rica
  'costa-rica-central-valley': ['Escazú Centro', 'Santa Ana', 'Rohrmoser', 'San José Downtown'],
  'costa-rica-guanacaste': ['Tamarindo', 'Nosara', 'Playas del Coco', 'Liberia Centro'],
  'costa-rica-arenal': ['La Fortuna Centro', 'Nuevo Arenal', 'Tilarán', 'El Castillo'],
  'costa-rica-puerto-viejo': ['Puerto Viejo Centro', 'Playa Cocles', 'Punta Uva', 'Manzanillo'],
  'costa-rica-atenas': ['Atenas Centro', 'Barrio Jesús', 'Santa Eulalia', 'Concepción'],
  'costa-rica-grecia': ['Grecia Centro', 'San Isidro', 'Tacares', 'Puente de Piedra'],

  // Mexico
  'mexico-lake-chapala': ['Ajijic Centro', 'Chapala', 'San Juan Cosalá', 'Jocotepec'],
  'mexico-san-miguel-de-allende': ['Centro Histórico', 'Colonia San Antonio', 'Los Frailes', 'Colonia Guadalupe'],
  'mexico-merida': ['Centro Histórico', 'Paseo de Montejo', 'Colonia México', 'García Ginerés'],
  'mexico-puerto-vallarta': ['Zona Romántica', 'Marina Vallarta', 'Versalles', 'Pitillal'],
  'mexico-playa-del-carmen': ['Centro / Quinta Avenida', 'Playacar', 'Colosio', 'Gonzalo Guerrero'],
  'mexico-oaxaca': ['Centro Histórico', 'Jalatlaco', 'Reforma', 'Xochimilco'],
  'mexico-queretaro': ['Centro Histórico', 'Juriquilla', 'El Pueblito', 'Milenio III'],
  'mexico-mazatlan': ['Centro Histórico', 'Zona Dorada', 'Cerritos', 'Marina Mazatlán'],

  // Colombia
  'colombia-medellin': ['El Poblado', 'Laureles', 'Envigado', 'Belén'],
  'colombia-pereira': ['Pereira Centro', 'Cerritos', 'Dosquebradas', 'Armenia Centro'],
  'colombia-cartagena': ['Getsemaní', 'Bocagrande', 'Manga', 'El Cabrero'],
  'colombia-santa-marta': ['Centro Histórico', 'El Rodadero', 'Bello Horizonte', 'Taganga'],
  'colombia-bogota': ['Chapinero', 'Usaquén', 'La Candelaria', 'Cedritos'],

  // Ecuador
  'ecuador-cuenca': ['El Centro', 'Yanuncay', 'El Vergel', 'Misicata'],
  'ecuador-quito': ['La Mariscal', 'Cumbayá', 'González Suárez', 'La Floresta'],
  'ecuador-cotacachi': ['Cotacachi Centro', 'La Zona', 'El Cercado', 'Quiroga'],
  'ecuador-vilcabamba': ['Vilcabamba Centro', 'Hacienda Zone', 'San Pedro de Vilcabamba', 'Yamburara'],
  'ecuador-salinas': ['Salinas Malecón', 'La Milina', 'Chipipe', 'Mar Bravo'],

  // Uruguay
  'uruguay-montevideo': ['Ciudad Vieja', 'Pocitos', 'Carrasco', 'Punta Carretas'],
  'uruguay-punta-del-este': ['Punta del Este Peninsula', 'La Barra', 'José Ignacio', 'Pinares'],
  'uruguay-colonia': ['Barrio Histórico', 'Real de San Carlos', 'Colonia Centro', 'Riachuelo'],
};

// ---------------------------------------------------------------------------
// Descriptions per neighborhood index (customized by region)
// ---------------------------------------------------------------------------

function getDescriptions(locId: string, names: string[], country: string, region: string): string[] {
  // Generic but location-aware descriptions
  const city = names[0]?.split(' ')[0] || 'the area';
  return [
    `The heart of ${names[0]}, offering walkable streets, dining, cultural venues, and convenient access to services`,
    `A pleasant residential area with a quieter pace, local shops, parks, and a mix of housing options`,
    `An affordable neighborhood with practical amenities, good value housing, and a growing local community`,
    `A lively district popular with newcomers, featuring cafes, co-working spaces, and an active social scene`,
  ];
}

function getCharacterNotes(locId: string, names: string[], country: string): string[] {
  return [
    `Central location with best walkability. Close to healthcare, markets, and entertainment. Higher rents offset by lower transportation costs.`,
    `Good balance of cost and convenience. Residential character with local amenities. Well-suited for settling in long-term.`,
    `Most affordable option in the area. Quieter with more space. Car or transit pass recommended for regular errands.`,
    `Where many newcomers start. More English-friendly services. Active community with regular meetups and events.`,
  ];
}

// ---------------------------------------------------------------------------
// Expat settings by country
// ---------------------------------------------------------------------------

function getExpatSettings(country: string, expatScore: number, neighborhoodIndex: number): { communitySize: string; englishPrevalence: string } {
  const isUS = country === 'United States';
  const isIreland = country === 'Ireland';
  const isMalta = country === 'Malta';
  const isCyprus = country === 'Cyprus';

  // English-native countries
  if (isUS || isIreland) {
    return {
      communitySize: isUS ? 'not-applicable' : (neighborhoodIndex === 3 ? 'large' : neighborhoodIndex === 0 ? 'moderate' : 'small'),
      englishPrevalence: 'widespread',
    };
  }

  // English-heavy EU
  if (isMalta || isCyprus) {
    return {
      communitySize: expatScore >= 7 ? 'large' : expatScore >= 5 ? 'moderate' : 'small',
      englishPrevalence: 'widespread',
    };
  }

  // EU countries
  const isEU = ['Portugal', 'Spain', 'France', 'Italy', 'Greece', 'Croatia'].includes(country);
  if (isEU) {
    const sizeMap: Record<number, string> = { 0: 'moderate', 1: 'small', 2: 'small', 3: 'large' };
    const englishMap: Record<number, string> = { 0: 'moderate', 1: 'limited', 2: 'limited', 3: 'moderate' };

    // Adjust based on expat score
    let size = sizeMap[neighborhoodIndex] || 'small';
    let english = englishMap[neighborhoodIndex] || 'limited';
    if (expatScore >= 8) {
      size = neighborhoodIndex === 3 ? 'large' : 'moderate';
      english = neighborhoodIndex === 2 ? 'limited' : 'moderate';
    } else if (expatScore <= 3) {
      size = neighborhoodIndex === 3 ? 'small' : 'minimal';
      english = neighborhoodIndex === 3 ? 'limited' : 'limited';
    }
    return { communitySize: size, englishPrevalence: english };
  }

  // LATAM countries
  const latamEnglish: Record<number, string> = { 0: 'limited', 1: 'limited', 2: 'limited', 3: 'moderate' };
  let communitySize = 'small';
  if (expatScore >= 7) communitySize = neighborhoodIndex === 3 ? 'large' : 'moderate';
  else if (expatScore >= 5) communitySize = neighborhoodIndex === 3 ? 'moderate' : 'small';
  else communitySize = neighborhoodIndex === 3 ? 'small' : 'small';

  return {
    communitySize,
    englishPrevalence: latamEnglish[neighborhoodIndex] || 'limited',
  };
}

// ---------------------------------------------------------------------------
// Source generation
// ---------------------------------------------------------------------------

function generateSources(cityName: string, country: string): { title: string; url: string }[] {
  const encoded = encodeURIComponent(cityName);
  const sources = [
    { title: `Numbeo Cost of Living ${cityName}`, url: `https://www.numbeo.com/cost-of-living/in/${encoded.replace(/%20/g, '-')}` },
  ];

  if (country === 'United States') {
    sources.push({ title: `Walk Score - ${cityName}`, url: `https://www.walkscore.com/score/${encoded.toLowerCase().replace(/%20/g, '-')}` });
  } else {
    sources.push({ title: `Expatistan - ${cityName}`, url: `https://www.expatistan.com/cost-of-living/${encoded.toLowerCase().replace(/%20/g, '-')}` });
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Main neighborhood generator
// ---------------------------------------------------------------------------

function generateNeighborhoods(loc: LocationSeed): NeighborhoodData {
  const primaryCity = loc.cities[0];
  const rentTypical = loc.monthlyCosts.rent.typical;
  const isUSD = loc.currency === 'USD';
  const expatScore = loc.lifestyle?.expatCommunity ?? 5;
  const country = loc.country;

  // Choose template set
  let templates: NeighborhoodTemplate[];
  const isUS = country === 'United States';
  const isLatam = ['Panama', 'Costa Rica', 'Mexico', 'Colombia', 'Ecuador', 'Uruguay'].includes(country);
  const isEU = !isUS && !isLatam;

  if (isUS) templates = US_TEMPLATES;
  else if (isLatam) templates = LATAM_TEMPLATES;
  else templates = EU_TEMPLATES;

  // Get neighborhood names
  const knownNames = KNOWN_NEIGHBORHOODS[loc.id];
  const names = knownNames || generateFallbackNames(primaryCity, templates, isUS);

  const descriptions = getDescriptions(loc.id, names, country, loc.region);
  const characterNotes = getCharacterNotes(loc.id, names, country);

  const neighborhoods: Neighborhood[] = templates.map((tmpl, i) => {
    const name = names[i] || `${primaryCity} Area ${i + 1}`;
    const id = toKebab(name);
    const rent = Math.round(rentTypical * tmpl.rentMultiplier);
    const rentKey = isUSD ? 'avgRentTwoBedroomUSD' : 'avgRentTwoBedroomEUR';

    // Add some variance to scores so they're not identical per template
    const jitter = (base: number, seed: number) => {
      const offset = ((hashCode(loc.id) + seed) % 11) - 5; // -5 to +5
      return Math.max(1, Math.min(100, base + offset));
    };

    return {
      id,
      name,
      description: descriptions[i],
      character: tmpl.character,
      housing: {
        [rentKey]: rent,
        predominantType: tmpl.housingType,
      },
      walkabilityScore: jitter(tmpl.walkabilityBase, i * 13),
      transitScore: jitter(tmpl.transitBase, i * 17),
      safetyRating: tmpl.safety,
      expats: getExpatSettings(country, expatScore, i),
      character_notes: characterNotes[i],
      sources: generateSources(name, country),
    };
  });

  return {
    city: primaryCity,
    neighborhoods,
  };
}

function generateFallbackNames(city: string, templates: NeighborhoodTemplate[], isUS: boolean): string[] {
  // Generate sensible names from the city name + template suffix
  return templates.map((t) => `${city} ${t.nameSuffix}`);
}

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n🏘️  Neighborhood Data Seeder (118 locations)`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no writes)' : 'UPSERT'}\n`);

  // Load seed files
  const files = ['seed-locations-us.json', 'seed-locations-eu.json', 'seed-locations-latam.json'];
  const allLocations: LocationSeed[] = [];

  for (const file of files) {
    const filePath = join(__dirname, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LocationSeed[];
      console.log(`  📄 ${file}: ${data.length} locations`);
      allLocations.push(...data);
    } catch (err) {
      console.error(`  ❌ Failed to read ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n  Total: ${allLocations.length} locations\n`);

  if (dryRun) {
    // Preview mode: show generated data for first 3 locations
    for (const loc of allLocations.slice(0, 3)) {
      const data = generateNeighborhoods(loc);
      console.log(`  ${loc.name}:`);
      for (const n of data.neighborhoods) {
        const rentKey = Object.keys(n.housing).find(k => k.startsWith('avgRent'));
        const rent = rentKey ? (n.housing as Record<string, unknown>)[rentKey] : '?';
        console.log(`    - ${n.name} (${n.character}, rent: ${rent}, walk: ${n.walkabilityScore}, expat: ${n.expats.communitySize})`);
      }
    }
    console.log(`  ... and ${allLocations.length - 3} more locations`);
    console.log(`\n  ✅ Dry run complete. Remove --dry-run to write to database.\n`);
    return;
  }

  let upserted = 0;
  let errors = 0;

  for (const loc of allLocations) {
    try {
      const neighborhoodData = generateNeighborhoods(loc);

      await prisma.adminLocationSupplement.upsert({
        where: {
          locationId_dataType: {
            locationId: loc.id,
            dataType: 'neighborhoods',
          },
        },
        create: {
          locationId: loc.id,
          dataType: 'neighborhoods',
          data: neighborhoodData as unknown as Record<string, unknown>,
        },
        update: {
          data: neighborhoodData as unknown as Record<string, unknown>,
        },
      });

      upserted++;
      console.log(`  ✓ ${loc.name} (${neighborhoodData.neighborhoods.length} neighborhoods)`);
    } catch (err) {
      console.error(`  ❌ ${loc.id}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n  📊 Results:`);
  console.log(`     Upserted: ${upserted}`);
  if (errors) console.log(`     Errors:   ${errors}`);
  console.log(`\n  ✅ Neighborhood seed complete.\n`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
