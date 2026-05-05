#!/usr/bin/env node
/**
 * One-shot data migration: backfill `monthlyCosts.healthcare.notes` for
 * 48 US locations across 22 states + 4 territories (Todo #37, split-out
 * from #20).
 *
 * Why a separate script from `backfill-healthcare-notes.mjs` (PR #95):
 * the country-level template approach used for the 14 foreign countries
 * doesn't transfer to the US, where Medicare Advantage availability,
 * dominant ACA insurers, marketplace competition, and hospital-system
 * density vary dramatically by state. Each state needs its own template.
 *
 * Strategy:
 *   1. Group missing cities by state (22 states + 4 territories cover
 *      48 locations).
 *   2. State-level templates mirror the existing rich US pattern
 *      (Annapolis, Bowie, Catonsville, Elkridge, Camden) — Medicare
 *      Part B + Medigap baseline, dominant ACA marketplace insurers,
 *      major hospital systems, condition-specific notes (anti-VEGF,
 *      GLP-1, hypertension/diabetes generics).
 *   3. Where a state's cities span very different healthcare contexts
 *      (e.g., FL Miami vs. rural Quincy; PA Pittsburgh vs. Armstrong
 *      County), the state note calls out hospital-system access by
 *      city subgroup within a single template.
 *   4. Territories (Guam, USVI, American Samoa, N. Mariana, Puerto
 *      Rico) get their own templates that flag Medicare's territory-
 *      specific limitations.
 *
 * Sources for the pricing / coverage figures:
 *   - CMS — 2025 Medicare Part B premium ($185/mo standard) and Part D
 *     LIS thresholds. (Updated from the 2024 $174.70 figure used in
 *     the existing populated notes.)
 *   - State insurance commissioners' marketplace data
 *     (Healthcare.gov state listings 2025).
 *   - US News & World Report Best Hospitals — regional rankings.
 *   - AHRQ State Snapshots.
 *   - Medicare.gov plan finder for territory plan availability.
 *
 * Idempotent: skips locations that already have a notes field. Re-runs
 * are clean no-ops.
 *
 * Run: node scripts/backfill-us-healthcare-notes.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

// ─── Per-location healthcare-notes templates ───────────────────────────
//
// Keyed by location id directly. Locations within the same state often
// share verbatim text via reference assignment, but the map is keyed by
// id so per-city hospital callouts can override when the city differs
// materially (Miami vs. Quincy, Pittsburgh vs. rural PA).

const NM = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Presbyterian Health Plan, BCBS NM. Major systems: UNM Health, Presbyterian Healthcare Services, Lovelace Health System (all in Albuquerque). Anti-VEGF widely available via Medicare Part B at UNM ophthalmology and Eye Associates of NM. GLP-1 Part D coverage tier-dependent; hypertension/diabetes generics ~$5-15/mo. Albuquerque is the state's medical hub — outlying NM has thinner specialist density.";

const PA_PITTSBURGH = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$150-200/mo per person) + Part D (~$35-50/mo). Dominant ACA insurers: Highmark BCBS, UPMC Health Plan (which also operates as a system), Aetna. UPMC is the dominant integrated system in Western PA — owns hospitals, insurance, and physician practices. Allegheny Health Network (AHN) is the second-largest system. Anti-VEGF widely available via Medicare Part B at UPMC Eye Center and AHN ophthalmology. GLP-1 Part D coverage tier-dependent.";
const PA_RURAL = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-180/mo per person) + Part D (~$35-50/mo). Dominant ACA insurers: Highmark BCBS, Geisinger Health Plan, Capital Blue Cross. Rural PA has thinner specialist density; Geisinger (central/north-central PA) and UPMC's regional satellites cover most counties. For complex care, drive time to Pittsburgh (Armstrong) or Geisinger Danville (Williamsport) is typical 60-90 min. Anti-VEGF and GLP-1 access via Medicare are unrestricted but appointment lead times are longer.";

const NC_ASHEVILLE = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: BCBS NC, Cigna, Aetna. Mission Health (HCA Healthcare) is the dominant system in Western NC, with the only Level II trauma center in the region. Atrium Health and Novant operate to the east. Anti-VEGF widely available via Medicare Part B at Mission and at Asheville Eye Associates. GLP-1 Part D coverage tier-dependent; hypertension/diabetes generics ~$5-15/mo.";

const MD_BALTIMORE = "Medicare baseline ($185/mo Part B, 2025; Medigap ~$150-200/mo per person). CareFirst BCBS dominates the MD ACA marketplace. Major systems: Johns Hopkins Hospital + Johns Hopkins Bayview, University of Maryland Medical Center, MedStar (Union Memorial / Good Samaritan / Franklin Square), LifeBridge (Sinai). Exceptional specialist density — Baltimore has among the highest hospital-bed-per-capita ratios in the US. Anti-VEGF and GLP-1 widely available via Medicare; Hopkins Wilmer Eye Institute is a national center for retinal disease.";

const AL = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-170/mo per person) + Part D (~$25-45/mo). BCBS Alabama dominates the ACA marketplace (>80% individual market share). Major systems: UAB Medicine (Birmingham — academic anchor), Children's of Alabama, Grandview Medical Center, Brookwood Baptist Health, Princeton Baptist. UAB Callahan Eye is a regional referral center for retinal disease. Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent. Generics ~$5-15/mo at chains.";

const VI = "Medicare Part A/B/D apply in the US Virgin Islands but Medicare Advantage and Medigap markets are very thin — most beneficiaries use Original Medicare with Part D. Dominant ACA marketplace insurers: BCBS VI, UnitedHealthcare. Major facilities: Roy L. Schneider Hospital (St. Thomas), Juan F. Luis Hospital (St. Croix). Both are community hospitals — complex cases (cardiac surgery, cancer, retinal surgery) typically referred to Puerto Rico, Miami, or stateside. Anti-VEGF and GLP-1 access requires medevac or planned travel for many residents. Budget for higher specialist travel costs.";

const IL = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-200/mo per person) + Part D (~$35-55/mo). Dominant ACA insurers: BCBS IL, Cigna, UnitedHealth, Ambetter. Major Chicago systems: Northwestern Memorial, Rush University Medical Center, UChicago Medicine, Advocate Health Care, Loyola, Northshore. Among the highest specialist densities in the Midwest. Anti-VEGF widely available via Medicare Part B at Northwestern Eye Center and UIC. GLP-1 Part D coverage tier-dependent; generics ~$5-15/mo at retail chains.";

const OH_CLEVELAND = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-170/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, Medical Mutual of Ohio, CareSource. Major systems: Cleveland Clinic (US News Honor Roll, Cole Eye Institute is a national retinal-disease center), University Hospitals (UH Eye Institute), MetroHealth (Cuyahoga County safety-net). Anti-VEGF and GLP-1 widely available via Medicare. Among the strongest healthcare-cost values in the country — Cleveland Clinic + UH offer world-class care at Midwest pricing.";
const OH_LORAIN = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-170/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, Medical Mutual, CareSource. Local: Mercy Health Lorain Hospital, University Hospitals St. John Medical Center (Westlake). Cleveland Clinic main campus 30 min east — easy access for tertiary care, retinal subspecialty (Cole Eye Institute), and oncology. Anti-VEGF and GLP-1 widely available via Medicare.";

const TX_DFW = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: BCBS TX, Ambetter, Oscar, UnitedHealth. Major DFW systems: UT Southwestern Medical Center (academic anchor, US News Honor Roll), Baylor Scott & White, Texas Health Resources, Methodist Health System, Children's Health. Anti-VEGF widely available via Medicare Part B; UT Southwestern Eye Institute is a regional retinal-disease center. GLP-1 Part D coverage tier-dependent; generics widely available at $4-15/mo at HEB, Walmart, Costco.";
const TX_CENTRAL = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: BCBS TX, Ambetter, Oscar. Local: Baylor Scott & White (Killeen-Temple corridor — Temple is the academic anchor with regional retinal subspecialty), AdventHealth Central Texas. San Marcos: Central Texas Medical Center (Ascension Seton); Austin academic centers (Dell Med, Ascension Seton) ~30 min north. Anti-VEGF and GLP-1 widely available via Medicare; generics $4-15/mo at HEB.";

const GU = "Medicare Part A/B/D apply on Guam but Medicare Advantage market is thin (1-2 plans) and Medigap is essentially unavailable. Dominant local ACA carriers: TakeCare, NetCare, Calvo's SelectCare. Major facility: Guam Memorial Hospital (Hagåtña/Tamuning) — community hospital. US Naval Hospital Guam serves military/dependents. For complex cardiac, oncology, or retinal cases, medevac to Hawaii or the Philippines is the norm. Anti-VEGF available locally for routine doses; GLP-1 supply chain dependent on Defense Health Agency / civilian pharmacy stocking.";

const CO = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-190/mo per person) + Part D (~$35-55/mo). Dominant ACA insurers: Anthem BCBS, Kaiser Permanente Colorado, Bright HealthCare. Major Front Range systems: UCHealth (academic anchor, Univ of CO Hospital), CommonSpirit/SCL Health, Centura, Denver Health (safety-net), Kaiser Permanente. Anti-VEGF widely available via Medicare at UCHealth Sue Anschutz-Rodgers Eye Center (national retinal-disease center). GLP-1 Part D coverage tier-dependent; generics $5-15/mo.";

const FL_MIAMI = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$200-280/mo per person — among highest in US) + Part D (~$35-55/mo). Florida Blue dominates the ACA marketplace; Ambetter, UnitedHealth, Cigna, Oscar also active. Major Miami systems: Jackson Health (safety-net + UM-affiliated), University of Miami Health (Bascom Palmer Eye Institute is the nation's #1 ophthalmology hospital per US News), Baptist Health South Florida, Cleveland Clinic Florida. Anti-VEGF and GLP-1 widely available via Medicare. Florida Medigap Plan G premiums run notably higher than the national median due to claim-cost loading.";
const FL_TAMPA = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$170-230/mo per person) + Part D (~$35-50/mo). Florida Blue dominant ACA insurer; Ambetter, UnitedHealth, Cigna also active. Major Tampa Bay systems: Tampa General (USF Health teaching hospital), Moffitt Cancer Center (NCI-designated), BayCare, AdventHealth, HCA Florida. Bascom Palmer (Miami) accessible by referral for retinal disease; St. Pete has Eye Institute of West Florida and BayCare retinal subspecialists. Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent.";
const FL_NORTH = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$160-220/mo per person) + Part D (~$35-50/mo). Florida Blue dominant ACA insurer. Northern FL systems: Mayo Clinic Jacksonville (US News Honor Roll, Mayo Department of Ophthalmology covers retinal disease), UF Health (Gainesville academic anchor), AdventHealth, HCA Florida. Quincy / Yulee / St. Augustine: smaller community hospitals locally; tertiary care via Mayo Jacksonville (~1 hr from Yulee/St. Augustine, ~2.5 hr from Quincy) or UF Health Gainesville. Anti-VEGF and GLP-1 widely available via Medicare.";
const FL_SPACE_COAST = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$170-230/mo per person) + Part D (~$35-50/mo). Florida Blue dominant ACA insurer. Local Space Coast: Health First (Holmes Regional Medical Center, Cape Canaveral Hospital), Parrish Medical Center (Titusville). Orlando AdventHealth and Orlando Health (UF Health) ~75 min west for tertiary care including retinal subspecialty. Bascom Palmer Miami referral path for complex retinal cases. Anti-VEGF and GLP-1 widely available via Medicare.";

const IN = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-170/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, CareSource, MDwise, UnitedHealth. Local Fort Wayne systems: Parkview Health (regional anchor with Parkview Eye Center for retinal subspecialty), Lutheran Health Network (CHS), Indiana University Health. IU Health Methodist Indianapolis ~2 hr south for academic tertiary care. Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent; generics $4-15/mo at Walmart/Meijer/Costco.";

const ND = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$120-160/mo per person — among lowest in US) + Part D (~$25-45/mo). Dominant ACA insurers: Sanford Health Plan, BCBS ND, Medica. Local Grand Forks: Altru Health System (regional anchor, includes Altru Eye Clinic for retinal subspecialty). Sanford Health Fargo ~80 min south, Sanford Sioux Falls / Mayo Clinic Rochester for tertiary referrals. Anti-VEGF Medicare Part B at Altru; GLP-1 Part D tier-dependent. ND Medigap is among the cheapest in the country.";

const MI = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: BCBS MI (>50% individual market share), Priority Health, Molina. Major SE MI systems: Henry Ford Health (Detroit, including Henry Ford Eye Center), Beaumont (now Corewell Health) — Royal Oak / Troy / Dearborn campuses, Trinity Health (Oakland Hospital), University of Michigan Health (Ann Arbor — Kellogg Eye Center is a national retinal-disease center, ~45-60 min). Anti-VEGF and GLP-1 widely available via Medicare. Outstate (Lapeer, Port Huron): McLaren Health Care + Beaumont/Corewell satellites.";

const AR = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$120-160/mo per person — among the lowest in US) + Part D (~$25-45/mo). Dominant ACA insurers: Arkansas BCBS (>80% individual market share), Ambetter, QualChoice. Local Little Rock: UAMS (University of Arkansas for Medical Sciences — academic anchor with retinal subspecialty), Baptist Health, CHI St. Vincent, Arkansas Children's. UAMS is the only academic medical center in AR — tertiary cases concentrated there. Anti-VEGF Medicare Part B at UAMS; GLP-1 Part D tier-dependent.";

const VA_TIDEWATER = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-190/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, Sentara/Optima Health (which also operates Sentara hospitals — vertically integrated), CareFirst. Sentara is the dominant Tidewater system: Sentara Norfolk General (Level 1 trauma + academic — EVMS teaching), Sentara Princess Anne, Sentara Leigh, Sentara Virginia Beach General, Bon Secours Maryview/DePaul. EVMS retinal subspecialty available. Tertiary referral path: VCU Richmond (~2 hr) or Duke (~3 hr). Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent.";
const VA_LYNCHBURG = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$140-190/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, Optima, CareFirst. Local: Centra (Lynchburg General Hospital + Virginia Baptist) — regional anchor with Centra Medical Group ophthalmology. UVA Charlottesville ~1 hr north for academic tertiary care including retinal subspecialty. VCU Richmond ~1.25 hr east as alternative referral path. Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent.";

const WI = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Quartz Health, Anthem BCBS, Network Health, Children's Community Health Plan, Common Ground. Major Milwaukee systems: Aurora Health Care (Advocate Health), Froedtert & MCW (Medical College of WI — academic anchor, includes MCW Eye Institute for retinal subspecialty), Ascension Wisconsin, Children's WI. Marshfield Clinic dominant in central/north-central WI. Anti-VEGF and GLP-1 widely available via Medicare; generics $4-15/mo at Walmart/Pick 'n Save/Costco.";

const MN = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: HealthPartners, Medica, BCBS MN, UCare. Major Twin Cities systems: M Health Fairview (Univ of MN — academic anchor), Allina Health, HealthPartners (Regions Hospital + Park Nicollet — vertically integrated insurer + hospital), Children's Minnesota. Mayo Clinic Rochester ~80 min south is a national tertiary referral center for the Twin Cities and one of the world's leading retinal-disease centers. Anti-VEGF and GLP-1 widely available via Medicare; among the strongest healthcare infrastructure in the country.";

const TN = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-180/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: BCBS TN, Cigna, Oscar, Ambetter. Major Nashville systems: Vanderbilt University Medical Center (US News Honor Roll, Vanderbilt Eye Institute is a national retinal-disease center), HCA TriStar (Centennial, Skyline, Summit), Saint Thomas / Ascension, Nashville General (Meharry-affiliated safety-net). Anti-VEGF and GLP-1 widely available via Medicare. Nashville is among the strongest US Southeast healthcare hubs.";

const AS = "Medicare DOES NOT pay for most services received in American Samoa — Medicare Part A/B coverage applies only at LBJ Tropical Medical Center for emergency services and limited other arrangements. Most retirees rely on the AS Government Health Plan (employer-based) or pay out-of-pocket / fly to Honolulu for covered care. Hawaii Medical Service Association (HMSA) BCBS may be used by retirees with private supplemental coverage. Major facility: LBJ Tropical Medical Center (Pago Pago, Tafuna airport vicinity) — community hospital with limited specialty services. For complex cardiac, oncology, retinal surgery: medevac to Honolulu (~$15-30K self-pay if not covered). Practical implication: Medicare beneficiaries should NOT rely on AS for routine US-equivalent care; budget for Hawaii or stateside travel.";

const PR = "Medicare Part A/B/D apply in Puerto Rico but the Medicare Advantage market is thin and Medigap availability is very limited — most beneficiaries use Original Medicare with Part D, supplemented by Mi Salud (Puerto Rico's Medicaid for income-qualifying retirees). Reform Health Plan dominates the local market. Major systems: Centro Médico de Río Piedras (San Juan — academic anchor, UPR School of Medicine teaching), Hospital Auxilio Mutuo, Ashford Presbyterian, Hospital HIMA San Pablo. Ponce: Hospital Damas, Hospital de Damas. Spanish-language services are universal; English availability strong in San Juan academic centers. Anti-VEGF available at Centro Médico and major private centers; GLP-1 Part D coverage tier-dependent. For complex tertiary care, mainland (Miami, Boston) referral is common.";

const MP = "Medicare Part A/B/D apply on Saipan/Tinian but Medicare Advantage market is thin and Medigap is essentially unavailable. Dominant local insurer: StayWell Insurance (CNMI government employees). Major facility: Commonwealth Health Center (Saipan) — community hospital with limited specialty services. Tinian Health Center: outpatient only (boat/flight to Saipan or Guam for inpatient). Tertiary care typically referred to Guam Memorial, Hawaii (Honolulu), or Manila (Philippines). Anti-VEGF available locally for routine doses; GLP-1 supply chain dependent on shipping reliability. Practical implication: budget for medevac and travel for complex care.";

const ME = "Medicare Part B ($185/mo, 2025) + Medigap Plan G (~$130-170/mo per person) + Part D (~$30-50/mo). Dominant ACA insurers: Anthem BCBS, Community Health Options, Maine Community Health Options. Local Skowhegan: Redington-Fairview General Hospital (community). MaineGeneral (Augusta/Waterville ~30 min south) is the regional anchor with broader specialty services. Northern Light Health (Bangor ~75 min east) and MaineHealth (Maine Medical Center, Portland ~2 hr south) handle academic tertiary care including retinal subspecialty. Anti-VEGF Medicare Part B; GLP-1 Part D tier-dependent. Rural ME has long appointment lead times for subspecialty care.";

const NOTES_BY_LOC_ID = {
  // NM
  'us-albuquerque-nm': NM,

  // PA
  'us-pittsburgh-pa': PA_PITTSBURGH,
  'us-armstrong-county-pa': PA_RURAL,
  'us-williamsport-pa': PA_RURAL,

  // NC
  'us-asheville-nc': NC_ASHEVILLE,

  // MD
  'us-baltimore-md': MD_BALTIMORE,

  // AL
  'us-birmingham-al': AL,

  // VI (US Virgin Islands)
  'us-charlotte-amalie-vi': VI,
  'us-christiansted-vi': VI,

  // IL
  'us-chicago-il': IL,

  // OH
  'us-cleveland-oh': OH_CLEVELAND,
  'us-lorain-oh': OH_LORAIN,

  // TX
  'us-dallas-tx': TX_DFW,
  'us-fort-worth-tx': TX_DFW,
  'us-killeen-tx': TX_CENTRAL,
  'us-san-marcos-tx': TX_CENTRAL,

  // GU (Guam)
  'us-dededo-gu': GU,
  'us-hagatna-gu': GU,

  // CO
  'us-denver-co': CO,

  // FL — split by region (cost / hospital access varies materially)
  'us-miami-fl': FL_MIAMI,
  'us-fort-lauderdale-fl': FL_MIAMI, // SE FL same Bascom Palmer / Cleveland Clinic FL access
  'us-tampa-fl': FL_TAMPA,
  'us-st-petersburg-fl': FL_TAMPA,
  'us-quincy-fl': FL_NORTH,
  'us-yulee-fl': FL_NORTH,
  'us-st-augustine-fl': FL_NORTH,
  'us-palm-bay-fl': FL_SPACE_COAST,

  // IN
  'us-fort-wayne-in': IN,

  // ND
  'us-grand-forks-nd': ND,

  // MI
  'us-lapeer-mi': MI,
  'us-oakland-county-mi': MI,
  'us-port-huron-mi': MI,

  // AR
  'us-little-rock-ar': AR,

  // VA — split (Tidewater Sentara vs Lynchburg Centra)
  'us-norfolk-va': VA_TIDEWATER,
  'us-portsmouth-va': VA_TIDEWATER,
  'us-virginia-beach-va': VA_TIDEWATER,
  'us-lynchburg-va': VA_LYNCHBURG,

  // WI
  'us-milwaukee-wi': WI,

  // MN
  'us-minneapolis-mn': MN,
  'us-saint-paul-mn': MN,

  // TN
  'us-nashville-tn': TN,

  // AS (American Samoa)
  'us-pago-pago-as': AS,
  'us-tafuna-as': AS,

  // PR (Puerto Rico)
  'us-ponce-pr': PR,
  'us-san-juan-pr': PR,

  // MP (N. Mariana Islands)
  'us-saipan-mp': MP,
  'us-tinian-mp': MP,

  // ME
  'us-skowhegan-me': ME,
};

// ─── Apply ─────────────────────────────────────────────────────────────

let updated = 0;
let alreadyPopulated = 0;
let notFound = 0;

const dirs = readdirSync(DATA_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const id of Object.keys(NOTES_BY_LOC_ID)) {
  if (!dirs.includes(id)) {
    notFound++;
    console.warn(`MISS ${id}: directory not found`);
    continue;
  }
  const path = join(DATA_DIR, id, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const hc = loc?.monthlyCosts?.healthcare;
  if (!hc) {
    notFound++;
    console.warn(`MISS ${id}: no monthlyCosts.healthcare`);
    continue;
  }
  if (typeof hc.notes === 'string' && hc.notes.trim().length > 0) {
    alreadyPopulated++;
    console.log(`-    ${id}: already has notes`);
    continue;
  }
  hc.notes = NOTES_BY_LOC_ID[id];
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
  updated++;
  console.log(`OK   ${id}: notes populated (${NOTES_BY_LOC_ID[id].length} chars)`);
}

console.log(`\nDone. Updated ${updated}, already-populated ${alreadyPopulated}, not-found ${notFound}`);
