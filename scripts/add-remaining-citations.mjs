#!/usr/bin/env node
/**
 * Final consolidated citation sweep (Todo #19, tenth batch).
 * Wraps up the remaining 5 countries — Colombia, Ecuador, Uruguay,
 * Ireland, Malta — in one PR. After this, all 14 countries in the
 * dataset have had their highest-leverage falsifiable claims cited.
 *
 * 13 bullets across 11 cities:
 *   Colombia (3): Cartagena UNESCO, Pereira coffee landscape UNESCO,
 *                 Santa Marta Tayrona NP
 *   Ecuador  (3): Cuenca UNESCO, Quito UNESCO (#2 — first-ever listing),
 *                 Quito/Cuenca/Salinas USD adoption
 *   Uruguay  (2): Colonia UNESCO, Montevideo democracy index
 *   Ireland  (3): Cork Apple HQ, Waterford Viking heritage, Waterford taxes
 *   Malta    (2): Valletta UNESCO, Malta English-official language
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');
const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

// Colombia
const UNESCO_CARTAGENA = {
  title: 'UNESCO World Heritage List — Port, Fortresses and Group of Monuments, Cartagena (285)',
  url: 'https://whc.unesco.org/en/list/285',
  accessed: ACCESSED,
};
const UNESCO_COFFEE = {
  title: 'UNESCO World Heritage List — Coffee Cultural Landscape of Colombia (1121)',
  url: 'https://whc.unesco.org/en/list/1121',
  accessed: ACCESSED,
};
const PARQUES_TAYRONA = {
  title: 'Parques Nacionales Naturales de Colombia — Tayrona PNN',
  url: 'https://www.parquesnacionales.gov.co/portal/es/parques-nacionales/parque-nacional-natural-tayrona/',
  accessed: ACCESSED,
};

// Ecuador
const UNESCO_CUENCA = {
  title: 'UNESCO World Heritage List — Historic Centre of Santa Ana de los Ríos de Cuenca (863)',
  url: 'https://whc.unesco.org/en/list/863',
  accessed: ACCESSED,
};
const UNESCO_QUITO = {
  title: 'UNESCO World Heritage List — City of Quito (2 — among the first 12 sites listed in 1978)',
  url: 'https://whc.unesco.org/en/list/2',
  accessed: ACCESSED,
};
const ECUADOR_USD = {
  title: 'Banco Central del Ecuador — USD adoption (since 2000-09-09 per Ley 2000-4)',
  url: 'https://www.bce.fin.ec/',
  accessed: ACCESSED,
};

// Uruguay
const UNESCO_COLONIA = {
  title: 'UNESCO World Heritage List — Historic Quarter of the City of Colonia del Sacramento (747)',
  url: 'https://whc.unesco.org/en/list/747',
  accessed: ACCESSED,
};
const EIU_DEMOCRACY = {
  title: 'EIU Democracy Index — Uruguay (consistently #1 in Latin America since the index began)',
  url: 'https://www.eiu.com/n/campaigns/democracy-index/',
  accessed: ACCESSED,
};

// Ireland
const APPLE_CORK = {
  title: "Apple — Cork campus (European HQ since 1980, ~6,000 employees as of 2024)",
  url: 'https://www.apple.com/ie/job-creation/',
  accessed: ACCESSED,
};
const WATERFORD_VIKINGS = {
  title: 'Waterford Treasures — Viking Triangle (Waterford founded by Vikings, 914 AD)',
  url: 'https://www.waterfordtreasures.com/',
  accessed: ACCESSED,
};
const IRELAND_REVENUE = {
  title: "Revenue.ie — Income tax bands (top rate 40%) + USC + PRSI",
  url: 'https://www.revenue.ie/en/jobs-and-pensions/calculating-your-income-tax/index.aspx',
  accessed: ACCESSED,
};

// Malta
const UNESCO_VALLETTA = {
  title: 'UNESCO World Heritage List — City of Valletta (131, listed 1980)',
  url: 'https://whc.unesco.org/en/list/131',
  accessed: ACCESSED,
};
const MALTA_CONSTITUTION = {
  title: 'Constitution of Malta, Article 5 — Maltese and English are official languages',
  url: 'https://legislation.mt/eli/const/eng/pdf',
  accessed: ACCESSED,
};

// ─── Per-city updates ──────────────────────────────────────────────────

const UPDATES = [
  // Colombia
  {
    city: 'colombia-cartagena',
    field: 'pros',
    match: 'Stunning UNESCO colonial walled city',
    replacement: {
      text: 'Stunning UNESCO colonial walled city (Port, Fortresses and Group of Monuments, Cartagena — listed 1984)',
      sources: [UNESCO_CARTAGENA],
    },
  },
  {
    city: 'colombia-pereira',
    field: 'pros',
    match: 'UNESCO Coffee Cultural Landscape',
    replacement: {
      text: 'UNESCO Coffee Cultural Landscape of Colombia (1121, listed 2011 — covers Pereira and surrounding coffee-growing zones)',
      sources: [UNESCO_COFFEE],
    },
  },
  {
    city: 'colombia-santa-marta',
    field: 'pros',
    match: 'Gateway to Tayrona National Park',
    replacement: {
      text: 'Gateway to Tayrona National Natural Park (Parques Nacionales Naturales de Colombia)',
      sources: [PARQUES_TAYRONA],
    },
  },
  // Ecuador
  {
    city: 'ecuador-cuenca',
    field: 'pros',
    match: 'UNESCO World Heritage colonial city',
    replacement: {
      text: 'UNESCO World Heritage colonial city (Historic Centre of Santa Ana de los Ríos de Cuenca, listed 1999)',
      sources: [UNESCO_CUENCA],
    },
  },
  {
    city: 'ecuador-quito',
    field: 'pros',
    match: 'UNESCO World Heritage historic center',
    replacement: {
      text: "UNESCO World Heritage historic center (City of Quito — among the first 12 sites listed in 1978, alongside Galápagos)",
      sources: [UNESCO_QUITO],
    },
  },
  {
    city: 'ecuador-quito',
    field: 'pros',
    match: 'Uses USD with no exchange rate risk',
    replacement: {
      text: 'Uses USD with no exchange rate risk (Ecuador adopted the US dollar in 2000 per Ley de Transformación Económica)',
      sources: [ECUADOR_USD],
    },
  },
  // Uruguay
  {
    city: 'uruguay-colonia',
    field: 'pros',
    match: 'UNESCO World Heritage charming colonial town',
    replacement: {
      text: 'UNESCO World Heritage charming colonial town (Historic Quarter of Colonia del Sacramento, listed 1995)',
      sources: [UNESCO_COLONIA],
    },
  },
  {
    city: 'uruguay-montevideo',
    field: 'pros',
    match: 'Most stable democracy in South America',
    replacement: {
      text: 'Most stable democracy in South America (EIU Democracy Index — Uruguay consistently #1 in Latin America since the index began)',
      sources: [EIU_DEMOCRACY],
    },
  },
  // Ireland
  {
    city: 'ireland-cork',
    field: 'pros',
    match: 'Growing tech hub with Apple, EMC, and others',
    replacement: {
      text: "Growing tech hub: Apple's European HQ in Cork since 1980 (~6,000 employees as of 2024); also Dell EMC, Pfizer, others",
      sources: [APPLE_CORK],
    },
  },
  {
    city: 'ireland-waterford',
    field: 'pros',
    match: 'Rich Viking heritage and cultural history (Waterford Crystal, Viking Triangle)',
    replacement: {
      text: 'Rich Viking heritage (Waterford founded by Vikings 914 AD — oldest city in Ireland) + Waterford Crystal + Viking Triangle museums',
      sources: [WATERFORD_VIKINGS],
    },
  },
  {
    city: 'ireland-waterford',
    field: 'cons',
    match: 'High tax rates (income tax 40% + USC 8% + PRSI 4%)',
    replacement: {
      text: 'High tax rates: top income tax band 40% + USC up to 8% (over €70K) + PRSI 4% (per Revenue.ie 2025 bands)',
      sources: [IRELAND_REVENUE],
    },
  },
  // Malta
  {
    city: 'malta-valletta',
    field: 'pros',
    match: 'Stunning historic capital (UNESCO World Heritage)',
    replacement: {
      text: 'Stunning historic capital (City of Valletta UNESCO World Heritage, listed 1980)',
      sources: [UNESCO_VALLETTA],
    },
  },
  {
    city: 'malta-valletta',
    field: 'pros',
    match: 'English is an official language',
    replacement: {
      text: 'English is an official language alongside Maltese (Constitution of Malta, Article 5)',
      sources: [MALTA_CONSTITUTION],
    },
  },
];

let updated = 0, alreadyCited = 0, notFound = 0;

for (const u of UPDATES) {
  const path = join(DATA_DIR, u.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[u.field];
  if (!Array.isArray(list)) { console.warn(`SKIP ${u.city} — no ${u.field}`); continue; }
  let found = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (text !== u.match) continue;
    found = true;
    if (typeof entry !== 'string' && entry?.sources?.length && !u.overwrite) {
      alreadyCited++;
      console.log(`-    ${u.city}.${u.field}: already cited`);
      break;
    }
    list[i] = u.replacement;
    updated++;
    console.log(`OK   ${u.city}.${u.field}: cited "${u.match}"`);
    break;
  }
  if (!found) { notFound++; console.warn(`MISS ${u.city}.${u.field}: "${u.match}"`); continue; }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
