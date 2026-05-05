#!/usr/bin/env node
/**
 * One-shot data migration: replace `(search)` placeholders for
 * `religious_mosque` and `religious_synagogue` categories where OSM
 * enrichment found no match (Todo #14).
 *
 * Strategy and source rationale documented in:
 *   audits/2026-05-05-religious-centers-source-research.md
 *
 * Headline findings from the research memo:
 *   - Wikidata SPARQL: too sparse outside major historical sites.
 *     Probed Mexico (1 mosque) + Bolivia (0 synagogues). Rejected.
 *   - Salatomatic: no public API; ToS forbids scraping. Rejected.
 *   - SynagogueConnect: US-college-only. Rejected.
 *   - Sect-specific directories (OU, Chabad, etc.): each is movement-
 *     specific; cross-referencing for neutral lookup is impractical.
 *   - WebSearch / Google Maps top-rated: practical and global.
 *     Recommended (this script).
 *
 * Risk mitigation per todo #14's "thin-skinned data" warning
 * (mis-labeling Sufi-as-Sunni or Reform-as-Orthodox is worse than
 * having no entry):
 *
 *   - We DO NOT classify denomination/sect.
 *   - Every curated entry's `notes` includes a disclaimer directing
 *     the user to verify denomination/sect for their personal
 *     religious requirements.
 *   - Locations with no mosque/synagogue within ~30 mi keep the
 *     original Google Maps fallback search-link source and update
 *     `notes` to be honest about cuisine genuinely unavailable +
 *     where the closest dedicated option lives.
 *
 * Idempotent: skips entries that no longer match the placeholder.
 *
 * Run: node scripts/apply-religious-curation.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-05';

const VERIFY_DENOM = 'Verify denomination/sect (e.g. Sunni / Shia / Sufi for mosques; Orthodox / Conservative / Reform / Reconstructionist for synagogues) for personal religious requirements before relying on it.';

// ─── Curation map: locId → cuisineId → { name, url, notes } ───────────
//
// Each entry includes the denomination-verification disclaimer in notes.

const CURATIONS = {
  // ─── Mexico ──────────────────────────────────────────────────────
  'mexico-merida': {
    religious_mosque: {
      name: 'Comunidad Musulmana Ahmadia de México (Mérida)',
      url: 'https://ahmadiyyatmosques.wordpress.com/2017/11/04/ahmadiyya-mission-house-merida-mexico/',
      notes: `Ahmadiyya mission house in Mérida (Calle 60 No. 453A x 51 Centro). Imam Noman Rana. Ahmadiyya — note this is a specific Islamic movement; ${VERIFY_DENOM} A separate Mezquita Medina opened in 2021 for the broader Sunni community.`,
    },
    religious_synagogue: {
      name: 'Comunidad Judía de Mérida / Chabad Mérida',
      url: 'https://www.chabadmeridamexico.com/en',
      notes: `Small Jewish community in Mérida (~200 citizens). Chabad-Lubavitch operates regular services. A standalone synagogue building was planned 2021. ${VERIFY_DENOM}`,
    },
  },
  'mexico-mazatlan': {
    // mosque + synagogue: NO MATCH — handled in NO_MATCH_NOTES
  },
  'mexico-queretaro': {
    religious_mosque: {
      name: 'Centro Cultural Islámico de Querétaro',
      url: 'https://www.facebook.com/CCIslamicoQueretaro/',
      notes: `Islamic cultural center in Querétaro Centro Histórico (C. Reforma 44). Free Quran + prayer classes Mondays. ${VERIFY_DENOM}`,
    },
  },
  'mexico-oaxaca': {
    religious_synagogue: {
      name: 'Sinagoga Ohel Moshe (Oaxaca)',
      url: 'https://www.chabad.org/jewish-centers/location/1-1248/Oaxaca-Mexico',
      notes: `Small synagogue in Oaxaca. Jewish community is very small — handful of families, no full-time rabbi. ${VERIFY_DENOM}`,
    },
  },
  'mexico-playa-del-carmen': {
    religious_synagogue: {
      name: 'Chabad Lubavitch of Playa Del Carmen',
      url: 'https://www.chabadplaya.com/',
      notes: `Chabad-Lubavitch (Hasidic) center in Playa del Carmen (10 Avenida Norte, between Calle 6 & 8). Synagogue + kosher store + restaurant. Rabbi Mendel Goldberg. ${VERIFY_DENOM}`,
    },
  },
  'mexico-puerto-vallarta': {
    religious_synagogue: {
      name: 'Chabad of Puerto Vallarta',
      url: 'https://www.chabadvallarta.com/',
      notes: `Chabad-Lubavitch (Hasidic) center in Puerto Vallarta (Francisco Medina Asencio 1951). Rabbi Shneur Hecht. Mikvah on-site. ${VERIFY_DENOM}`,
    },
  },
  'mexico-san-miguel-de-allende': {
    religious_synagogue: {
      name: 'Shalom San Miguel JC3 / Chabad of SMA',
      url: 'https://shalomsanmiguel.org/',
      notes: `Two Jewish institutions in San Miguel de Allende: JC3/CHESMA is inter/non-denominational (~1,000 expat Jews); Chabad of SMA est. 2018 (Hasidic). ${VERIFY_DENOM}`,
    },
  },
  'mexico-lake-chapala': {
    religious_synagogue: {
      name: 'Lake Chapala Jewish Congregation',
      url: 'https://www.lakechapalajewishcongregation.com/',
      notes: `Lay-led congregation in Ajijic (Sta Margarita 113, Ribeiras del Pilar). Visiting rabbis for High Holidays. Mostly US/Canadian retiree expats. ${VERIFY_DENOM}`,
    },
  },

  // ─── Spain ───────────────────────────────────────────────────────
  'spain-costa-del-sol': {
    religious_synagogue: {
      name: 'Comunidad Judía de Marbella (Beth El)',
      url: 'https://jewishmarbella.org/en/sinagogue/',
      notes: `First synagogue built in Andalusia after 1492 (consecrated 1978). Beth El + Synagogue Rambam Marbella + Chabad Costa del Sol all serve the area. ${VERIFY_DENOM}`,
    },
  },
  'spain-valencia': {
    religious_synagogue: {
      name: 'Comunidad Israelita de Valencia',
      url: 'https://ejassociation.eu/eja/comunidad-israelita-de-valencia/',
      notes: `Main Jewish community of Valencia (registered 1970). Other options: Sinagoga La Javurá (Conservative), Beit Jabad Valencia (Chabad), Bnei Sefarad (Reform Sephardic), Comunidad Masortí Aviv (Conservative/Egalitarian). ${VERIFY_DENOM}`,
    },
  },
  'spain-alicante': {
    religious_synagogue: {
      name: 'Comunidad Israelita de Alicante (Beth Shalom, Benidorm)',
      url: 'https://comisral.com/',
      notes: `Jewish community of Alicante / Costa Blanca, est. 1967. Synagogue in Benidorm (~25 mi from Alicante). New synagogue inaugurated in Alicante 2023. ${VERIFY_DENOM}`,
    },
  },
  'spain-canary-islands': {
    religious_synagogue: {
      name: 'Comunidad Israelita de Las Palmas / Chabad Tenerife',
      url: 'https://www.chabadtenerife.com/',
      notes: `Las Palmas (Gran Canaria) hosts the established synagogue (~20 families). Chabad of the Canary Islands operates from Puerto de la Cruz, Tenerife. ${VERIFY_DENOM}`,
    },
  },

  // ─── Cyprus ──────────────────────────────────────────────────────
  'cyprus-larnaca': {
    religious_synagogue: {
      name: 'Larnaca Synagogue (Cyprus Central Synagogue)',
      url: 'https://en.wikipedia.org/wiki/Larnaca_Synagogue',
      notes: `Modernist-style synagogue at Apollodorou 4, Larnaca (completed 2005). 3 prayer times daily. ${VERIFY_DENOM} (Note: Cyprus's Chief Rabbinate is affiliated with Chabad-Lubavitch.)`,
    },
  },
  'cyprus-limassol': {
    religious_synagogue: {
      name: 'Chabad House of Limassol',
      url: 'https://www.chabad.org/jewish-centers/2975830/Limassol/Synagogue/Chabad-House-of-Limassol',
      notes: `Chabad-Lubavitch center in Limassol (Porfyriou Dikaiou 5). ${VERIFY_DENOM}`,
    },
  },
  'cyprus-paphos': {
    religious_synagogue: {
      name: 'Synagogue of Paphos',
      url: 'https://rabbinatecyprus.org/en/listing/5587/',
      notes: `Synagogue in Paphos, opened 2017. Chabad-Lubavitch operates Chabad of Paphos as well. ${VERIFY_DENOM}`,
    },
  },

  // ─── Malta ───────────────────────────────────────────────────────
  'malta-sliema': {
    religious_synagogue: {
      name: 'Chabad of Malta (Sliema)',
      url: 'https://www.chabad.org/jewish-centers/2015539/Sliema/Synagogue/Chabad-of-Malta',
      notes: `Chabad-Lubavitch (Hasidic) center in Sliema (118 Manwel Dimech). Maltese Jewish community also operates established synagogue at Florida Mansions, Enrico Mazzi St, Ta'xbiex (consecrated 2000). ${VERIFY_DENOM}`,
    },
  },
  'malta-valletta': {
    religious_synagogue: {
      name: 'Synagogue of Malta (Ta\'xbiex)',
      url: 'https://www.totallyjewishtravel.com/Synagogues-TE52742-synagogue_of_malta-shul-valletta_malta-Minyan.html',
      notes: `Established Maltese Jewish community synagogue at Florida Mansions, Enrico Mazzi St, Ta'xbiex (~3 mi from Valletta), consecrated 2000. ${VERIFY_DENOM}`,
    },
  },
  'malta-gozo': {
    religious_synagogue: {
      name: 'Synagogue of Malta (Ta\'xbiex, on main island)',
      url: 'https://www.totallyjewishtravel.com/Synagogues-TE52742-synagogue_of_malta-shul-valletta_malta-Minyan.html',
      notes: `No synagogue on Gozo island itself. Closest is Synagogue of Malta in Ta'xbiex on main Malta island (~25 mi by ferry+road). ${VERIFY_DENOM}`,
    },
  },

  // ─── Portugal ────────────────────────────────────────────────────
  'portugal-algarve': {
    religious_synagogue: {
      name: 'Ezra & Sasson Synagogue (Albufeira)',
      url: 'https://www.jewishalgarve.org/synagogue',
      notes: `Synagogue of the Jewish Community of the Algarve, in Albufeira. Sephardic Torah from Morocco. Portugal's fourth official Jewish community (registered 2022). ${VERIFY_DENOM}`,
    },
  },

  // ─── Italy ───────────────────────────────────────────────────────
  'italy-puglia': {
    religious_mosque: {
      name: 'Bari Central Mosque (Moschea Centrale di Bari)',
      url: 'https://www.tripadvisor.com/Attraction_Review-g187874-d17478538-Reviews-Bari_Central_Mosque-Bari_Province_of_Bari_Puglia.html',
      notes: `Largest mosque in Puglia (Via Michele Cifarelli 28/C, Bari). 5 daily prayers. ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Scolanova Synagogue (Trani)',
      url: 'https://en.wikipedia.org/wiki/Scolanova_Synagogue',
      notes: `Restored synagogue in Trani, Puglia (Via Sinagoga 47). Returned to Jewish community 2006 after 600+ years as a church. ${VERIFY_DENOM}`,
    },
  },
  'italy-sicily': {
    religious_mosque: {
      name: 'Moschea di Palermo',
      url: 'https://praysalat.com/mosques/italy/palermo',
      notes: `Mosque in central Palermo (Via del Celso). Multiple smaller mosques in the city; Catania has Moschea Della Misericordia and Moschea Di Catania. ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Catania Synagogue (Castle of Leucatia)',
      url: 'https://italianamericanherald.com/catania-synagogue-marks-one-year-of-sabbath-services/',
      notes: `Sicily's first synagogue in 500 years (formally inaugurated 2022, top floor of Castle of Leucatia). Palermo also has the new oratory of Santa Maria del Sabato (donated 2017). ${VERIFY_DENOM}`,
    },
  },
  'italy-lake-region': {
    religious_synagogue: {
      name: 'Chabad Como',
      url: 'https://www.chabad.org/jewish-centers/6519995/Como/Synagogue/Chabad-Como',
      notes: `Chabad-Lubavitch (Hasidic) in Como (Via Museo Giovio 8). Como historically had no Jewish community; this is recent. Comunità Ebraica di Milano (~30 mi south) is the regional anchor. ${VERIFY_DENOM}`,
    },
  },

  // ─── Greece ──────────────────────────────────────────────────────
  'greece-crete': {
    religious_synagogue: {
      name: 'Etz Hayyim Synagogue (Chania)',
      url: 'https://www.etz-hayyim-hania.org/',
      notes: `Only operating synagogue in Crete (Chania old town). Romaniote-tradition; restored 1999 after 1944 deportation. Open during Jewish holidays + cultural events. ${VERIFY_DENOM}`,
    },
  },

  // ─── France ──────────────────────────────────────────────────────
  'france-dordogne': {
    religious_mosque: {
      name: 'Mosquée de la Bienfaisance de Périgueux',
      url: 'https://www.trouvetamosquee.fr/mosquee-de-la-bienfaisance-perigueux-dordogne/',
      notes: `Main mosque in Périgueux (18 rue du Tennis). Other Dordogne mosques: Mosquée de Naillac + Mosquée de la Catte (Bergerac), Mosquée Turque (Terrasson). ${VERIFY_DENOM}`,
    },
  },
  'france-nice': {
    religious_mosque: {
      name: 'Mosquée En-Nour (Nice)',
      url: 'https://en-nour.org/',
      notes: `Largest mosque in Nice (130 Boulevard de la Madeleine, capacity 800). Run by Centre Culturel la Madeleine; under judicial administration since Oct 2025 amid governance review. ${VERIFY_DENOM}`,
    },
  },

  // ─── Colombia ────────────────────────────────────────────────────
  'colombia-medellin': {
    religious_mosque: {
      name: 'Mezquita Al-Salam (Medellín)',
      url: 'https://www.facebook.com/MezquitaAlSalam/',
      notes: `One of the most active mosques in Colombia (Glorieta Av. Guayabal, Cll. 10 # 52-41, Medellín). ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Chabad Lubavitch Medellín',
      url: 'https://www.chabad.org/jewish-centers/5603886/Medellin/Synagogue/Chabad-Lubavitch-Medellin',
      notes: `Chabad-Lubavitch (Hasidic) center in Medellín. Medellín also has a Jewish day school. ${VERIFY_DENOM}`,
    },
  },
  'colombia-cartagena': {
    religious_synagogue: {
      name: 'Chabad Cartagena / Rabbi Isaac Abravanel Sephardic Center',
      url: 'https://www.chabad.org/jewish-centers/location/1-108/Cartagena-Colombia',
      notes: `Two synagogues serve the small Cartagena Jewish community: Chabad-Lubavitch (Hasidic) and the Rabbi Isaac Abravanel Sephardic Israelite Center. ${VERIFY_DENOM}`,
    },
  },

  // ─── Ecuador ─────────────────────────────────────────────────────
  // No clear named mosque in Cuenca per searches; cuencahighlife mentions
  // a small mosque but the OSM enrichment apparently didn't find it. Keep
  // as no-match per defensive choice.

  // ─── Uruguay ─────────────────────────────────────────────────────
  'uruguay-montevideo': {
    religious_mosque: {
      name: 'Centro Islámico del Uruguay (Montevideo)',
      url: 'https://centroislamicouruguay.com.uy/mezquita',
      notes: `Mosque + Islamic center in Montevideo (Soriano 1227). The Egyptian Center of Islamic Culture (Baltasar Vargas 1178, est. 1982) is also active. ${VERIFY_DENOM}`,
    },
  },
  'uruguay-punta-del-este': {
    religious_synagogue: {
      name: 'Beit Yaacov Synagogue (Punta del Este)',
      url: 'https://en.wikipedia.org/wiki/Beit_Yaacov_Synagogue,_Punta_del_Este',
      notes: `Sephardic Orthodox synagogue (Calle Riso, near bus station). Punta del Este has 3 synagogues — 2 Sephardic Orthodox and 1 Chabad. CIPEMU community center est. 2005. ${VERIFY_DENOM}`,
    },
  },

  // ─── Panama ──────────────────────────────────────────────────────
  'panama-bocas-del-toro': {
    religious_synagogue: {
      name: 'Chabad of Bocas del Toro',
      url: 'https://www.chabad.org/jewish-centers/location/1-2776/Bocas-del-Toro-Panama',
      notes: `Chabad-Lubavitch satellite in Bocas del Toro (Hasidic). Shabbat dinners + services for Jewish travelers. ${VERIFY_DENOM}`,
    },
  },
  'panama-boquete': {
    religious_synagogue: {
      name: 'Chabad of Boquete',
      url: 'https://www.totallyjewishtravel.com/Kosher_Tours-TL7795-bajo_boquete_panama-Vacations.html',
      notes: `Chabad-Lubavitch center in Boquete (est. 2016, Hasidic). Serves the ~10K American expats in Chiriquí region. ${VERIFY_DENOM}`,
    },
  },

  // ─── US Territories ──────────────────────────────────────────────
  'us-charlotte-amalie-vi': {
    religious_mosque: {
      name: 'Masjid Nur (St. Thomas)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_the_United_States_Virgin_Islands',
      notes: `First Islamic center in USVI, est. 1978 in Charlotte Amalie (originally Muhammad Mosque, renamed Masjid Nur Ahl-Us Sunnah). ${VERIFY_DENOM}`,
    },
  },
  'us-christiansted-vi': {
    religious_mosque: {
      name: 'Masjid Nur Ahl-Us Sunnah (St. Croix)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_the_United_States_Virgin_Islands',
      notes: `First mosque on St. Croix, built 1984. Iqra Academy Islamic school est. 1998. Contact: VI International Islamic Society +1-340-713-9835. ${VERIFY_DENOM}`,
    },
  },
  'us-dededo-gu': {
    religious_mosque: {
      name: 'An-Nur Mosque (Mangilao, Guam)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_Guam',
      notes: `Only mosque on Guam (Mangilao village, ~10 mi south of Dededo). Muslim Association of Guam est. 1990. ${VERIFY_DENOM}`,
    },
  },
  'us-hagatna-gu': {
    religious_mosque: {
      name: 'An-Nur Mosque (Mangilao, Guam)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_Guam',
      notes: `Only mosque on Guam (Mangilao village, ~6 mi east of Hagåtña). Muslim Association of Guam est. 1990. ${VERIFY_DENOM}`,
    },
  },
  'us-saipan-mp': {
    religious_mosque: {
      name: 'Saipan Baitus Salam Jam-e Masjid (Garapan)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_the_Northern_Mariana_Islands',
      notes: `Mosque in Garapan, Saipan (est. 1997). Second mosque (As Lito) constructed later. Community ~0.7% of CNMI population, mostly Pakistani / Sri Lankan / Bangladeshi / Indian / Filipino. ${VERIFY_DENOM}`,
    },
  },
  'us-tinian-mp': {
    religious_mosque: {
      name: 'Mosque on Tinian (per CNMI Islamic community)',
      url: 'https://en.wikipedia.org/wiki/Islam_in_the_Northern_Mariana_Islands',
      notes: `Mosques exist on Tinian per CNMI Islamic community sources, though specific facility names are not well-documented online. Closest established mosques are in Saipan (Baitus Salam Jam-e Masjid + As Lito), ~5 mi by ferry. ${VERIFY_DENOM}`,
    },
  },
  'us-ponce-pr': {
    religious_mosque: {
      name: 'Islamic Center at Ponce',
      url: 'https://islammessage.org/en/center/315/ISLAMIC-CENTER-AT-PONCE',
      notes: `Islamic Center in Ponce (built 1997, capacity 200 men + 30 women). Fifth mosque on Puerto Rico. Palestinian-led community. ${VERIFY_DENOM}`,
    },
  },

  // ─── US Mainland ─────────────────────────────────────────────────
  'us-birmingham-al': {
    religious_mosque: {
      name: 'Hoover Crescent Islamic Center / Birmingham Islamic Society',
      url: 'https://www.bisweb.org/our-masjids/',
      notes: `Largest Muslim prayer facility in greater Birmingham, administrative home of Birmingham Islamic Society. BIS also operates Homewood Masjid + West Side Masjid. ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Temple Beth-El (Birmingham)',
      url: 'https://www.templebeth-el.net/',
      notes: `Conservative synagogue (2179 Highland Avenue). Founded 1907; only Conservative-affiliated synagogue in Birmingham. ~600-700 families. ${VERIFY_DENOM}`,
    },
  },
  'us-killeen-tx': {
    religious_mosque: {
      name: 'Islamic Community of Greater Killeen',
      url: 'https://icgk.org/',
      notes: `Sunni mosque in Killeen (195 S Fort Hood St, near Fort Cavazos). ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Congregation Simcha Sinai (Bell County, Reform)',
      url: 'https://kdhnews.com/living/religion/first-reform-jewish-congregation-in-bell-county-gaining-new-members-gradually/article_c38071ac-5b09-5a08-a810-b6b1a11a8142.html',
      notes: `First Reform Jewish congregation in Bell County, est. 2012. Small congregation; bi-weekly Shabbat services. Closest established synagogues: Waco / Austin (~50-75 mi). ${VERIFY_DENOM}`,
    },
  },
  'us-florida': {
    religious_mosque: {
      name: 'Islamic Community of Tampa (Alqassam Mosque)',
      url: 'https://ictampa.org/',
      notes: `Statewide placeholder pick — Tampa's main mosque (5910 E 130th Ave). Alternatives: Islamic Community Center of Miami, Islamic Center of South Florida (Pompano Beach). ${VERIFY_DENOM}`,
    },
  },
  'us-quincy-fl': {
    religious_mosque: {
      name: 'Islamic Center of Tallahassee (Masjid Al-Furqan)',
      url: 'https://ictlh.org/',
      notes: `Sunni mosque in Tallahassee (1020 W Pensacola St, ~25 mi from Quincy). Est. 2008. ${VERIFY_DENOM}`,
    },
    religious_synagogue: {
      name: 'Temple Israel (Tallahassee)',
      url: 'https://www.templeisraeltlh.org/',
      notes: `Reform synagogue in Tallahassee (2215 Mahan Drive, ~25 mi from Quincy). Founded 1937 — first Jewish congregation in Tallahassee. Congregation Shomrei Torah (Conservative) also nearby. ${VERIFY_DENOM}`,
    },
  },
  'us-grand-forks-nd': {
    religious_synagogue: {
      name: "B'nai Israel Synagogue (Grand Forks)",
      url: 'https://bnaiisraelnd.org/',
      notes: `Reform synagogue (601 Cottonwood St). Est. 1891; National Register of Historic Places (2011). Members from Grand Forks Air Base + UND. ${VERIFY_DENOM}`,
    },
  },
  'us-williamsport-pa': {
    religious_synagogue: {
      name: 'Congregation Beth Ha-Sholom (Williamsport)',
      url: 'https://bethhasholom.org/',
      notes: `Reform synagogue (425 Center Street). Est. 1866 — oldest surviving Jewish institution in Central PA. ~46 families; visiting student rabbi. ${VERIFY_DENOM}`,
    },
  },
  'us-port-huron-mi': {
    religious_synagogue: {
      name: 'Mount Sinai Congregation (Port Huron)',
      url: 'https://sah-archipedia.org/buildings/MI-01-SC10',
      notes: `Orthodox synagogue (903 Court St). Founded 1885 (cemetery), reorganized as congregation 1895. One of few outstate Michigan synagogues remaining Orthodox. ${VERIFY_DENOM}`,
    },
  },
  'us-san-marcos-tx': {
    religious_synagogue: {
      name: 'Rohr Chabad of San Marcos',
      url: 'https://www.jewishsmtx.com/',
      notes: `Chabad-Lubavitch (Hasidic) center serving Texas Hill Country (710 S Loop St, San Marcos). Est. 2016. Rabbi Ari Weingarten. ${VERIFY_DENOM}`,
    },
  },
  'us-summerville': {
    religious_synagogue: {
      name: 'Kahal Kadosh Beth Elohim (Charleston)',
      url: 'https://www.kkbe.org/',
      notes: `Reform synagogue in Charleston (~25 mi from Summerville). National Historic Landmark; founded 1749 — 4th oldest Jewish community in US. American Reform Judaism originated here 1824. ${VERIFY_DENOM}`,
    },
  },
};

// ─── No-match map: locId → categoryId → updated honest notes ───────────

const NO_MATCH_NOTES = {
  // Mexico
  'mexico-mazatlan': {
    religious_mosque: 'No dedicated mosque in Mazatlán. A Muslim community group "Musulmanes en Sinaloa" is active on social media but has no fixed mosque facility. Closest established mosques are in Mexico City (~6+ hr drive) or Guadalajara (~4 hr).',
    religious_synagogue: 'No synagogue in Mazatlán. Closest options are in Mexico City (~6+ hr drive) or Guadalajara (~4 hr). Lake Chapala Jewish Congregation in Ajijic is also a regional option.',
  },
  'mexico-merida': {
    // mosque + synagogue both curated above
  },
  'mexico-oaxaca': {
    religious_mosque: 'No mosque in Oaxaca yet. A masjid project is underway with crowdfunding to build the first mosque for the growing local Muslim community. Closest active mosque is in Mexico City (~6 hr drive).',
  },
  'mexico-playa-del-carmen': {
    religious_mosque: 'No mosque in Playa del Carmen. The Islamic Association of Quintana Roo serves the broader region; closest active mosques are in Cancún or Mexico City.',
  },
  'mexico-puerto-vallarta': {
    religious_mosque: 'No dedicated mosque in Puerto Vallarta. Closest active mosques are in Guadalajara (~4 hr drive) or Mexico City.',
  },
  'mexico-san-miguel-de-allende': {
    religious_mosque: 'No mosque in San Miguel de Allende. Closest active mosque is the Centro Cultural Islámico in Querétaro (~50 mi southeast) or Mexico City.',
  },

  // Colombia
  'colombia-cartagena': {
    religious_mosque: 'No mosque in Cartagena per 2015 community reports. Muslims in Cartagena reportedly travel to nearby villages for prayers. Closest dedicated mosques are in Maicao (continent\'s third-largest mosque, ~5 hr drive) or Bogotá.',
  },
  'colombia-pereira': {
    religious_mosque: 'No dedicated mosque in Pereira / Coffee Axis. Closest active mosques are Mezquita Al-Salam in Medellín (~3.5 hr) or Bogotá (~5 hr).',
    religious_synagogue: 'No synagogue in Pereira / Coffee Axis. Closest options are Chabad Lubavitch Medellín (~3.5 hr) or Bogotá synagogues (~5 hr).',
  },
  'colombia-santa-marta': {
    religious_mosque: 'No mosque in Santa Marta. Closest dedicated mosques are in Maicao (~3 hr east, continent\'s third-largest) or Bogotá (~16 hr).',
    religious_synagogue: 'No synagogue in Santa Marta. Closest options are in Barranquilla (~1.5 hr west) or Cartagena (~4 hr).',
  },

  // Costa Rica
  'costa-rica-arenal': {
    religious_mosque: 'No mosque in Arenal area. Closest is Mezquita de Omar in San José (~3 hr drive south).',
    religious_synagogue: 'No synagogue in Arenal area. Closest is Centro Israelita Sionista de Costa Rica in San José (~3 hr south).',
  },
  'costa-rica-guanacaste': {
    religious_mosque: 'No mosque in Guanacaste province (rural Pacific coast region). Closest is Mezquita de Omar in San José (~3-4 hr drive).',
  },
  'costa-rica-puerto-viejo': {
    religious_synagogue: 'No synagogue in Puerto Viejo (Caribbean coast). Closest is Centro Israelita Sionista de Costa Rica in San José (~4 hr drive).',
  },

  // Ecuador
  'ecuador-cotacachi': {
    religious_mosque: 'No mosque in Cotacachi. Closest is Centro Islámico del Ecuador (Alsalam Mosque) in Quito (~2 hr south).',
    religious_synagogue: 'No synagogue in Cotacachi. Closest is the Jewish Community of Ecuador in Quito (~2 hr south).',
  },
  'ecuador-cuenca': {
    religious_mosque: 'A small mosque exists in Cuenca per local reporting (Cuenca High Life), but no formal facility name was found via web search. The Centro Islámico del Ecuador in Quito (~7 hr north) is the established institutional mosque.',
    religious_synagogue: 'No active synagogue in Cuenca — historic Jewish presence largely absent (1-2 individuals from traditional communities per recent reporting). Closest is Quito (~7 hr north).',
  },
  'ecuador-salinas': {
    religious_mosque: 'No mosque in Salinas. Closest is Centro Islámico del Ecuador (Alsalam Mosque) in Quito (~9 hr drive northeast).',
    religious_synagogue: 'No synagogue in Salinas. Closest is the Jewish Community of Ecuador in Quito (~9 hr) or Guayaquil (~2 hr — small community).',
  },
  'ecuador-vilcabamba': {
    religious_mosque: 'No mosque in Vilcabamba (small mountain town, pop ~4K). Closest is Centro Islámico del Ecuador in Quito (~10 hr north).',
    religious_synagogue: 'No synagogue in Vilcabamba. Closest is the Jewish Community of Ecuador in Quito (~10 hr north).',
  },

  // France
  'france-gascony': {
    religious_synagogue: 'No synagogue in Gascony (rural region). Closest options are in Toulouse (~50-100 mi south, multiple synagogues) or Bordeaux (~100 mi north — Synagogue de Bordeaux).',
  },
  'france-dordogne': {
    religious_synagogue: 'No synagogue in Dordogne. Closest is in Bordeaux (~75 mi west) or Limoges (~75 mi north). Mosque coverage is provided in this entry; for synagogues see Bordeaux.',
  },

  // Greece
  'greece-crete': {
    religious_mosque: 'A small mosque exists in Heraklion per halal travel guides, but no specific facility name was found via web search. Several historic mosque buildings in Heraklion (e.g. Defterdar Ahmet Pasha Mosque) are now art galleries / museums, not active places of worship.',
  },
  'greece-peloponnese': {
    religious_mosque: 'No active mosque in Peloponnese region. Closest is in Athens (~1.5 hr east — Athens Mosque, opened 2020).',
    religious_synagogue: 'No active synagogue in Peloponnese. Closest is the Etz Hayyim Synagogue in Chania, Crete (boat or flight) or synagogues in Athens.',
  },

  // Italy
  'italy-abruzzo': {
    religious_mosque: 'No dedicated mosque in Abruzzo (rural region). Closest options are in Rome (~120 mi west — Grande Moschea di Roma is one of Europe\'s largest).',
    religious_synagogue: 'No synagogue in Abruzzo. Closest is the Great Synagogue of Rome (Tempio Maggiore, ~120 mi west).',
  },
  'italy-sardinia': {
    religious_mosque: 'No active mosque in Sardinia listed in major mosque directories. Small Muslim community in Cagliari.',
    religious_synagogue: 'No active synagogue in Sardinia — the historic Cagliari synagogue was forcibly converted to a church in the late 1400s and never re-established. The Ghetto degli Ebrei neighborhood preserves the historical Jewish heritage.',
  },

  // Ireland
  'ireland-cork': {
    religious_mosque: 'Small mosque presence in Cork (Cork Muslim Community). Cork is best searched via Google Maps for current active prayer locations.',
    religious_synagogue: 'Cork Hebrew Congregation (South Terrace Synagogue) closed in 2016 due to declining numbers. A new Munster Jewish Congregation (Reform) is emerging from the West Cork Jewish community but lacks a fixed building. Closest established synagogues are Dublin (Orthodox + Progressive) ~3 hr east.',
  },
  'ireland-galway': {
    religious_synagogue: 'No fixed synagogue in Galway — small emerging Reform community. Closest established are Dublin synagogues (~2.5 hr east).',
  },
  'ireland-limerick': {
    religious_synagogue: 'No active synagogue in Limerick. The historic community largely left after the 1904 Limerick Boycott. Recent Hebrew prayer events held at Istabraq City Hall but no fixed building. Closest established synagogues are in Dublin (~2.5 hr east).',
  },
  'ireland-waterford': {
    religious_mosque: 'No mosque in Waterford. Closest are in Cork (~1.5 hr west) or Dublin (~2.5 hr north).',
    religious_synagogue: 'No synagogue in Waterford. Closest are in Dublin (~2.5 hr north).',
  },
  'ireland-wexford': {
    religious_mosque: 'No mosque in Wexford. Closest are in Dublin (~2 hr north) or Cork (~3 hr west).',
    religious_synagogue: 'No synagogue in Wexford. Closest are in Dublin (~2 hr north).',
  },

  // Panama
  'panama-chitre': {
    religious_mosque: 'No mosque in Chitré. Closest is in Panama City (~3 hr northwest).',
    religious_synagogue: 'No synagogue in Chitré. Closest are Chabad and Sephardic synagogues in Panama City (~3 hr).',
  },
  'panama-coronado': {
    religious_mosque: 'No mosque in Coronado. Closest is in Panama City (~50 mi east).',
    religious_synagogue: 'No fixed synagogue in Coronado, though Panama Jewish community references Coronado as a satellite. Closest established are Chabad / Sephardic synagogues in Panama City (~50 mi east).',
  },
  'panama-david': {
    religious_mosque: 'No mosque in David. Closest is in Panama City (~5 hr drive east).',
    religious_synagogue: 'No fixed synagogue in David. Chabad Boquete (~30 mi north) is the closest active option for Hasidic services.',
  },
  'panama-el-valle': {
    religious_mosque: 'No mosque in El Valle de Antón. Closest is in Panama City (~75 mi east).',
    religious_synagogue: 'No synagogue in El Valle. Closest are in Panama City (~75 mi east).',
  },
  'panama-pedasi': {
    religious_mosque: 'No mosque in Pedasí. Closest is in Panama City (~4 hr northwest).',
    religious_synagogue: 'No synagogue in Pedasí. Closest are in Panama City (~4 hr northwest).',
  },
  'panama-puerto-armuelles': {
    religious_mosque: 'No mosque in Puerto Armuelles. Closest is in Panama City (~6+ hr drive).',
    religious_synagogue: 'No synagogue in Puerto Armuelles. Closest is Chabad Boquete (~70 mi northeast).',
  },
  'panama-volcan': {
    religious_mosque: 'No mosque in Volcán (mountain town in Chiriquí). Closest is in Panama City (~5-6 hr drive).',
  },

  // Portugal
  'portugal-silver-coast': {
    religious_mosque: 'No mosque on the Silver Coast itself. Closest is the Central Mosque of Lisbon (Rua da Mesquita, ~75 mi south — Europe\'s third-largest mosque outside Turkey).',
    religious_synagogue: 'No synagogue on the Silver Coast. Closest are Comunidade Israelita de Lisboa (Sinagoga Shaaré Tikvá) ~75 mi south.',
  },

  // Uruguay
  'uruguay-colonia': {
    religious_mosque: 'No mosque in Colonia del Sacramento. Closest is Centro Islámico del Uruguay in Montevideo (~110 mi east).',
    religious_synagogue: 'No synagogue in Colonia. Closest are Moksha + Taste of India\'s synagogues in Montevideo (~110 mi east).',
  },

  // US Pacific territories
  'us-pago-pago-as': {
    religious_mosque: 'No mosque in American Samoa. Closest options are in Apia, Samoa (independent country, separate immigration) or Honolulu (~2,600 mi northeast).',
    religious_synagogue: 'No synagogue in American Samoa. Closest options are in Honolulu (~2,600 mi northeast).',
  },
  'us-tafuna-as': {
    religious_mosque: 'No mosque in American Samoa. Closest is in Apia, Samoa (independent country) or Honolulu (~2,600 mi northeast).',
    religious_synagogue: 'No synagogue in American Samoa. Closest options are in Honolulu (~2,600 mi northeast).',
  },
  'us-dededo-gu': {
    religious_synagogue: 'No synagogue in Guam (Jewish community ~50-100 individuals, no fixed building). Closest options are in Honolulu (~3,800 mi east) or Manila (~1,600 mi west).',
  },
  'us-hagatna-gu': {
    religious_synagogue: 'No synagogue in Guam (Jewish community ~50-100 individuals, no fixed building). Closest options are in Honolulu (~3,800 mi east) or Manila (~1,600 mi west).',
  },
  'us-saipan-mp': {
    religious_synagogue: 'No synagogue in CNMI. Closest options are in Honolulu (~3,800 mi east), Manila (~1,500 mi west), or Tokyo (~1,600 mi north).',
  },
  'us-tinian-mp': {
    religious_synagogue: 'No synagogue in CNMI. Closest options are in Honolulu (~3,800 mi east), Manila (~1,500 mi west), or Tokyo (~1,600 mi north).',
  },

  // US Mainland small towns
  'us-armstrong-county-pa': {
    religious_mosque: 'No mosque in Armstrong County (rural western PA). Closest are mosques in Pittsburgh (~30-50 mi southwest — Islamic Center of Pittsburgh).',
    religious_synagogue: 'No synagogue in Armstrong County. Closest are synagogues in Pittsburgh (~30-50 mi southwest — multiple, including Tree of Life Or L\'Simcha and Beth Shalom).',
  },
  'us-skowhegan-me': {
    religious_mosque: 'No mosque in Skowhegan or Somerset County. Closest is Islamic Society of Portland Maine (~1.5 hr south) or Bangor Islamic Center (~2 hr east).',
  },
  'us-summerville_extra': {
    // Placeholder key — actual us-summerville handled below via merge
  },
};

// Merge additional no-match notes into existing locIds where present.
// (Done outside the literal to avoid duplicate-key footguns.)
function mergeNoMatch(locId, additions) {
  NO_MATCH_NOTES[locId] = { ...(NO_MATCH_NOTES[locId] ?? {}), ...additions };
}
mergeNoMatch('us-summerville', {
  religious_mosque: 'No dedicated mosque in Summerville. Closest options are Central Mosque of Charleston (~25-30 mi southeast) or Masjid Al-Fajr (Charleston).',
});
mergeNoMatch('mexico-queretaro', {
  religious_synagogue: 'No synagogue in Querétaro. Closest options are in Mexico City (~3 hr southeast) — multiple synagogues including Sinagoga Justo Sierra and Beth Israel Community Center.',
});
mergeNoMatch('panama-volcan', {
  religious_synagogue: 'No synagogue in Volcán. Closest is Chabad Boquete (~15 mi south).',
});
mergeNoMatch('uruguay-punta-del-este', {
  religious_mosque: 'No mosque in Punta del Este. Closest is Centro Islámico del Uruguay in Montevideo (~85 mi west).',
});
mergeNoMatch('ireland-cork', {
  religious_mosque: 'Small Muslim community in Cork (Cork Muslim Community / Munster Mosque on Wellington Road). For current active prayer locations, Google Maps search is most reliable.',
});

// ─── Apply ─────────────────────────────────────────────────────────────

let curated = 0;
let updatedNoMatch = 0;
let alreadyCurated = 0;
let notFound = 0;

function buildSourceForReal(name, url) {
  return {
    title: `${name} — directory page`,
    url,
    accessed: ACCESSED,
  };
}

function applyToServices(services, locId, map, isNoMatch) {
  let dirty = false;
  for (let i = 0; i < services.length; i++) {
    const entry = services[i];
    const cid = entry?.categoryId;
    if (!cid || !(cid in map)) continue;
    const isPlaceholder = typeof entry?.name === 'string'
      && entry.name.toLowerCase().includes('(search)');
    if (!isPlaceholder) {
      alreadyCurated++;
      console.log(`-    ${locId}.${cid}: already curated — "${entry.name}"`);
      continue;
    }

    if (isNoMatch) {
      if (entry.notes === map[cid]) {
        alreadyCurated++;
        console.log(`-    ${locId}.${cid}: no-match notes already current`);
        continue;
      }
      entry.notes = map[cid];
      dirty = true;
      updatedNoMatch++;
      console.log(`OK   ${locId}.${cid}: no-match notes updated`);
    } else {
      const pick = map[cid];
      services[i] = {
        categoryId: cid,
        name: pick.name,
        distanceMi: entry.distanceMi ?? 30,
        notes: pick.notes,
        sources: [buildSourceForReal(pick.name, pick.url)],
      };
      dirty = true;
      curated++;
      console.log(`OK   ${locId}.${cid}: curated -> "${pick.name}"`);
    }
  }
  return dirty;
}

for (const [locId, byCat] of Object.entries(CURATIONS)) {
  if (Object.keys(byCat).length === 0) continue;
  const path = join(DATA_DIR, locId, 'services.json');
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch { notFound++; console.warn(`MISS ${locId}: services.json not readable`); continue; }
  const data = JSON.parse(raw);
  const services = data?.services;
  if (!Array.isArray(services)) { notFound++; console.warn(`MISS ${locId}`); continue; }
  const dirty = applyToServices(services, locId, byCat, false);
  if (dirty) {
    const trail = raw.endsWith('\n') ? '\n' : '';
    writeFileSync(path, JSON.stringify(data, null, 2) + trail);
  }
}

for (const [locId, byCat] of Object.entries(NO_MATCH_NOTES)) {
  if (Object.keys(byCat).length === 0) continue;
  const path = join(DATA_DIR, locId, 'services.json');
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch { notFound++; console.warn(`MISS ${locId}: services.json not readable`); continue; }
  const data = JSON.parse(raw);
  const services = data?.services;
  if (!Array.isArray(services)) { notFound++; console.warn(`MISS ${locId}`); continue; }
  const dirty = applyToServices(services, locId, byCat, true);
  if (dirty) {
    const trail = raw.endsWith('\n') ? '\n' : '';
    writeFileSync(path, JSON.stringify(data, null, 2) + trail);
  }
}

console.log(
  `\nDone. Curated ${curated}, no-match-notes-updated ${updatedNoMatch}, ` +
    `already-curated ${alreadyCurated}, not-found ${notFound}`,
);
