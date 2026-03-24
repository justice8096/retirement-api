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

// ===== EXCHANGE RATE RANGES (local currency per 1 USD) =====
// Based on 10-year historical range (2016-2026) for each currency pair
// Mid = arithmetic mean of optimistic and pessimistic
//
// EUR/USD history:
//   Strongest EUR: ~$1.22/EUR (2018) → 1 USD = 0.82 EUR
//   Weakest EUR: ~$0.96/EUR (2022) → 1 USD = 1.04 EUR
//   2026 current: ~$1.08/EUR → 1 USD = 0.93 EUR
//
// For retirement planning (conservative 10-year outlook):
//   Optimistic (strong EUR, cheap for USD holders): 1 USD = 0.85 EUR ($1.18/EUR)
//   Pessimistic (weak EUR, expensive for USD holders): 1 USD = 1.02 EUR ($0.98/EUR)
//   Mid: (0.85 + 1.02) / 2 = 0.935 → rounded to 0.93

const CURRENCY_RATES = {
  EUR: {
    optimistic: 0.85,    // 1 USD = 0.85 EUR → $1.18 per EUR (strong EUR)
    pessimistic: 1.02,   // 1 USD = 1.02 EUR → $0.98 per EUR (weak EUR)
    mid: 0.93,           // 1 USD = 0.93 EUR → $1.075 per EUR (midpoint)
    note: 'EUR per 1 USD. Based on 2016-2026 historical range. Optimistic = strong EUR (good for USD→EUR), Pessimistic = weak EUR.'
  }
  // Add other currencies as needed (e.g., PAB is pegged to USD at 1:1)
};

// ===== UPDATE ALL NON-USD LOCATIONS =====
const locDirs = ['france-brittany', 'france-lyon', 'france-montpellier', 'france-toulouse',
                 'spain-alicante', 'portugal-lisbon',
                 'panama-city', 'panama-boquete',
                 'us-virginia', 'us-cherry-hill', 'us-philadelphia', 'us-richmond', 'us-savannah', 'us-florida',
                 'us-atlanta', 'us-punta-gorda', 'us-raleigh'];

let updated = 0;

for (const locId of locDirs) {
  const locPath = join(LOCATIONS_DIR, locId, 'location.json');
  if (!existsSync(locPath)) continue;

  const loc = readJSON(locPath);

  if (loc.currency === 'USD') {
    // USD locations: rate is always 1, no range needed
    if (loc.exchangeRate !== 1) {
      log(locId + ': Fixed USD rate ' + loc.exchangeRate + ' → 1');
      loc.exchangeRate = 1;
      writeJSON(locPath, loc);
      updated++;
    }
    continue;
  }

  const rates = CURRENCY_RATES[loc.currency];
  if (!rates) {
    log(locId + ': Unknown currency ' + loc.currency + ', skipping');
    continue;
  }

  const oldRate = loc.exchangeRate;
  loc.exchangeRate = rates.mid;
  loc.exchangeRates = {
    optimistic: rates.optimistic,
    pessimistic: rates.pessimistic,
    mid: rates.mid,
    note: rates.note
  };

  writeJSON(locPath, loc);
  log(locId + ': ' + loc.currency + ' rate ' + oldRate + ' → ' + rates.mid + ' (mid of ' + rates.optimistic + '/' + rates.pessimistic + ')');
  updated++;
}

log('');
log('Updated ' + updated + ' locations with mid-point exchange rates.');
log('EUR mid rate: 1 USD = 0.93 EUR ($1.075/EUR)');
log('');
log('IMPORTANT: Run "node tools/build-db.js" to rebuild the SQLite database.');
