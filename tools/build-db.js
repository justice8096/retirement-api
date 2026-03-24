import Database from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'retirement.db');

function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function log(msg) { process.stderr.write(msg + '\n'); }

// ===== CREATE DATABASE =====
log('Creating database at ' + DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== SCHEMA =====
db.exec(`
  DROP TABLE IF EXISTS grocery_lists;
  DROP TABLE IF EXISTS groceries;
  DROP TABLE IF EXISTS detailed_costs;
  DROP TABLE IF EXISTS inclusion;
  DROP TABLE IF EXISTS attractions;
  DROP TABLE IF EXISTS services;
  DROP TABLE IF EXISTS neighborhoods;
  DROP TABLE IF EXISTS monthly_costs;
  DROP TABLE IF EXISTS service_categories;
  DROP TABLE IF EXISTS inclusion_methodology;
  DROP TABLE IF EXISTS household_profile;
  DROP TABLE IF EXISTS locations;

  CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    cities TEXT,
    currency TEXT,
    exchange_rate REAL DEFAULT 1.0,
    monthly_cost_usd REAL,
    visa_type TEXT,
    visa_income_req TEXT,
    visa_notes TEXT,
    climate_winter_low_f INTEGER,
    climate_summer_high_f INTEGER,
    climate_rainy_days INTEGER,
    climate_warm_winter INTEGER DEFAULT 0,
    taxes_json TEXT,
    healthcare_json TEXT,
    lifestyle_json TEXT,
    pros TEXT,
    cons TEXT
  );

  CREATE TABLE monthly_costs (
    location_id TEXT NOT NULL,
    category TEXT NOT NULL,
    min_val REAL,
    max_val REAL,
    typical REAL,
    type_desc TEXT,
    notes TEXT,
    annual_inflation REAL,
    breakdown_json TEXT,
    PRIMARY KEY (location_id, category),
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE neighborhoods (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    character TEXT,
    housing_json TEXT,
    walkability_score INTEGER,
    transit_score INTEGER,
    safety_rating TEXT,
    expat_community_size TEXT,
    expat_english TEXT,
    character_notes TEXT,
    sources_json TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    address TEXT,
    distance_km REAL,
    notes TEXT,
    sources_json TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE attractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id TEXT NOT NULL,
    type TEXT,
    name TEXT NOT NULL,
    description TEXT,
    cost TEXT,
    distance_km REAL,
    sources_json TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE inclusion (
    location_id TEXT PRIMARY KEY,
    country TEXT,
    region TEXT,
    overall_score REAL,
    last_updated TEXT,
    categories_json TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE detailed_costs (
    location_id TEXT NOT NULL,
    section TEXT NOT NULL,
    data_json TEXT,
    PRIMARY KEY (location_id, section),
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE groceries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id TEXT,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    price_usd REAL,
    is_default INTEGER DEFAULT 1,
    for_whom TEXT,
    notes TEXT
  );

  CREATE TABLE grocery_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id TEXT,
    list_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    items_json TEXT
  );

  CREATE TABLE household_profile (
    key TEXT PRIMARY KEY,
    value_json TEXT
  );

  CREATE TABLE service_categories (
    id TEXT PRIMARY KEY,
    label TEXT,
    icon TEXT
  );

  CREATE TABLE inclusion_methodology (
    key TEXT PRIMARY KEY,
    data_json TEXT
  );

  CREATE INDEX idx_monthly_costs_loc ON monthly_costs(location_id);
  CREATE INDEX idx_neighborhoods_loc ON neighborhoods(location_id);
  CREATE INDEX idx_services_loc ON services(location_id);
  CREATE INDEX idx_services_cat ON services(category_id);
  CREATE INDEX idx_attractions_loc ON attractions(location_id);
  CREATE INDEX idx_detailed_costs_loc ON detailed_costs(location_id);
  CREATE INDEX idx_groceries_loc ON groceries(location_id);
`);

log('Schema created.');

// ===== LOAD INDEX =====
const index = readJSON(join(DATA_DIR, 'index.json'));
if (!index) { log('ERROR: data/index.json not found'); process.exit(1); }

// Store household profile
const insertProfile = db.prepare('INSERT INTO household_profile (key, value_json) VALUES (?, ?)');
insertProfile.run('householdProfile', JSON.stringify(index.householdProfile));
log('Household profile stored.');

// ===== LOAD SHARED DATA =====
const svcCat = readJSON(join(DATA_DIR, 'shared', 'service-categories.json'));
if (svcCat && svcCat.serviceCategories) {
  const insertSvcCat = db.prepare('INSERT INTO service_categories (id, label, icon) VALUES (?, ?, ?)');
  const insertManySvcCat = db.transaction((cats) => {
    for (const c of cats) insertSvcCat.run(c.id, c.label, c.icon || null);
  });
  insertManySvcCat(svcCat.serviceCategories);
  log('Service categories: ' + svcCat.serviceCategories.length);
}

const inclMethod = readJSON(join(DATA_DIR, 'shared', 'inclusion-methodology.json'));
if (inclMethod) {
  const insertIM = db.prepare('INSERT INTO inclusion_methodology (key, data_json) VALUES (?, ?)');
  if (inclMethod.methodology) insertIM.run('methodology', JSON.stringify(inclMethod.methodology));
  if (inclMethod.comparativeAnalysis) insertIM.run('comparativeAnalysis', JSON.stringify(inclMethod.comparativeAnalysis));
  log('Inclusion methodology stored.');
}

const ss = readJSON(join(DATA_DIR, 'shared', 'social-security.json'));
if (ss) {
  insertProfile.run('socialSecurity', JSON.stringify(ss));
  log('Social security data stored.');
}

// ===== LOAD LOCATIONS =====
const insertLoc = db.prepare(`INSERT INTO locations (id, name, country, region, cities, currency, exchange_rate,
  monthly_cost_usd, visa_type, visa_income_req, visa_notes, climate_winter_low_f, climate_summer_high_f,
  climate_rainy_days, climate_warm_winter, taxes_json, healthcare_json, lifestyle_json, pros, cons)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertCost = db.prepare(`INSERT INTO monthly_costs (location_id, category, min_val, max_val, typical,
  type_desc, notes, annual_inflation, breakdown_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertNH = db.prepare(`INSERT INTO neighborhoods (id, location_id, name, description, character,
  housing_json, walkability_score, transit_score, safety_rating, expat_community_size, expat_english,
  character_notes, sources_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertSvc = db.prepare(`INSERT INTO services (location_id, category_id, name, address, distance_km,
  notes, sources_json) VALUES (?, ?, ?, ?, ?, ?, ?)`);

const insertAttr = db.prepare(`INSERT INTO attractions (location_id, type, name, description, cost,
  distance_km, sources_json) VALUES (?, ?, ?, ?, ?, ?, ?)`);

const insertIncl = db.prepare(`INSERT INTO inclusion (location_id, country, region, overall_score,
  last_updated, categories_json) VALUES (?, ?, ?, ?, ?, ?)`);

const insertDC = db.prepare(`INSERT INTO detailed_costs (location_id, section, data_json) VALUES (?, ?, ?)`);

const locDirs = readdirSync(join(DATA_DIR, 'locations'));
let locCount = 0;

const loadAll = db.transaction(() => {
  for (const locDir of locDirs) {
    const locPath = join(DATA_DIR, 'locations', locDir, 'location.json');
    const loc = readJSON(locPath);
    if (!loc) { log('  SKIP ' + locDir + ' — no location.json'); continue; }

    // Calculate monthly cost
    let monthlyCost = 0;
    if (loc.monthlyCosts) {
      monthlyCost = Object.values(loc.monthlyCosts).reduce((s, c) => s + (c.typical || 0), 0);
    }

    insertLoc.run(
      loc.id, loc.name, loc.country, loc.region,
      JSON.stringify(loc.cities || []),
      loc.currency, loc.exchangeRate || 1,
      monthlyCost,
      loc.visa ? loc.visa.type : null,
      loc.visa ? (typeof loc.visa.incomeRequirement === 'object' ? JSON.stringify(loc.visa.incomeRequirement) : (loc.visa.incomeRequirement || null)) : null,
      loc.visa ? (loc.visa.notes || null) : null,
      loc.climate ? loc.climate.winterLowF : null,
      loc.climate ? loc.climate.summerHighF : null,
      loc.climate ? (loc.climate.rainyDaysPerYear || null) : null,
      loc.climate ? (loc.climate.meetsWarmWinterReq ? 1 : 0) : 0,
      JSON.stringify(loc.taxes || {}),
      JSON.stringify(loc.healthcare || {}),
      JSON.stringify(loc.lifestyle || {}),
      JSON.stringify(loc.pros || []),
      JSON.stringify(loc.cons || [])
    );

    // Monthly costs
    if (loc.monthlyCosts) {
      for (const [cat, data] of Object.entries(loc.monthlyCosts)) {
        insertCost.run(
          loc.id, cat,
          data.min || null, data.max || null, data.typical || null,
          data.type || null, data.notes || null,
          data.annualInflation || null,
          data.breakdown ? JSON.stringify(data.breakdown) : null
        );
      }
    }

    // Neighborhoods
    const nhData = readJSON(join(DATA_DIR, 'locations', locDir, 'neighborhoods.json'));
    if (nhData && nhData.neighborhoods) {
      for (const nh of nhData.neighborhoods) {
        insertNH.run(
          nh.id, loc.id, nh.name, nh.description, nh.character,
          JSON.stringify(nh.housing || {}),
          nh.walkabilityScore || null, nh.transitScore || null,
          nh.safetyRating || null,
          nh.expats ? nh.expats.communitySize : null,
          nh.expats ? nh.expats.englishPrevalence : null,
          nh.character_notes || null,
          JSON.stringify(nh.sources || [])
        );
      }
    }

    // Services
    const svcData = readJSON(join(DATA_DIR, 'locations', locDir, 'services.json'));
    if (svcData) {
      if (svcData.services) {
        for (const s of svcData.services) {
          insertSvc.run(loc.id, s.categoryId, s.name, s.address, s.distanceKm,
            s.notes, JSON.stringify(s.sources || []));
        }
      }
      if (svcData.attractions) {
        for (const a of svcData.attractions) {
          insertAttr.run(loc.id, a.type, a.name, a.description,
            a.cost || null, a.distanceKm || null, JSON.stringify(a.sources || []));
        }
      }
    }

    // Inclusion
    const inclData = readJSON(join(DATA_DIR, 'locations', locDir, 'inclusion.json'));
    if (inclData) {
      insertIncl.run(loc.id, inclData.country, inclData.region,
        inclData.overallInclusionScore || null, inclData.lastUpdated || null,
        JSON.stringify(inclData.categories || {}));
    }

    // Detailed costs
    const dcData = readJSON(join(DATA_DIR, 'locations', locDir, 'detailed-costs.json'));
    if (dcData) {
      for (const [section, data] of Object.entries(dcData)) {
        insertDC.run(loc.id, section, JSON.stringify(data));
      }
    }

    locCount++;
    log('  Loaded: ' + loc.name);
  }
});

loadAll();
log('Locations loaded: ' + locCount);

// ===== LOAD GROCERY DEFAULTS =====
const groceryDefaults = readJSON(join(DATA_DIR, 'shared', 'grocery-defaults.json'));
if (groceryDefaults && groceryDefaults.categories) {
  const insertGrocery = db.prepare(`INSERT INTO groceries (location_id, category, item_name, quantity, unit,
    price_usd, is_default, for_whom, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const loadGroceries = db.transaction(() => {
    let count = 0;
    for (const cat of groceryDefaults.categories) {
      for (const item of cat.items) {
        // Insert as global defaults (location_id = NULL means applies everywhere)
        insertGrocery.run(null, cat.id, item.name, item.quantity, item.unit,
          item.weeklyPriceUSD, item.isDefault ? 1 : 0, item.forWhom, item.notes || null);
        count++;
      }
    }
    return count;
  });
  const grocCount = loadGroceries();
  log('Grocery defaults loaded: ' + grocCount + ' items');

  // Also store the meta
  insertProfile.run('groceryMeta', JSON.stringify(groceryDefaults.meta));
}

// ===== EXPORT AS SQL.JS COMPATIBLE =====
// sql.js in the browser needs a raw binary file — better-sqlite3 already produces this format
log('');
log('Database built successfully: ' + DB_PATH);
log('Tables: locations, monthly_costs, neighborhoods, services, attractions, inclusion, detailed_costs, groceries, grocery_lists, household_profile, service_categories, inclusion_methodology');

const stats = {
  locations: db.prepare('SELECT COUNT(*) as c FROM locations').get().c,
  monthlyCosts: db.prepare('SELECT COUNT(*) as c FROM monthly_costs').get().c,
  neighborhoods: db.prepare('SELECT COUNT(*) as c FROM neighborhoods').get().c,
  services: db.prepare('SELECT COUNT(*) as c FROM services').get().c,
  attractions: db.prepare('SELECT COUNT(*) as c FROM attractions').get().c,
  inclusion: db.prepare('SELECT COUNT(*) as c FROM inclusion').get().c,
  detailedCosts: db.prepare('SELECT COUNT(*) as c FROM detailed_costs').get().c,
  groceries: db.prepare('SELECT COUNT(*) as c FROM groceries').get().c
};
log('Row counts: ' + JSON.stringify(stats));

db.close();
log('Done.');
