#!/usr/bin/env node
// Normalize region taxonomy across all location.json files (FU-001).
//
// Problem:
//   The `region` field currently mixes macro regions ("Southern Europe",
//   "US Southeast") with subregions ("Virginia", "Occitanie",
//   "Chiriquí"). 34 distinct strings for 158 locations; filters and
//   compare-by-region UIs group inconsistently.
//
// Fix:
//   - `region` = macro (continent / area / US-region)
//   - `subregion` = optional state / province / department (new field)
//
// Only locations whose current `region` is clearly a subregion get
// remapped — locations already on a macro stay unchanged (subregion
// remains absent, because retrofitting a Lisbon → "Lisboa" or Abruzzo →
// "Abruzzo" split requires local geography knowledge best contributed
// per-location rather than bulk-mapped here).
//
// Idempotent: re-running on an already-normalized tree is a no-op.
//
// Usage: node tools/normalize-region-taxonomy.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');

/** current-value → { region, subregion } — mapping only the strings
 *  that are NOT already macro. Strings absent from this map are left
 *  unchanged (region stays, no subregion added). */
const REMAP = {
  // US states moved into their macro region
  'Virginia':                 { region: 'US Mid-Atlantic',  subregion: 'Virginia' },
  'Maryland':                 { region: 'US Mid-Atlantic',  subregion: 'Maryland' },
  'Georgia':                  { region: 'US Southeast',     subregion: 'Georgia' },
  'Florida':                  { region: 'US Southeast',     subregion: 'Florida' },
  'North Carolina':           { region: 'US Southeast',     subregion: 'North Carolina' },
  'South Carolina':           { region: 'US Southeast',     subregion: 'South Carolina' },
  'New Jersey':               { region: 'US Northeast',     subregion: 'New Jersey' },
  'New York':                 { region: 'US Northeast',     subregion: 'New York' },
  'Pennsylvania':             { region: 'US Northeast',     subregion: 'Pennsylvania' },
  'Texas':                    { region: 'US South Central', subregion: 'Texas' },

  // US territories collapsed under a new "US Territories" macro
  'Puerto Rico':              { region: 'US Territories', subregion: 'Puerto Rico' },
  'US Virgin Islands':        { region: 'US Territories', subregion: 'US Virgin Islands' },
  'Guam':                     { region: 'US Territories', subregion: 'Guam' },
  'American Samoa':           { region: 'US Territories', subregion: 'American Samoa' },
  'Northern Mariana Islands': { region: 'US Territories', subregion: 'Northern Mariana Islands' },

  // France subregions → Western Europe
  'Occitanie':                { region: 'Western Europe', subregion: 'Occitanie' },
  'Brittany':                 { region: 'Western Europe', subregion: 'Brittany' },
  'Auvergne-Rhone-Alpes':     { region: 'Western Europe', subregion: 'Auvergne-Rhône-Alpes' },

  // Ireland → Western Europe
  'Munster':                  { region: 'Western Europe', subregion: 'Munster' },

  // Panama subregions → Central America
  'Chiriqui':                 { region: 'Central America', subregion: 'Chiriquí' },
  'Panama Province':          { region: 'Central America', subregion: 'Panama Province' },

  // Iberian subregions → Southern Europe
  'Lisboa / Algarve':         { region: 'Southern Europe', subregion: 'Lisboa / Algarve' },
  'Valencia':                 { region: 'Southern Europe', subregion: 'Valencia' },
};

/** Macro regions after normalization — anything already here is left
 *  alone. Expanding the set requires a corresponding UI review to
 *  ensure filters/compare views handle the new value. */
const VALID_MACRO = new Set([
  'US Northeast', 'US Mid-Atlantic', 'US Southeast', 'US Midwest',
  'US South Central', 'US Southwest', 'US Mountain West', 'US West Coast',
  'US Territories',
  'Western Europe', 'Southern Europe', 'Northern Europe', 'Eastern Europe',
  'Central America', 'South America',
  'East Asia', 'South Asia', 'Southeast Asia', 'Middle East',
  'Africa', 'Oceania',
]);

/** Per-location subregion assignments for locations whose `region` is
 *  already a clean macro. Only adds `subregion` — never touches `region`.
 *  Geography-derived; run once, idempotent. Order doesn't matter. */
const ID_SUBREGION = {
  // US state extraction (id suffix → state name)
  'us-albuquerque-nm':         'New Mexico',
  'us-armstrong-county-pa':    'Pennsylvania',
  'us-asheville-nc':           'North Carolina',
  'us-birmingham-al':          'Alabama',
  'us-chesapeake-va':          'Virginia',
  'us-chicago-il':             'Illinois',
  'us-cleveland-oh':           'Ohio',
  'us-dallas-tx':              'Texas',
  'us-denver-co':              'Colorado',
  'us-fort-lauderdale-fl':     'Florida',
  'us-fort-wayne-in':          'Indiana',
  'us-fort-worth-tx':          'Texas',
  'us-grand-forks-nd':         'North Dakota',
  'us-killeen-tx':             'Texas',
  'us-lapeer-mi':              'Michigan',
  'us-little-rock-ar':         'Arkansas',
  'us-lorain-oh':              'Ohio',
  'us-lynchburg-va':           'Virginia',
  'us-miami-fl':               'Florida',
  'us-milwaukee-wi':           'Wisconsin',
  'us-minneapolis-mn':         'Minnesota',
  'us-nashville-tn':           'Tennessee',
  'us-norfolk-va':             'Virginia',
  'us-oakland-county-mi':      'Michigan',
  'us-palm-bay-fl':            'Florida',
  'us-pittsburgh-pa':          'Pennsylvania',
  'us-port-huron-mi':          'Michigan',
  'us-portsmouth-va':          'Virginia',
  'us-quincy-fl':              'Florida',
  'us-saint-paul-mn':          'Minnesota',
  'us-san-marcos-tx':          'Texas',
  'us-skowhegan-me':           'Maine',
  'us-st-augustine-fl':        'Florida',
  'us-st-petersburg-fl':       'Florida',
  'us-tampa-fl':               'Florida',
  'us-virginia-beach-va':      'Virginia',
  'us-williamsport-pa':        'Pennsylvania',
  'us-yulee-fl':               'Florida',

  // Colombia (departments)
  'colombia-bogota':           'Distrito Capital',
  'colombia-cartagena':        'Bolívar',
  'colombia-medellin':         'Antioquia',
  'colombia-pereira':          'Risaralda',
  'colombia-santa-marta':      'Magdalena',

  // Costa Rica (provincias)
  'costa-rica-arenal':         'Alajuela',
  'costa-rica-atenas':         'Alajuela',
  'costa-rica-central-valley': 'Central Valley',
  'costa-rica-grecia':         'Alajuela',
  'costa-rica-guanacaste':     'Guanacaste',
  'costa-rica-puerto-viejo':   'Limón',

  // Croatia (županije)
  'croatia-dubrovnik':         'Dubrovnik-Neretva',
  'croatia-istria':            'Istria',
  'croatia-split':             'Split-Dalmatia',
  'croatia-zagreb':            'Zagreb',

  // Cyprus (districts)
  'cyprus-larnaca':            'Larnaca District',
  'cyprus-limassol':           'Limassol District',
  'cyprus-paphos':             'Paphos District',

  // Ecuador (provincias)
  'ecuador-cotacachi':         'Imbabura',
  'ecuador-cuenca':            'Azuay',
  'ecuador-quito':             'Pichincha',
  'ecuador-salinas':           'Santa Elena',
  'ecuador-vilcabamba':        'Loja',

  // France (régions — 2016 reform names)
  'france-dordogne':           'Nouvelle-Aquitaine',
  'france-gascony':            'Nouvelle-Aquitaine',
  'france-languedoc':          'Occitanie',
  'france-nice':               "Provence-Alpes-Côte d'Azur",
  'france-paris':              'Île-de-France',
  'france-toulon':             "Provence-Alpes-Côte d'Azur",

  // Greece (peripheries)
  'greece-athens':             'Attica',
  'greece-corfu':              'Ionian Islands',
  'greece-crete':              'Crete',
  'greece-peloponnese':        'Peloponnese',
  'greece-rhodes':             'South Aegean',

  // Ireland (provinces)
  'ireland-cork':              'Munster',
  'ireland-galway':            'Connacht',
  'ireland-limerick':          'Munster',
  'ireland-wexford':           'Leinster',

  // Italy (regioni)
  'italy-abruzzo':             'Abruzzo',
  'italy-lake-region':         'Lombardy',
  'italy-puglia':              'Apulia',
  'italy-sardinia':            'Sardinia',
  'italy-sicily':              'Sicily',
  'italy-tuscany':             'Tuscany',

  // Malta (regions)
  'malta-gozo':                'Gozo',
  'malta-sliema':              'Central Region',
  'malta-valletta':            'South Eastern Region',

  // Mexico (estados)
  'mexico-lake-chapala':       'Jalisco',
  'mexico-mazatlan':           'Sinaloa',
  'mexico-merida':             'Yucatán',
  'mexico-oaxaca':             'Oaxaca',
  'mexico-playa-del-carmen':   'Quintana Roo',
  'mexico-puerto-vallarta':    'Jalisco',
  'mexico-queretaro':          'Querétaro',
  'mexico-san-miguel-de-allende': 'Guanajuato',

  // Panama (provincias) — panama-city-* are neighborhoods within Panama
  // City proper, so all roll up to "Panama Province"
  'panama-bocas-del-toro':     'Bocas del Toro',
  'panama-chitre':             'Herrera',
  'panama-city-bella-vista':   'Panama Province',
  'panama-city-casco-viejo':   'Panama Province',
  'panama-city-costa-del-este':'Panama Province',
  'panama-city-el-cangrejo':   'Panama Province',
  'panama-city-punta-pacifica':'Panama Province',
  'panama-coronado':           'Panamá Oeste',
  'panama-david':              'Chiriquí',
  'panama-el-valle':           'Coclé',
  'panama-pedasi':             'Los Santos',
  'panama-puerto-armuelles':   'Chiriquí',
  'panama-volcan':             'Chiriquí',

  // Portugal (NUTS II regions)
  'portugal-algarve':          'Algarve',
  'portugal-cascais':          'Lisboa',
  'portugal-porto':            'Norte',
  'portugal-silver-coast':     'Centro',

  // Spain (comunidades autónomas)
  'spain-barcelona':           'Catalonia',
  'spain-canary-islands':      'Canary Islands',
  'spain-costa-del-sol':       'Andalusia',
  'spain-valencia':            'Valencia',

  // Uruguay (departamentos)
  'uruguay-colonia':           'Colonia',
  'uruguay-montevideo':        'Montevideo',
  'uruguay-punta-del-este':    'Maldonado',
};

const ids = readdirSync(LOC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

let changed = 0;
let subregionAdded = 0;
let alreadyMacro = 0;
let unmapped = 0;
const unmappedList = [];

for (const id of ids) {
  const path = join(LOC_DIR, id, 'location.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const current = data.region;
  if (!current) continue;

  if (REMAP[current]) {
    const { region, subregion } = REMAP[current];
    // Per-id override wins when present (e.g. us-virginia-va stays on
    // "Virginia" rather than getting the REMAP-level subregion).
    const finalSubregion = ID_SUBREGION[id] ?? subregion;
    if (data.region === region && data.subregion === finalSubregion) continue;
    data.region = region;
    data.subregion = finalSubregion;
    changed++;
    console.log(`  ${id.padEnd(30)} "${current}" → region="${region}" subregion="${finalSubregion}"`);
    if (!dryRun) writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    continue;
  }

  if (VALID_MACRO.has(current)) {
    // Already on a macro — check if we have a subregion override to add.
    const sub = ID_SUBREGION[id];
    if (sub && data.subregion !== sub) {
      data.subregion = sub;
      subregionAdded++;
      console.log(`  ${id.padEnd(30)} region="${current}" + subregion="${sub}"`);
      if (!dryRun) writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
      continue;
    }
    alreadyMacro++;
    continue;
  }

  unmapped++;
  unmappedList.push({ id, region: current });
}

console.log('');
console.log(`Remapped (region → subregion):        ${changed}`);
console.log(`Subregion added (already on macro):   ${subregionAdded}`);
console.log(`Already macro, no subregion mapping:  ${alreadyMacro}`);
console.log(`Unmapped:                              ${unmapped}`);
if (unmappedList.length) {
  console.log('\nUnmapped regions (left untouched — add to REMAP or VALID_MACRO):');
  for (const u of unmappedList) {
    console.log(`  ${u.id.padEnd(28)} "${u.region}"`);
  }
}
if (dryRun) console.log('\n[dry-run — no files written]');
