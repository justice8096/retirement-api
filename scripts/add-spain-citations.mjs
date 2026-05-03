#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Spain pros/cons bullets (Todo #19 follow-on to Portugal
 * beachhead in api PR #96).
 *
 * Same pattern as add-portugal-citations.mjs:
 *   - Per-city, per-bullet exact-string match (defensive)
 *   - Idempotent (skips bullets that already have sources)
 *   - Shared `Source` constants reusable across cities
 *
 * Falsifiable claims targeted (4 bullets across 3 cities):
 *   - Alicante:    NLV income requirement (€2,400/mo, 4× IPREM)
 *   - Alicante:    Private insurance during NLV
 *   - Canary Is.:  IGIC 7% vs mainland VAT 21%
 *   - Valencia:    DANA autumn flood risk
 *
 * NOT covered in this PR (deferred):
 *   - "A2 Spanish required for permanent residency" (Alicante con) —
 *     correctness check needed: A2 + CCSE is required for *nationality*
 *     (citizenship) per Ley 19/2015, NOT for long-term-resident permits.
 *     Filed as a separate todo to verify the claim before citing.
 *   - Subjective bullets ("beautiful beaches", "world-class culture")
 *     are not source-able per the #19 strategy.
 *
 * Run: node scripts/add-spain-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** Spanish Ministerio de Asuntos Exteriores — Non-Lucrative Visa page.
 *  Authoritative entry point for NLV requirements. */
const ES_NLV = {
  title: 'Ministerio de Asuntos Exteriores — Visado de Residencia No Lucrativa',
  url: 'https://www.exteriores.gob.es/es/ServiciosAlCiudadano/InformacionParaExtranjeros/Paginas/RequisitosVisados.aspx',
  accessed: ACCESSED,
};

/** IPREM (Indicador Público de Renta de Efectos Múltiples) — the
 *  reference figure NLV ties to (4× IPREM/mo for the principal applicant).
 *  Set annually via Ley de Presupuestos Generales del Estado. */
const ES_IPREM = {
  title: 'BOE — Ley de Presupuestos Generales del Estado (IPREM annual figure)',
  url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-26739',
  accessed: ACCESSED,
};

/** RD 240/2007 + supplementary regs — Spain NLV applicants must hold
 *  private health insurance with no copays / coverage limits while
 *  awaiting SNS enrollment via residency or Convenio Especial. */
const ES_NLV_INSURANCE = {
  title: 'Real Decreto 240/2007 — Spain residency permit requirements (private insurance during NLV)',
  url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-4184',
  accessed: ACCESSED,
};

/** Canary Islands Special Tax Regime — IGIC (Impuesto General Indirecto
 *  Canario) general rate 7% vs mainland IVA 21%. Real Decreto 1/2017. */
const ES_CANARIAS_IGIC = {
  title: 'Agencia Tributaria Canaria — IGIC (general rate 7%)',
  url: 'https://www.gobiernodecanarias.org/tributos/impuestos/igic/',
  accessed: ACCESSED,
};

/** Spanish AEAT — IVA general rate 21% for comparison vs IGIC. */
const ES_IVA = {
  title: 'Agencia Tributaria — IVA tipos impositivos',
  url: 'https://sede.agenciatributaria.gob.es/Sede/iva/tipos.html',
  accessed: ACCESSED,
};

/** AEMET — DANA (Depresión Aislada en Niveles Altos) Mediterranean
 *  coast autumn flooding events. Valencia 2024 catastrophic DANA. */
const ES_AEMET_DANA = {
  title: 'AEMET — DANA (cold-drop) explainer + Mediterranean autumn flood events',
  url: 'https://www.aemet.es/es/conocermas/borrascas/dana',
  accessed: ACCESSED,
};

const ES_DANA_2024 = {
  title: 'BOE — Real Decreto-Ley 7/2024 (Valencia DANA emergency relief)',
  url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22641',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // Alicante — NLV income requirement.
  // OVERWRITE existing citations: the original sources were a marketing
  // blog (myspainvisa.com) and an unrelated bullfighting site
  // (madridbullfighting.com) — neither authoritative. Replace with
  // BOE / Ministerio de Asuntos Exteriores sources.
  {
    city: 'spain-alicante',
    field: 'cons',
    match: 'Higher visa income requirement (EUR 2400/mo)',
    overwrite: true,
    replacement: {
      text: 'Higher visa income requirement: NLV ~€2,400/mo for principal applicant (4× IPREM, BOE-set annually)',
      sources: [ES_NLV, ES_IPREM],
    },
  },
  // Alicante — private insurance during NLV
  {
    city: 'spain-alicante',
    field: 'cons',
    match: 'Private insurance needed initially',
    replacement: {
      text: 'Private health insurance required during NLV (no copays / coverage limits) until SNS access via residency or Convenio Especial',
      sources: [ES_NLV_INSURANCE],
    },
  },
  // Canary Islands — IGIC vs IVA
  {
    city: 'spain-canary-islands',
    field: 'pros',
    match: 'Lower IGIC tax (7%) instead of mainland VAT (21%)',
    replacement: {
      text: 'Lower IGIC general rate (7%) instead of mainland IVA (21%) under the Canary Islands Special Tax Regime',
      sources: [ES_CANARIAS_IGIC, ES_IVA],
    },
  },
  // Valencia — DANA flooding
  {
    city: 'spain-valencia',
    field: 'cons',
    match: 'Flash flooding risk in autumn (DANA events)',
    replacement: {
      text: 'Flash flooding risk in autumn from DANA cold-drop events (catastrophic October 2024 DANA prompted RDL 7/2024 emergency relief)',
      sources: [ES_AEMET_DANA, ES_DANA_2024],
    },
  },
];

// ─── Apply ─────────────────────────────────────────────────────────────

let updated = 0;
let alreadyCited = 0;
let notFound = 0;

for (const u of UPDATES) {
  const path = join(DATA_DIR, u.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[u.field];
  if (!Array.isArray(list)) {
    console.warn(`SKIP ${u.city} — no ${u.field} array`);
    continue;
  }
  let found = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (text !== u.match) continue;
    found = true;
    if (typeof entry !== 'string' && entry?.sources?.length && !u.overwrite) {
      alreadyCited++;
      console.log(`-    ${u.city}.${u.field}: already cited — "${u.match}"`);
      break;
    }
    const wasOverwrite = !!u.overwrite && typeof entry !== 'string' && entry?.sources?.length;
    list[i] = u.replacement;
    updated++;
    console.log(
      `${wasOverwrite ? 'OVR ' : 'OK  '} ${u.city}.${u.field}: ` +
      `${wasOverwrite ? 'replaced low-quality citations' : 'cited'} "${u.match}"`,
    );
    break;
  }
  if (!found) {
    notFound++;
    console.warn(`MISS ${u.city}.${u.field}: bullet not found — "${u.match}"`);
    continue;
  }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
