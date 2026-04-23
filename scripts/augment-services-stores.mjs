#!/usr/bin/env node
/**
 * Augment each location's services.json with chain-level store entries:
 *   - grocery (mainstream supermarket)
 *   - grocery (bargain / discount chain, Aldi/Lidl preferred where present)
 *   - electronics
 *   - hardware / home-improvement
 *
 * Notes:
 *   - Generic / chain-level (not per-branch). Address / distance omitted.
 *   - Idempotent: skips entries whose `name + categoryId` already exist.
 *   - `accessed` date = ISO YYYY-MM-DD of run.
 *
 * Usage:  node scripts/augment-services-stores.mjs  (from repo root)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const ACCESSED = new Date().toISOString().slice(0, 10);

/** Country slug (as seen in location dir name prefix) → chain map. */
const COUNTRY_STORES = {
  colombia: {
    mainstream: { name: 'Éxito', url: 'https://www.exito.com/', notes: 'Largest mainstream supermarket chain in Colombia.' },
    bargain:    { name: 'D1',    url: 'https://tiendasd1.com/', notes: 'Colombia\'s largest hard-discount chain. Private-label focus, very low prices.' },
    electronics:{ name: 'Alkosto', url: 'https://www.alkosto.com/', notes: 'Major electronics + appliances chain.' },
    hardware:   { name: 'Homecenter (Sodimac)', url: 'https://www.homecenter.com.co/', notes: 'Hardware, building supplies, home goods.' },
  },
  'costa-rica': {
    mainstream: { name: 'AutoMercado', url: 'https://automercado.cr/', notes: 'Mid-to-upscale supermarket chain popular with expats; broad imported selection.' },
    bargain:    { name: 'PriceSmart', url: 'https://www.pricesmart.com/site/cr/en/', notes: 'Membership warehouse club (similar to Costco). Bulk + low unit prices.' },
    electronics:{ name: 'Monge', url: 'https://www.monge.cr/', notes: 'Electronics, appliances, furniture chain.' },
    hardware:   { name: 'EPA', url: 'https://www.epa.co.cr/', notes: 'Home-improvement megastore.' },
  },
  croatia: {
    mainstream: { name: 'Konzum', url: 'https://www.konzum.hr/', notes: 'Croatia\'s largest supermarket chain.' },
    bargain:    { name: 'Lidl',    url: 'https://www.lidl.hr/', notes: 'German discount grocer — widespread in Croatia.' },
    electronics:{ name: 'Links Shop', url: 'https://www.links.hr/', notes: 'Electronics retailer with online + physical stores.' },
    hardware:   { name: 'Bauhaus', url: 'https://www.bauhaus.hr/', notes: 'Home-improvement chain.' },
  },
  cyprus: {
    mainstream: { name: 'Alphamega', url: 'https://www.alphamega.com.cy/', notes: 'Largest Cypriot supermarket chain.' },
    bargain:    { name: 'Lidl',      url: 'https://www.lidl.com.cy/', notes: 'German discount grocer — several Cyprus locations.' },
    electronics:{ name: 'Stephanis', url: 'https://www.stephanis.com.cy/', notes: 'Electronics + appliances chain.' },
    hardware:   { name: 'Superhome Center', url: 'https://www.superhomecenter.com.cy/', notes: 'Home-improvement chain.' },
  },
  ecuador: {
    mainstream: { name: 'Supermaxi', url: 'https://www.supermaxi.com/', notes: 'Largest mainstream supermarket chain in Ecuador.' },
    bargain:    { name: 'TÍA',       url: 'https://www.tia.com.ec/', notes: 'Long-running discount chain; budget-focused basics.' },
    electronics:{ name: 'La Ganga',  url: 'https://www.laganga.com/', notes: 'Electronics + appliances chain.' },
    hardware:   { name: 'Kywi',      url: 'https://www.kywi.com.ec/', notes: 'Hardware and home-improvement chain.' },
  },
  france: {
    mainstream: { name: 'Carrefour', url: 'https://www.carrefour.fr/', notes: 'Mainstream hypermarket chain, countrywide.' },
    bargain:    { name: 'Lidl',      url: 'https://www.lidl.fr/', notes: 'German discount grocer — widespread in France.' },
    electronics:{ name: 'Fnac Darty', url: 'https://www.fnac.com/', notes: 'Combined electronics + appliances + books chain.' },
    hardware:   { name: 'Leroy Merlin', url: 'https://www.leroymerlin.fr/', notes: 'Major home-improvement chain.' },
  },
  greece: {
    mainstream: { name: 'Sklavenitis', url: 'https://www.sklavenitis.gr/', notes: 'Largest Greek-owned supermarket chain.' },
    bargain:    { name: 'Lidl',         url: 'https://www.lidl.gr/', notes: 'German discount grocer — widespread in Greece.' },
    electronics:{ name: 'Kotsovolos',   url: 'https://www.kotsovolos.gr/', notes: 'Largest electronics + appliances chain.' },
    hardware:   { name: 'Praktiker',    url: 'https://www.praktiker.gr/', notes: 'Home-improvement chain.' },
  },
  ireland: {
    mainstream: { name: 'Tesco',    url: 'https://www.tesco.ie/', notes: 'Mainstream supermarket chain.' },
    bargain:    { name: 'Aldi',     url: 'https://www.aldi.ie/', notes: 'German discount grocer — widespread in Ireland.' },
    electronics:{ name: 'Currys',   url: 'https://www.currys.ie/', notes: 'Electronics + appliances chain.' },
    hardware:   { name: 'Woodies',  url: 'https://www.woodies.ie/', notes: 'Home-improvement chain.' },
  },
  italy: {
    mainstream: { name: 'Conad',    url: 'https://www.conad.it/', notes: 'Largest mainstream supermarket chain in Italy.' },
    bargain:    { name: 'Lidl',     url: 'https://www.lidl.it/', notes: 'German discount grocer — widespread in Italy.' },
    electronics:{ name: 'MediaWorld', url: 'https://www.mediaworld.it/', notes: 'Electronics chain (MediaMarkt brand).' },
    hardware:   { name: 'Leroy Merlin', url: 'https://www.leroymerlin.it/', notes: 'Major home-improvement chain.' },
  },
  malta: {
    mainstream: { name: 'Pavi',     url: 'https://www.pavi.com.mt/', notes: 'Large mainstream supermarket chain.' },
    bargain:    { name: 'Lidl',     url: 'https://www.lidl.com.mt/', notes: 'German discount grocer — multiple Malta locations.' },
    electronics:{ name: 'Electroworld', url: 'https://www.electroworld.com.mt/', notes: 'Electronics retailer.' },
    hardware:   { name: 'Oxford House', url: 'https://oxfordhouse.com.mt/', notes: 'Home appliances + goods.' },
  },
  mexico: {
    mainstream: { name: 'Walmart',  url: 'https://www.walmart.com.mx/', notes: 'Largest supermarket-hypermarket chain in Mexico.' },
    bargain:    { name: 'Bodega Aurrera', url: 'https://www.bodegaaurrera.com.mx/', notes: 'Walmart-owned discount chain — budget focus.' },
    electronics:{ name: 'Elektra',  url: 'https://www.elektra.com.mx/', notes: 'Electronics, appliances, phones; also small-credit lender.' },
    hardware:   { name: 'The Home Depot', url: 'https://www.homedepot.com.mx/', notes: 'Home-improvement megastore.' },
  },
  panama: {
    mainstream: { name: 'Riba Smith', url: 'https://ribasmith.com/', notes: 'Upscale supermarket chain popular with expats.' },
    bargain:    { name: 'Super 99',   url: 'https://super99.com/', notes: 'Largest domestic supermarket chain, everyday budget prices.' },
    electronics:{ name: 'Panafoto',   url: 'https://www.panafoto.com/', notes: 'Electronics + appliances chain.' },
    hardware:   { name: 'Novey',      url: 'https://www.novey.com.pa/', notes: 'Home-improvement chain.' },
  },
  portugal: {
    mainstream: { name: 'Continente', url: 'https://www.continente.pt/', notes: 'Largest mainstream supermarket chain in Portugal.' },
    bargain:    { name: 'Lidl',        url: 'https://www.lidl.pt/', notes: 'German discount grocer — widespread.' },
    electronics:{ name: 'Worten',      url: 'https://www.worten.pt/', notes: 'Largest electronics + appliances chain.' },
    hardware:   { name: 'Leroy Merlin', url: 'https://www.leroymerlin.pt/', notes: 'Home-improvement chain.' },
  },
  spain: {
    mainstream: { name: 'Mercadona', url: 'https://www.mercadona.es/', notes: 'Largest supermarket chain in Spain, mid-market pricing.' },
    bargain:    { name: 'Lidl',       url: 'https://www.lidl.es/', notes: 'German discount grocer — widespread.' },
    electronics:{ name: 'MediaMarkt', url: 'https://www.mediamarkt.es/', notes: 'Largest electronics chain in Spain.' },
    hardware:   { name: 'Leroy Merlin', url: 'https://www.leroymerlin.es/', notes: 'Major home-improvement chain.' },
  },
  uruguay: {
    mainstream: { name: 'Tienda Inglesa', url: 'https://www.tiendainglesa.com.uy/', notes: 'Largest Uruguayan supermarket chain.' },
    bargain:    { name: 'Multiahorro',     url: 'https://www.multiahorro.com.uy/', notes: 'Budget supermarket chain.' },
    electronics:{ name: 'Divino',          url: 'https://www.divino.com.uy/', notes: 'Home + electronics retailer.' },
    hardware:   { name: 'Barraca Europa',  url: 'https://www.barracaeuropa.com.uy/', notes: 'Home-improvement + hardware.' },
  },
  us: {
    mainstream: { name: 'Kroger family of stores', url: 'https://www.kroger.com/', notes: 'Largest US supermarket operator; regional banners (Ralphs, Fred Meyer, King Soopers, Smith\'s, Fry\'s, etc.).' },
    bargain:    { name: 'Aldi', url: 'https://www.aldi.us/', notes: 'Hard-discount supermarket chain — nationwide.' },
    electronics:{ name: 'Best Buy', url: 'https://www.bestbuy.com/', notes: 'Largest US consumer-electronics chain.' },
    hardware:   { name: 'The Home Depot', url: 'https://www.homedepot.com/', notes: 'Largest US home-improvement chain.' },
  },
};

/** State-specific overrides for US locations where Kroger doesn't operate
 *  the dominant local banner (FL, NY, northeast, etc.). Index by state slug
 *  suffix (2-letter) extracted from location id. */
const US_STATE_OVERRIDES = {
  fl: { mainstream: { name: 'Publix', url: 'https://www.publix.com/', notes: 'Dominant supermarket chain in Florida and the southeast.' } },
  ga: { mainstream: { name: 'Publix', url: 'https://www.publix.com/', notes: 'Dominant supermarket chain in Georgia and the southeast.' } },
  sc: { mainstream: { name: 'Publix', url: 'https://www.publix.com/', notes: 'Dominant supermarket chain in the Carolinas.' } },
  nc: { mainstream: { name: 'Publix', url: 'https://www.publix.com/', notes: 'Dominant supermarket chain in the Carolinas.' } },
  va: { mainstream: { name: 'Wegmans', url: 'https://www.wegmans.com/', notes: 'Mid-Atlantic mainstream supermarket chain.' } },
  md: { mainstream: { name: 'Giant Food', url: 'https://giantfood.com/', notes: 'Mid-Atlantic mainstream supermarket chain.' } },
  nj: { mainstream: { name: 'ShopRite', url: 'https://www.shoprite.com/', notes: 'Dominant NJ/PA/NY supermarket co-op.' } },
  ny: { mainstream: { name: 'ShopRite', url: 'https://www.shoprite.com/', notes: 'Large NY metro supermarket co-op.' } },
  pa: { mainstream: { name: 'Giant (Martin\'s)', url: 'https://giantfoodstores.com/', notes: 'Dominant PA supermarket chain.' } },
  me: { mainstream: { name: 'Hannaford', url: 'https://www.hannaford.com/', notes: 'Dominant New England supermarket chain.' } },
  tx: { mainstream: { name: 'H-E-B', url: 'https://www.heb.com/', notes: 'Dominant Texas supermarket chain.' } },
  mi: { mainstream: { name: 'Meijer', url: 'https://www.meijer.com/', notes: 'Dominant Michigan hypermarket chain.' } },
  wi: { mainstream: { name: 'Meijer', url: 'https://www.meijer.com/', notes: 'Hypermarket chain popular in the upper Midwest.' } },
  mn: { mainstream: { name: 'Cub Foods', url: 'https://www.cub.com/', notes: 'Dominant Minnesota supermarket chain.' } },
  nd: { mainstream: { name: 'Hornbacher\'s', url: 'https://www.hornbachers.com/', notes: 'Regional Dakota supermarket chain.' } },
  fl_alt: null, // placeholder for future
};

/** Parse country slug from location dir name. Tries multi-word slugs first. */
function slugForDir(dir) {
  if (dir.startsWith('costa-rica-')) return 'costa-rica';
  return dir.split('-', 1)[0];
}

/** US locations follow `us-<city>-<state>` or `us-<city>`; extract state. */
function usStateFromDir(dir) {
  const parts = dir.split('-');
  if (parts[0] !== 'us') return null;
  const last = parts[parts.length - 1];
  return /^[a-z]{2}$/.test(last) ? last : null;
}

let changed = 0;
let skipped = 0;

for (const dir of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const servicesPath = join(DATA_DIR, dir.name, 'services.json');
  if (!existsSync(servicesPath)) { skipped++; continue; }

  const slug = slugForDir(dir.name);
  const base = COUNTRY_STORES[slug];
  if (!base) { skipped++; continue; }

  // US: apply state override for mainstream if present.
  let storeSet = { ...base };
  if (slug === 'us') {
    const state = usStateFromDir(dir.name);
    if (state && US_STATE_OVERRIDES[state]?.mainstream) {
      storeSet = { ...storeSet, mainstream: US_STATE_OVERRIDES[state].mainstream };
    }
  }

  const data = JSON.parse(readFileSync(servicesPath, 'utf-8'));
  const services = Array.isArray(data.services) ? data.services : [];

  const entries = [
    { kind: 'mainstream',  categoryId: 'grocery',     ...storeSet.mainstream,  notePrefix: 'Mainstream supermarket chain.' },
    { kind: 'bargain',     categoryId: 'grocery',     ...storeSet.bargain,     notePrefix: 'Discount / bargain grocery chain.' },
    { kind: 'electronics', categoryId: 'electronics', ...storeSet.electronics, notePrefix: 'Major electronics + appliances chain.' },
    { kind: 'hardware',    categoryId: 'hardware',    ...storeSet.hardware,    notePrefix: 'Home-improvement / hardware chain.' },
  ];

  let touched = false;
  for (const e of entries) {
    const exists = services.some(s =>
      s && s.categoryId === e.categoryId && s.name && s.name.toLowerCase() === e.name.toLowerCase()
    );
    if (exists) continue;
    services.push({
      categoryId: e.categoryId,
      name: e.name,
      notes: e.notes,
      sources: [
        { title: e.name, url: e.url, accessed: ACCESSED },
      ],
    });
    touched = true;
  }

  if (touched) {
    data.services = services;
    writeFileSync(servicesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    changed++;
  } else {
    skipped++;
  }
}

console.log(`augmented: ${changed}`);
console.log(`skipped:   ${skipped}`);
