#!/usr/bin/env node
/**
 * Augment every location's services.json with 14 new community-oriented
 * entries:
 *
 *   Clothing (chain-mapped by country, real chain URLs):
 *     - clothing_womens       (Women's clothing)
 *     - clothing_mens         (Men's clothing)
 *     - clothing_childrens    (Children's clothing)
 *     - clothing_bigtall      (Big & Tall clothing)
 *
 *   Community / cultural (directory-link placeholders — Google Maps
 *   search pre-filtered to the location, within ~30 miles / ~48 km):
 *     - religious_mosque
 *     - religious_synagogue
 *     - grocery_halal
 *     - grocery_kosher
 *     - hair_care_african
 *     - restaurant_local          (top-rated local cuisine)
 *     - restaurant_italian
 *     - restaurant_mexican
 *     - restaurant_thai_or_asian
 *     - restaurant_indian
 *
 * Distance set to 30 mi (48.28 km) for all entries — they represent
 * "search within 30 miles" queries, not specific brick-and-mortar
 * branches. Per-city curation can replace them later with vetted
 * locals. Each entry is idempotent (checked by categoryId).
 *
 * Usage:  node scripts/augment-services-community-categories.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const ACCESSED = new Date().toISOString().slice(0, 10);

// Rough country-currency / chain map (clothing). Fallback to global Zara/H&M when
// the country doesn't have a distinctive local chain.
const CLOTHING = {
  us: {
    womens:     { name: 'Macy\'s',             url: 'https://www.macys.com/' },
    mens:       { name: 'Men\'s Wearhouse',    url: 'https://www.menswearhouse.com/' },
    childrens:  { name: 'The Children\'s Place', url: 'https://www.childrensplace.com/' },
    bigtall:    { name: 'Destination XL',      url: 'https://www.destinationxl.com/' },
  },
  france: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/fr/' },
    mens:       { name: 'Celio',               url: 'https://www.celio.com/' },
    childrens:  { name: 'Petit Bateau',        url: 'https://www.petit-bateau.com/' },
    bigtall:    { name: 'Size Factory',        url: 'https://www.sizefactory.com/' },
  },
  italy: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/it/' },
    mens:       { name: 'OVS',                 url: 'https://www.ovs.it/' },
    childrens:  { name: 'OVS Kids',            url: 'https://www.ovs.it/kids' },
    bigtall:    { name: 'Marina Rinaldi (plus-size women)', url: 'https://www.marinarinaldi.com/' },
  },
  spain: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/es/' },
    mens:       { name: 'Mango',               url: 'https://shop.mango.com/es' },
    childrens:  { name: 'Zara Kids',           url: 'https://www.zara.com/es/en/kids-mkt1350.html' },
    bigtall:    { name: 'Primark (extended sizing)', url: 'https://www.primark.com/es' },
  },
  portugal: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/pt/' },
    mens:       { name: 'Tiffosi',             url: 'https://www.tiffosi.com/' },
    childrens:  { name: 'Zippy',               url: 'https://www.zippy.com/pt/' },
    bigtall:    { name: 'Primark (extended sizing)', url: 'https://www.primark.com/pt' },
  },
  ireland: {
    womens:     { name: 'Penneys / Primark',   url: 'https://www.primark.com/en-ie' },
    mens:       { name: 'Dunnes Stores',       url: 'https://www.dunnesstores.com/' },
    childrens:  { name: 'Dunnes Stores Kids',  url: 'https://www.dunnesstores.com/c/kids' },
    bigtall:    { name: 'Marks & Spencer',     url: 'https://www.marksandspencer.com/ie' },
  },
  greece: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/gr/' },
    mens:       { name: 'Celestino',           url: 'https://www.celestino.gr/' },
    childrens:  { name: 'Zara Kids',           url: 'https://www.zara.com/gr/en/kids' },
    bigtall:    { name: 'XXL Makri',           url: 'https://www.xxlmakri.gr/' },
  },
  croatia: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/hr/' },
    mens:       { name: 'C&A',                 url: 'https://www.c-and-a.com/hr/hr/shop' },
    childrens:  { name: 'Zara Kids',           url: 'https://www.zara.com/hr/hr/kids' },
    bigtall:    { name: 'H&M (extended sizing)', url: 'https://www2.hm.com/hr_hr/index.html' },
  },
  cyprus: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/cy/' },
    mens:       { name: 'Debenhams',           url: 'https://www.debenhams.com.cy/' },
    childrens:  { name: 'Zara Kids',           url: 'https://www.zara.com/cy/en/kids' },
    bigtall:    { name: 'Marks & Spencer',     url: 'https://www.marksandspencer.com/cy' },
  },
  malta: {
    womens:     { name: 'Zara',                url: 'https://www.zara.com/mt/' },
    mens:       { name: 'Marks & Spencer',     url: 'https://www.marksandspencer.com/mt' },
    childrens:  { name: 'Zara Kids',           url: 'https://www.zara.com/mt/en/kids' },
    bigtall:    { name: 'Debenhams Malta',     url: 'https://www.debenhams.com.mt/' },
  },
  mexico: {
    womens:     { name: 'Liverpool',           url: 'https://www.liverpool.com.mx/' },
    mens:       { name: 'Sears Mexico',        url: 'https://www.sears.com.mx/' },
    childrens:  { name: 'Carter\'s',           url: 'https://www.carters.com.mx/' },
    bigtall:    { name: 'Amazon Mexico (plus/big-tall)', url: 'https://www.amazon.com.mx/b?node=11260353011' },
  },
  panama: {
    womens:     { name: 'Felix B. Maduro',     url: 'https://www.fbm.com.pa/' },
    mens:       { name: 'Stevens',             url: 'https://www.stevens.com.pa/' },
    childrens:  { name: 'Carter\'s Panama',    url: 'https://www.carters.com/' },
    bigtall:    { name: 'Amazon (ships to Panama)', url: 'https://www.amazon.com/' },
  },
  colombia: {
    womens:     { name: 'Falabella',           url: 'https://www.falabella.com.co/' },
    mens:       { name: 'Arturo Calle',        url: 'https://www.arturocalle.com/' },
    childrens:  { name: 'OFFCORSS',            url: 'https://www.offcorss.com/' },
    bigtall:    { name: 'Falabella (extended sizing)', url: 'https://www.falabella.com.co/' },
  },
  'costa-rica': {
    womens:     { name: 'Universal',           url: 'https://www.tiendauniversal.com/' },
    mens:       { name: 'Aliss',               url: 'https://www.aliss.com/' },
    childrens:  { name: 'Carter\'s Costa Rica', url: 'https://www.carters.com/' },
    bigtall:    { name: 'Amazon (ships to CR)', url: 'https://www.amazon.com/' },
  },
  ecuador: {
    womens:     { name: 'De Prati',            url: 'https://www.deprati.com.ec/' },
    mens:       { name: 'Etafashion',          url: 'https://www.etafashion.com/' },
    childrens:  { name: 'Coquito',             url: 'https://www.coquito.com.ec/' },
    bigtall:    { name: 'Amazon (ships to EC)', url: 'https://www.amazon.com/' },
  },
  uruguay: {
    womens:     { name: 'Indian Emporium',     url: 'https://indian.com.uy/' },
    mens:       { name: 'Mouse',               url: 'https://mouse.com.uy/' },
    childrens:  { name: 'Baby Cottons',        url: 'https://www.babycottons.com/' },
    bigtall:    { name: 'MercadoLibre (plus/big-tall)', url: 'https://listado.mercadolibre.com.uy/ropa-talles-grandes' },
  },
};

/** Slug from location dir; handles 'costa-rica-*' two-word slug. */
function slugForDir(dir) {
  if (dir.startsWith('costa-rica-')) return 'costa-rica';
  return dir.split('-', 1)[0];
}

function gmapsSearch(query, location) {
  const q = encodeURIComponent(`${query} near ${location}`);
  return `https://www.google.com/maps/search/${q}`;
}

/**
 * Build directory-link entries for a given location. `locLabel` is the
 * human-readable city/region used in the search query.
 */
function directoryEntries(locLabel) {
  return [
    { categoryId: 'religious_mosque',         name: 'Local mosques (search)',             query: 'mosque',                   notes: 'Search Google Maps for mosques within ~30 mi of the city centre. Replace with a specific mosque once identified.' },
    { categoryId: 'religious_synagogue',      name: 'Local synagogues / Hebrew temples (search)', query: 'synagogue',       notes: 'Search Google Maps for synagogues / Hebrew temples within ~30 mi.' },
    { categoryId: 'grocery_halal',            name: 'Halal groceries (search)',           query: 'halal grocery',            notes: 'Search Google Maps for halal butchers / halal grocery stores within ~30 mi.' },
    { categoryId: 'grocery_kosher',           name: 'Kosher groceries (search)',          query: 'kosher grocery',           notes: 'Search Google Maps for kosher grocery stores within ~30 mi.' },
    { categoryId: 'hair_care_african',        name: 'Black / African hair care (search)', query: 'black hair salon',         notes: 'Search Google Maps for African / Black hair salons and natural-hair specialists within ~30 mi.' },
    { categoryId: 'restaurant_local',         name: 'Top-rated local cuisine (search)',   query: 'top rated local restaurants', notes: 'Highest-rated local-cuisine restaurants within ~30 mi (Google Maps rating-sorted).' },
    { categoryId: 'restaurant_italian',       name: 'Italian restaurants (search)',       query: 'italian restaurant',       notes: 'Italian / pizza restaurants within ~30 mi.' },
    { categoryId: 'restaurant_mexican',       name: 'Mexican restaurants (search)',       query: 'mexican restaurant',       notes: 'Mexican / Tex-Mex restaurants within ~30 mi.' },
    { categoryId: 'restaurant_thai_or_asian', name: 'Thai / other Asian restaurants (search)', query: 'thai restaurant',    notes: 'Thai, Vietnamese, Korean, or pan-Asian restaurants within ~30 mi.' },
    { categoryId: 'restaurant_indian',        name: 'Indian restaurants (search)',        query: 'indian restaurant',        notes: 'Indian / South Asian restaurants within ~30 mi.' },
  ].map(e => ({
    categoryId: e.categoryId,
    name: e.name,
    distanceMi: 30,
    notes: e.notes,
    sources: [
      { title: `Google Maps — ${e.query} near ${locLabel}`, url: gmapsSearch(e.query, locLabel), accessed: ACCESSED },
    ],
  }));
}

/** Build clothing entries from the per-country map. */
function clothingEntries(slug, countryLabel) {
  const set = CLOTHING[slug];
  if (!set) return [];
  const chains = [
    { kind: 'womens',    categoryId: 'clothing_womens',    prefix: 'Women\'s clothing' },
    { kind: 'mens',      categoryId: 'clothing_mens',      prefix: 'Men\'s clothing' },
    { kind: 'childrens', categoryId: 'clothing_childrens', prefix: 'Children\'s clothing' },
    { kind: 'bigtall',   categoryId: 'clothing_bigtall',   prefix: 'Big & Tall clothing' },
  ];
  return chains.map(c => ({
    categoryId: c.categoryId,
    name: set[c.kind].name,
    distanceMi: 30,
    notes: `${c.prefix} — ${countryLabel} chain / directory.`,
    sources: [
      { title: set[c.kind].name, url: set[c.kind].url, accessed: ACCESSED },
    ],
  }));
}

let augmented = 0;
let skipped = 0;

for (const dir of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const servicesPath = join(DATA_DIR, dir.name, 'services.json');
  if (!existsSync(servicesPath)) { skipped++; continue; }

  const slug = slugForDir(dir.name);
  const data = JSON.parse(readFileSync(servicesPath, 'utf-8'));
  const services = Array.isArray(data.services) ? data.services : [];

  // Prefer `location.json` name for the directory-search label. Fall back
  // to the dir name.
  let locLabel = dir.name;
  const locJsonPath = join(DATA_DIR, dir.name, 'location.json');
  if (existsSync(locJsonPath)) {
    try {
      const lj = JSON.parse(readFileSync(locJsonPath, 'utf-8'));
      locLabel = lj.name || locLabel;
    } catch { /* fall back */ }
  }
  const countryLabel = (() => {
    try {
      const lj = JSON.parse(readFileSync(locJsonPath, 'utf-8'));
      return lj.country || 'local';
    } catch { return 'local'; }
  })();

  const toAdd = [
    ...clothingEntries(slug, countryLabel),
    ...directoryEntries(locLabel),
  ];

  let touched = false;
  for (const e of toAdd) {
    const exists = services.some(s => s && s.categoryId === e.categoryId);
    if (exists) continue;
    services.push(e);
    touched = true;
  }

  if (touched) {
    data.services = services;
    writeFileSync(servicesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    augmented++;
  } else {
    skipped++;
  }
}

console.log(`augmented: ${augmented}`);
console.log(`skipped:   ${skipped}`);
