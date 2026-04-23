#!/usr/bin/env node
/**
 * Populate each location's `local-info.json.officialSites` with at least
 * one government site. Prefers city-level; widens to county / department /
 * province / region where no city-level site is known; falls back to
 * national for very small entries.
 *
 * If `local-info.json` does not exist yet, the script creates a minimal
 * one with just `officialSites` — the downstream services supplement loop
 * will pick it up.
 *
 * Idempotent: checks for an existing entry with matching URL before
 * appending.
 *
 * Usage:  node scripts/augment-local-info-official-sites.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';

/**
 * Per-location government-site map.
 *   scope = 'city' | 'county' | 'municipio' | 'region' | 'province' |
 *           'department' | 'state' | 'national' | 'territory'
 */
const GOV_SITES = {
  // ───── United States (mainland cities) ─────
  'us-albuquerque-nm':       { name: 'City of Albuquerque',    url: 'https://www.cabq.gov/',                 scope: 'city' },
  'us-armstrong-county-pa':  { name: 'Armstrong County, PA',   url: 'https://www.co.armstrong.pa.us/',        scope: 'county' },
  'us-asheville-nc':         { name: 'City of Asheville',      url: 'https://www.ashevillenc.gov/',           scope: 'city' },
  'us-atlanta':              { name: 'City of Atlanta',        url: 'https://www.atlantaga.gov/',             scope: 'city' },
  'us-austin':               { name: 'City of Austin',         url: 'https://www.austintexas.gov/',           scope: 'city' },
  'us-baltimore-md':         { name: 'City of Baltimore',      url: 'https://baltimorecity.gov/',             scope: 'city' },
  'us-birmingham-al':        { name: 'City of Birmingham',     url: 'https://www.birminghamal.gov/',          scope: 'city' },
  'us-chesapeake-va':        { name: 'City of Chesapeake',     url: 'https://www.cityofchesapeake.net/',      scope: 'city' },
  'us-cherry-hill':          { name: 'Cherry Hill Township',   url: 'https://www.cherryhill-nj.com/',         scope: 'city' },
  'us-chicago-il':           { name: 'City of Chicago',        url: 'https://www.chicago.gov/',               scope: 'city' },
  'us-cleveland-oh':         { name: 'City of Cleveland',      url: 'https://www.clevelandohio.gov/',         scope: 'city' },
  'us-dallas-tx':            { name: 'City of Dallas',         url: 'https://dallascityhall.com/',            scope: 'city' },
  'us-denver-co':            { name: 'City and County of Denver', url: 'https://www.denvergov.org/',          scope: 'city' },
  'us-florida':              { name: 'State of Florida',       url: 'https://www.myflorida.com/',             scope: 'state' },
  'us-fort-lauderdale-fl':   { name: 'City of Fort Lauderdale', url: 'https://www.fortlauderdale.gov/',       scope: 'city' },
  'us-fort-wayne-in':        { name: 'City of Fort Wayne',     url: 'https://www.cityoffortwayne.org/',       scope: 'city' },
  'us-fort-worth-tx':        { name: 'City of Fort Worth',     url: 'https://www.fortworthtexas.gov/',        scope: 'city' },
  'us-grand-forks-nd':       { name: 'City of Grand Forks',    url: 'https://www.grandforksgov.com/',         scope: 'city' },
  'us-killeen-tx':           { name: 'City of Killeen',        url: 'https://www.killeentexas.gov/',          scope: 'city' },
  'us-lapeer-mi':            { name: 'Lapeer County, MI',      url: 'https://www.lapeercountyweb.org/',       scope: 'county' },
  'us-little-rock-ar':       { name: 'City of Little Rock',    url: 'https://www.littlerock.gov/',            scope: 'city' },
  'us-lorain-oh':            { name: 'City of Lorain',         url: 'https://www.cityoflorain.org/',          scope: 'city' },
  'us-lynchburg-va':         { name: 'City of Lynchburg',      url: 'https://www.lynchburgva.gov/',           scope: 'city' },
  'us-miami-fl':             { name: 'City of Miami',          url: 'https://www.miami.gov/',                 scope: 'city' },
  'us-milwaukee-wi':         { name: 'City of Milwaukee',      url: 'https://city.milwaukee.gov/',            scope: 'city' },
  'us-minneapolis-mn':       { name: 'City of Minneapolis',    url: 'https://www.minneapolismn.gov/',         scope: 'city' },
  'us-nashville-tn':         { name: 'Metro Nashville & Davidson County', url: 'https://www.nashville.gov/', scope: 'city' },
  'us-new-york-city':        { name: 'City of New York',       url: 'https://www.nyc.gov/',                   scope: 'city' },
  'us-norfolk-va':           { name: 'City of Norfolk',        url: 'https://www.norfolk.gov/',               scope: 'city' },
  'us-oakland-county-mi':    { name: 'Oakland County, MI',     url: 'https://www.oakgov.com/',                scope: 'county' },
  'us-palm-bay-fl':          { name: 'City of Palm Bay',       url: 'https://www.palmbayflorida.org/',        scope: 'city' },
  'us-philadelphia':         { name: 'City of Philadelphia',   url: 'https://www.phila.gov/',                 scope: 'city' },
  'us-pittsburgh-pa':        { name: 'City of Pittsburgh',     url: 'https://pittsburghpa.gov/',              scope: 'city' },
  'us-port-huron-mi':        { name: 'City of Port Huron',     url: 'https://www.porthuron.org/',             scope: 'city' },
  'us-portsmouth-va':        { name: 'City of Portsmouth',     url: 'https://www.portsmouthva.gov/',          scope: 'city' },
  'us-quincy-fl':            { name: 'Gadsden County, FL',     url: 'https://www.gadsdenfl.gov/',             scope: 'county' },
  'us-raleigh':              { name: 'City of Raleigh',        url: 'https://www.raleighnc.gov/',             scope: 'city' },
  'us-richmond':             { name: 'City of Richmond, VA',   url: 'https://rva.gov/',                       scope: 'city' },
  'us-saint-paul-mn':        { name: 'City of Saint Paul',     url: 'https://www.stpaul.gov/',                scope: 'city' },
  'us-san-marcos-tx':        { name: 'City of San Marcos',     url: 'https://www.sanmarcostx.gov/',           scope: 'city' },
  'us-savannah':             { name: 'City of Savannah',       url: 'https://www.savannahga.gov/',            scope: 'city' },
  'us-skowhegan-me':         { name: 'Town of Skowhegan',      url: 'https://www.skowhegan.org/',             scope: 'city' },
  'us-st-augustine-fl':      { name: 'City of St. Augustine',  url: 'https://www.citystaug.com/',             scope: 'city' },
  'us-st-petersburg-fl':     { name: 'City of St. Petersburg', url: 'https://www.stpete.org/',                scope: 'city' },
  'us-summerville':          { name: 'Town of Summerville',    url: 'https://www.summervillesc.gov/',         scope: 'city' },
  'us-tampa-fl':             { name: 'City of Tampa',          url: 'https://www.tampa.gov/',                 scope: 'city' },
  'us-virginia':             { name: 'Commonwealth of Virginia', url: 'https://www.virginia.gov/',            scope: 'state' },
  'us-virginia-beach-va':    { name: 'City of Virginia Beach', url: 'https://www.virginiabeach.gov/',         scope: 'city' },
  'us-williamsport-pa':      { name: 'City of Williamsport',   url: 'https://www.cityofwilliamsport.org/',    scope: 'city' },
  'us-yulee-fl':             { name: 'Nassau County, FL',      url: 'https://www.nassaucountyfl.com/',        scope: 'county' },

  // ───── US DC-metro suburbs (typically county-level) ─────
  'us-annandale-va':         { name: 'Fairfax County, VA',     url: 'https://www.fairfaxcounty.gov/',         scope: 'county' },
  'us-annapolis-md':         { name: 'City of Annapolis',      url: 'https://www.annapolis.gov/',             scope: 'city' },
  'us-bowie-md':             { name: 'City of Bowie',          url: 'https://www.cityofbowie.org/',           scope: 'city' },
  'us-camden-nj':            { name: 'City of Camden',         url: 'https://camdennj.gov/',                  scope: 'city' },
  'us-catonsville-md':       { name: 'Baltimore County, MD',   url: 'https://www.baltimorecountymd.gov/',     scope: 'county' },
  'us-elkridge-md':          { name: 'Howard County, MD',      url: 'https://www.howardcountymd.gov/',        scope: 'county' },
  'us-gainesville-va':       { name: 'Prince William County, VA', url: 'https://www.pwcva.gov/',              scope: 'county' },
  'us-glen-burnie-md':       { name: 'Anne Arundel County, MD', url: 'https://www.aacounty.org/',             scope: 'county' },
  'us-lorton-va':            { name: 'Fairfax County, VA',     url: 'https://www.fairfaxcounty.gov/',         scope: 'county' },
  'us-manassas-va':          { name: 'City of Manassas',       url: 'https://www.manassasva.gov/',            scope: 'city' },

  // ───── US Territories ─────
  'us-charlotte-amalie-vi':  { name: 'U.S. Virgin Islands Government', url: 'https://www.vi.gov/',            scope: 'territory' },
  'us-christiansted-vi':     { name: 'U.S. Virgin Islands Government', url: 'https://www.vi.gov/',            scope: 'territory' },
  'us-dededo-gu':            { name: 'Government of Guam',     url: 'https://www.guam.gov/',                  scope: 'territory' },
  'us-hagatna-gu':           { name: 'Government of Guam',     url: 'https://www.guam.gov/',                  scope: 'territory' },
  'us-pago-pago-as':         { name: 'American Samoa Government', url: 'https://www.americansamoa.gov/',      scope: 'territory' },
  'us-tafuna-as':            { name: 'American Samoa Government', url: 'https://www.americansamoa.gov/',      scope: 'territory' },
  'us-ponce-pr':             { name: 'Government of Puerto Rico', url: 'https://www.pr.gov/',                 scope: 'territory' },
  'us-san-juan-pr':          { name: 'Municipio de San Juan',  url: 'https://sanjuanciudadpatria.com/',       scope: 'city' },
  'us-saipan-mp':            { name: 'Commonwealth of the Northern Mariana Islands', url: 'https://www.cnmi.gov/', scope: 'territory' },
  'us-tinian-mp':            { name: 'Commonwealth of the Northern Mariana Islands', url: 'https://www.cnmi.gov/', scope: 'territory' },

  // ───── Colombia ─────
  'colombia-bogota':         { name: 'Alcaldía Mayor de Bogotá', url: 'https://bogota.gov.co/',                scope: 'city' },
  'colombia-cartagena':      { name: 'Alcaldía de Cartagena',  url: 'https://www.cartagena.gov.co/',          scope: 'city' },
  'colombia-medellin':       { name: 'Alcaldía de Medellín',   url: 'https://www.medellin.gov.co/',           scope: 'city' },
  'colombia-pereira':        { name: 'Alcaldía de Pereira',    url: 'https://www.pereira.gov.co/',            scope: 'city' },
  'colombia-santa-marta':    { name: 'Alcaldía Distrital de Santa Marta', url: 'https://www.santamarta.gov.co/', scope: 'city' },

  // ───── Costa Rica ─────
  'costa-rica-arenal':       { name: 'Municipalidad de San Carlos', url: 'https://www.munisc.go.cr/',          scope: 'municipio' },
  'costa-rica-atenas':       { name: 'Municipalidad de Atenas', url: 'https://www.atenas.go.cr/',             scope: 'municipio' },
  'costa-rica-central-valley':{ name: 'Municipalidad de San José', url: 'https://www.msj.go.cr/',              scope: 'municipio' },
  'costa-rica-grecia':       { name: 'Municipalidad de Grecia', url: 'https://www.grecia.go.cr/',             scope: 'municipio' },
  'costa-rica-guanacaste':   { name: 'Gobierno de Costa Rica — Guanacaste', url: 'https://guanacaste.go.cr/', scope: 'province' },
  'costa-rica-puerto-viejo': { name: 'Municipalidad de Talamanca', url: 'https://www.talamanca.go.cr/',       scope: 'municipio' },

  // ───── Croatia ─────
  'croatia-dubrovnik':       { name: 'Grad Dubrovnik',         url: 'https://www.dubrovnik.hr/',              scope: 'city' },
  'croatia-istria':          { name: 'Istarska županija',      url: 'https://www.istra-istria.hr/',           scope: 'county' },
  'croatia-split':           { name: 'Grad Split',             url: 'https://www.split.hr/',                  scope: 'city' },
  'croatia-zagreb':          { name: 'Grad Zagreb',            url: 'https://www.zagreb.hr/',                 scope: 'city' },

  // ───── Cyprus ─────
  'cyprus-larnaca':          { name: 'Larnaka Municipality',   url: 'https://www.larnaka.org.cy/',            scope: 'city' },
  'cyprus-limassol':         { name: 'Lemesos (Limassol) Municipality', url: 'https://www.limassolmunicipal.com.cy/', scope: 'city' },
  'cyprus-paphos':           { name: 'Pafos Municipality',     url: 'https://www.pafos.org.cy/',              scope: 'city' },

  // ───── Ecuador ─────
  'ecuador-cotacachi':       { name: 'GAD Municipal Cotacachi', url: 'https://cotacachi.gob.ec/',             scope: 'municipio' },
  'ecuador-cuenca':          { name: 'GAD Municipal del Cantón Cuenca', url: 'https://www.cuenca.gob.ec/',    scope: 'municipio' },
  'ecuador-quito':           { name: 'Municipio del Distrito Metropolitano de Quito', url: 'https://www.quito.gob.ec/', scope: 'city' },
  'ecuador-salinas':         { name: 'GAD Municipal de Salinas', url: 'https://www.salinas.gob.ec/',          scope: 'municipio' },
  'ecuador-vilcabamba':      { name: 'GAD Municipal de Loja',  url: 'https://www.loja.gob.ec/',               scope: 'municipio' },

  // ───── France ─────
  'france-brittany':         { name: 'Région Bretagne',        url: 'https://www.bretagne.bzh/',              scope: 'region' },
  'france-dordogne':         { name: 'Département de la Dordogne', url: 'https://www.dordogne.fr/',           scope: 'department' },
  'france-gascony':          { name: 'Région Occitanie',       url: 'https://www.laregion.fr/',               scope: 'region' },
  'france-languedoc':        { name: 'Région Occitanie',       url: 'https://www.laregion.fr/',               scope: 'region' },
  'france-lyon':             { name: 'Ville de Lyon',          url: 'https://www.lyon.fr/',                   scope: 'city' },
  'france-montpellier':      { name: 'Ville de Montpellier',   url: 'https://www.montpellier.fr/',            scope: 'city' },
  'france-nice':             { name: 'Ville de Nice',          url: 'https://www.nice.fr/',                   scope: 'city' },
  'france-paris':            { name: 'Ville de Paris',         url: 'https://www.paris.fr/',                  scope: 'city' },
  'france-toulon':           { name: 'Ville de Toulon',        url: 'https://www.toulon.fr/',                 scope: 'city' },
  'france-toulouse':         { name: 'Mairie de Toulouse',     url: 'https://www.toulouse.fr/',               scope: 'city' },

  // ───── Greece ─────
  'greece-athens':           { name: 'City of Athens',         url: 'https://www.cityofathens.gr/',           scope: 'city' },
  'greece-corfu':            { name: 'Municipality of Corfu',  url: 'https://www.corfu.gr/',                  scope: 'city' },
  'greece-crete':            { name: 'Region of Crete',        url: 'https://www.crete.gov.gr/',              scope: 'region' },
  'greece-peloponnese':      { name: 'Region of Peloponnese',  url: 'https://www.ppel.gov.gr/',               scope: 'region' },
  'greece-rhodes':           { name: 'Municipality of Rhodes', url: 'https://www.rhodes.gr/',                 scope: 'city' },

  // ───── Ireland ─────
  'ireland-cork':            { name: 'Cork City Council',      url: 'https://www.corkcity.ie/',               scope: 'city' },
  'ireland-galway':          { name: 'Galway City Council',    url: 'https://www.galwaycity.ie/',             scope: 'city' },
  'ireland-limerick':        { name: 'Limerick City & County Council', url: 'https://www.limerick.ie/',       scope: 'city' },
  'ireland-waterford':       { name: 'Waterford City & County Council', url: 'https://www.waterfordcouncil.ie/', scope: 'city' },
  'ireland-wexford':         { name: 'Wexford County Council', url: 'https://www.wexfordcoco.ie/',            scope: 'county' },

  // ───── Italy ─────
  'italy-abruzzo':           { name: 'Regione Abruzzo',        url: 'https://www.regione.abruzzo.it/',        scope: 'region' },
  'italy-lake-region':       { name: 'Regione Lombardia',      url: 'https://www.regione.lombardia.it/',      scope: 'region' },
  'italy-puglia':            { name: 'Regione Puglia',         url: 'https://www.regione.puglia.it/',         scope: 'region' },
  'italy-sardinia':          { name: 'Regione Autonoma della Sardegna', url: 'https://www.regione.sardegna.it/', scope: 'region' },
  'italy-sicily':            { name: 'Regione Siciliana',      url: 'https://www.regione.sicilia.it/',        scope: 'region' },
  'italy-tuscany':           { name: 'Regione Toscana',        url: 'https://www.regione.toscana.it/',        scope: 'region' },

  // ───── Malta ─────
  'malta-gozo':              { name: 'Ministry for Gozo',      url: 'https://mgoz.gov.mt/',                   scope: 'region' },
  'malta-sliema':            { name: 'Sliema Local Council',   url: 'https://sliema.gov.mt/',                 scope: 'city' },
  'malta-valletta':          { name: 'Valletta Local Council', url: 'https://www.cityofvalletta.gov.mt/',     scope: 'city' },

  // ───── Mexico ─────
  'mexico-lake-chapala':     { name: 'Municipio de Chapala',   url: 'https://chapala.gob.mx/',                scope: 'municipio' },
  'mexico-mazatlan':         { name: 'Gobierno de Mazatlán',   url: 'https://www.mazatlan.gob.mx/',           scope: 'city' },
  'mexico-merida':           { name: 'Ayuntamiento de Mérida', url: 'https://www.merida.gob.mx/',             scope: 'city' },
  'mexico-oaxaca':           { name: 'Municipio de Oaxaca de Juárez', url: 'https://www.municipiodeoaxaca.gob.mx/', scope: 'city' },
  'mexico-playa-del-carmen': { name: 'Municipio de Solidaridad', url: 'https://www.solidaridadquintanaroo.gob.mx/', scope: 'municipio' },
  'mexico-puerto-vallarta':  { name: 'Ayuntamiento de Puerto Vallarta', url: 'https://www.puertovallarta.gob.mx/', scope: 'city' },
  'mexico-queretaro':        { name: 'Municipio de Querétaro', url: 'https://municipiodequeretaro.gob.mx/',   scope: 'city' },
  'mexico-san-miguel-de-allende': { name: 'Municipio de San Miguel de Allende', url: 'https://sanmigueldeallende.gob.mx/', scope: 'city' },

  // ───── Panama ─────
  'panama-bocas-del-toro':   { name: 'Gobernación de Bocas del Toro', url: 'https://www.bocasdeltoro.gob.pa/', scope: 'province' },
  'panama-boquete':          { name: 'Gobierno de Chiriquí',   url: 'https://www.chiriqui.gob.pa/',           scope: 'province' },
  'panama-chitre':           { name: 'Gobernación de Herrera', url: 'https://www.herrera.gob.pa/',            scope: 'province' },
  'panama-city':             { name: 'Municipio de Panamá',    url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-city-bella-vista': { name: 'Municipio de Panamá',    url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-city-casco-viejo': { name: 'Municipio de Panamá',    url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-city-costa-del-este': { name: 'Municipio de Panamá', url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-city-el-cangrejo': { name: 'Municipio de Panamá',    url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-city-punta-pacifica': { name: 'Municipio de Panamá', url: 'https://www.mupa.gob.pa/',               scope: 'city' },
  'panama-coronado':         { name: 'Municipio de Chame',     url: 'https://www.chame.gob.pa/',              scope: 'municipio' },
  'panama-david':            { name: 'Municipio de David',     url: 'https://www.munidavid.gob.pa/',          scope: 'city' },
  'panama-el-valle':         { name: 'Municipio de Antón',     url: 'https://www.anton.gob.pa/',              scope: 'municipio' },
  'panama-pedasi':           { name: 'Provincia de Los Santos', url: 'https://www.los-santos.gob.pa/',         scope: 'province' },
  'panama-puerto-armuelles': { name: 'Gobierno de Chiriquí',   url: 'https://www.chiriqui.gob.pa/',           scope: 'province' },
  'panama-volcan':           { name: 'Gobierno de Chiriquí',   url: 'https://www.chiriqui.gob.pa/',           scope: 'province' },

  // ───── Portugal ─────
  'portugal-algarve':        { name: 'Região do Algarve (CCDR Algarve)', url: 'https://www.ccdr-alg.pt/',     scope: 'region' },
  'portugal-cascais':        { name: 'Câmara Municipal de Cascais', url: 'https://www.cascais.pt/',           scope: 'city' },
  'portugal-lisbon':         { name: 'Câmara Municipal de Lisboa', url: 'https://www.lisboa.pt/',             scope: 'city' },
  'portugal-porto':          { name: 'Câmara Municipal do Porto', url: 'https://www.cm-porto.pt/',            scope: 'city' },
  'portugal-silver-coast':   { name: 'CCDR Centro (Silver Coast region)', url: 'https://www.ccdrc.pt/',       scope: 'region' },

  // ───── Spain ─────
  'spain-alicante':          { name: 'Ayuntamiento de Alicante', url: 'https://www.alicante.es/',             scope: 'city' },
  'spain-barcelona':         { name: 'Ajuntament de Barcelona', url: 'https://www.barcelona.cat/',            scope: 'city' },
  'spain-canary-islands':    { name: 'Gobierno de Canarias',   url: 'https://www.gobiernodecanarias.org/',    scope: 'region' },
  'spain-costa-del-sol':     { name: 'Junta de Andalucía',     url: 'https://www.juntadeandalucia.es/',       scope: 'region' },
  'spain-valencia':          { name: 'Ajuntament de València', url: 'https://www.valencia.es/',               scope: 'city' },

  // ───── Uruguay ─────
  'uruguay-colonia':         { name: 'Intendencia de Colonia', url: 'https://www.colonia.gub.uy/',            scope: 'department' },
  'uruguay-montevideo':      { name: 'Intendencia de Montevideo', url: 'https://montevideo.gub.uy/',          scope: 'department' },
  'uruguay-punta-del-este':  { name: 'Intendencia de Maldonado', url: 'https://www.maldonado.gub.uy/',        scope: 'department' },
};

// ────────────────────────────────────────────────────────────────

let touched = 0;
let skipped = 0;
let unmapped = [];

for (const dir of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const locId = dir.name;
  const gov = GOV_SITES[locId];
  if (!gov) { unmapped.push(locId); continue; }

  const path = join(DATA_DIR, locId, 'local-info.json');
  let data;
  if (existsSync(path)) {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } else {
    data = {};
  }

  if (!Array.isArray(data.officialSites)) data.officialSites = [];

  // Skip if a matching URL is already present.
  const already = data.officialSites.some(s =>
    s && (s.url === gov.url || s.name === gov.name)
  );
  if (already) { skipped++; continue; }

  data.officialSites.push({
    name: gov.name,
    url: gov.url,
    type: 'government',
    scope: gov.scope,
  });

  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  touched++;
}

console.log(`touched:   ${touched}`);
console.log(`skipped:   ${skipped}`);
console.log(`unmapped:  ${unmapped.length}`);
if (unmapped.length) {
  console.log('\nLocations without a gov-site mapping:');
  for (const u of unmapped) console.log(`  ${u}`);
}
