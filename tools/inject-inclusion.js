#!/usr/bin/env node
/**
 * inject-inclusion.js
 *
 * Generates inclusion.json for all locations missing it.
 * Uses country-specific templates with realistic assessments,
 * actual legal references, and balanced summaries.
 * Also syncs to packages/dashboard/public/data/locations/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data', 'locations');
const DASHBOARD_DIR = path.resolve(__dirname, '..', 'packages', 'dashboard', 'public', 'data', 'locations');

// ────────────────────────────────────────────────────────────────
// US state classification for score variation
// ────────────────────────────────────────────────────────────────

function getUSStateFromId(locId) {
  // Extract state abbreviation from location id like us-miami-fl, us-denver-co
  const parts = locId.split('-');
  const last = parts[parts.length - 1];
  // Two-letter state codes
  const states = ['al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
    'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny',
    'nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy'];
  if (states.includes(last)) return last.toUpperCase();
  // Some ids embed state in the name portion (e.g. us-armstrong-county-pa)
  for (const p of parts.slice(1)) {
    if (states.includes(p)) return p.toUpperCase();
  }
  return null;
}

// Southern / conservative-leaning states get slightly lower racial scores
const SOUTHERN_STATES = new Set(['AL','AR','FL','GA','KY','LA','MS','NC','SC','TN','TX','VA','WV']);
const PROGRESSIVE_STATES = new Set(['CA','CO','CT','HI','IL','MA','MD','ME','MN','NJ','NM','NY','OR','VT','WA','WI']);
const MIDWEST_STATES = new Set(['IA','IN','KS','MI','MO','NE','ND','OH','OK','SD','WY']);

function getUSScores(stateCode) {
  // Base US scores: racial/religious/countryOfOrigin/language
  // Adjust racial and countryOfOrigin based on state character
  if (PROGRESSIVE_STATES.has(stateCode)) {
    return { racial: 7, religious: 8, countryOfOrigin: 8, language: 9 };
  }
  if (SOUTHERN_STATES.has(stateCode)) {
    return { racial: 5, religious: 8, countryOfOrigin: 6, language: 9 };
  }
  // Midwest / other
  return { racial: 6, religious: 8, countryOfOrigin: 7, language: 9 };
}

// ────────────────────────────────────────────────────────────────
// Country templates
// ────────────────────────────────────────────────────────────────

const COUNTRY_TEMPLATES = {
  'United States': (loc, locName, stateCode) => {
    const scores = getUSScores(stateCode);
    const isSouth = SOUTHERN_STATES.has(stateCode);
    const isProgressive = PROGRESSIVE_STATES.has(stateCode);
    const stateLabel = stateCode || 'unknown state';

    return {
      country: 'United States',
      region: loc.region || stateLabel,
      overallInclusionScore: computeOverall(scores),
      lastUpdated: '2026-03-24',
      categories: {
        racial: {
          score: scores.racial,
          summary: isSouth
            ? `${locName} is in the US South, where racial diversity is significant but historical legacies of segregation persist. Federal civil rights protections are strong, but local attitudes and policing practices vary. Urban areas tend to be more diverse and inclusive than surrounding rural communities.`
            : isProgressive
              ? `${locName} benefits from a progressive political environment with strong state-level civil rights protections beyond federal mandates. The area is generally diverse with active equity initiatives, though racial disparities in housing and wealth persist as in most US metro areas.`
              : `${locName} has moderate racial diversity with federal civil rights protections providing baseline guarantees. The area reflects broader Midwestern/national patterns — generally tolerant urban cores with less diversity in surrounding communities. Some documented disparities in policing and housing access.`,
          legalProtections: 'Federal Civil Rights Act of 1964, Fair Housing Act of 1968, Equal Employment Opportunity Commission (EEOC) enforcement, state civil rights statutes',
          positiveFactors: [
            'Strong federal anti-discrimination framework with active enforcement',
            `${isProgressive ? 'State-level protections exceed federal minimums' : 'Federal protections provide consistent baseline nationwide'}`,
            'Active civil rights organizations (NAACP, ACLU) with local chapters'
          ],
          riskFactors: [
            isSouth ? 'Historical legacies of segregation still visible in housing patterns and institutional practices' : 'Racial disparities in housing, wealth, and policing documented nationally',
            'Hate crime incidents reported annually to FBI UCR (likely underreported)',
            ...(isSouth ? ['Political polarization around race-related policy issues'] : [])
          ],
          sources: [
            { title: 'FBI Uniform Crime Report — Hate Crime Statistics', url: 'https://ucr.fbi.gov/hate-crime', type: 'official' },
            { title: 'US Commission on Civil Rights', url: 'https://www.usccr.gov/', type: 'official' }
          ]
        },
        religious: {
          score: scores.religious,
          summary: `Religious freedom is strongly protected by the First Amendment in ${locName}. The US has extraordinary religious diversity, with houses of worship for virtually every major faith tradition available in metro areas. Social attitudes toward non-Christian faiths vary by community, but legal protections are robust and well-enforced.`,
          legalProtections: 'First Amendment to the US Constitution, Religious Freedom Restoration Act (1993), Civil Rights Act Title VII (employment), state-level religious freedom statutes',
          positiveFactors: [
            'First Amendment provides among the strongest religious freedom protections globally',
            'Diverse religious communities with houses of worship for all major faiths in metro areas',
            'Federal hate crime laws include religious motivation as an aggravating factor'
          ],
          riskFactors: [
            'Antisemitic and anti-Muslim incidents have increased nationally per FBI data',
            'Rural/suburban areas may have limited non-Christian worship options'
          ],
          sources: [
            { title: 'US State Department — International Religious Freedom Report', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/', type: 'official' },
            { title: 'FBI Hate Crime Statistics — Anti-Religious', url: 'https://ucr.fbi.gov/hate-crime', type: 'official' }
          ]
        },
        countryOfOrigin: {
          score: scores.countryOfOrigin,
          summary: `As a US citizen relocating domestically, there are no legal barriers to settling in ${locName}. The area ${isSouth ? 'has growing immigrant communities but political rhetoric around immigration can be heated' : 'is generally welcoming to newcomers, with established communities of domestic transplants and international immigrants'}. Newcomer integration depends largely on local community character.`,
          legalProtections: 'Federal anti-discrimination protections, no internal migration restrictions for US citizens, state civil rights acts',
          positiveFactors: [
            'No immigration barriers for domestic relocation — full rights as US citizen',
            `${isProgressive ? 'Strong sanctuary/welcoming city policies in many jurisdictions' : 'Established communities of transplants and newcomers'}`,
            'Federal protections against national-origin discrimination in housing and employment'
          ],
          riskFactors: [
            isSouth ? 'Political polarization around immigration may create unwelcoming atmosphere for visibly foreign-born residents' : 'Some communities can be insular toward newcomers regardless of origin',
            'Political rhetoric around immigration policy is nationally polarizing'
          ],
          sources: [
            { title: 'US Census Bureau — Migration Flows', url: 'https://www.census.gov/topics/population/migration.html', type: 'official' },
            { title: 'Migration Policy Institute — State Immigration Data', url: 'https://www.migrationpolicy.org/programs/data-hub', type: 'research' }
          ]
        },
        language: {
          score: scores.language,
          summary: `English is the dominant language in ${locName}, and all government services, healthcare, and daily life operate in English. For English-speaking retirees, there is effectively zero language barrier. Multilingual services are increasingly available in diverse metro areas.`,
          legalProtections: 'Federal Executive Order 13166 requires meaningful access to government services for limited-English speakers. No federal official-English law, though some states have adopted English as official language.',
          positiveFactors: [
            'English is the primary language — no language barrier for English speakers',
            'All government services, healthcare, and legal proceedings available in English',
            'Rich media, cultural, and social landscape fully accessible in English'
          ],
          riskFactors: [
            'No meaningful language risks for English-speaking retirees'
          ],
          sources: [
            { title: 'US Census Bureau — Language Spoken at Home', url: 'https://data.census.gov/table/S1601', type: 'official' }
          ]
        }
      }
    };
  },

  France: (loc, locName) => ({
    country: 'France',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 6, religious: 6, countryOfOrigin: 6, language: 5 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 6,
        summary: `France has strong anti-discrimination laws enforced by the Defenseur des droits, but documented challenges persist with racial profiling and housing discrimination. ${locName} reflects broader French patterns — legal protections are robust but social attitudes vary, particularly outside major cities. ECRI reports have flagged France for ethnic profiling by police.`,
        legalProtections: 'EU Race Equality Directive 2000/43/EC, French Law 2008-496 prohibiting discrimination, Defenseur des droits enforcement body, French Constitution equality provisions',
        positiveFactors: [
          'Strong legal framework with active enforcement body (Defenseur des droits)',
          'EU-level anti-discrimination directives provide additional protections',
          'France collects discrimination complaint data for accountability'
        ],
        riskFactors: [
          'Police racial profiling documented by ECRI in 2022 and 2025 reports',
          'Housing discrimination in rental market — testing shows significant callback gaps',
          'France does not collect ethnic census data, making systemic issues harder to track'
        ],
        sources: [
          { title: 'ECRI Report on France (6th cycle)', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/france', type: 'official' },
          { title: 'Defenseur des droits Annual Report', url: 'https://www.defenseurdesdroits.fr/en', type: 'official' }
        ]
      },
      religious: {
        score: 6,
        summary: `France's strict laicite (secularism) policy can feel restrictive to visibly religious individuals. Laws banning conspicuous religious symbols in schools and face coverings affect daily life. ${locName} is historically Catholic but largely secular today. Antisemitic and anti-Muslim incidents are tracked nationally.`,
        legalProtections: '1905 Separation of Church and State law, religious discrimination prohibited under Penal Code Article 225-1, EU Framework Decision on racism and xenophobia',
        positiveFactors: [
          'Freedom of worship fully protected under law',
          'Government tracks and publishes religious hate crime statistics',
          'DILCRAH coordinates anti-hate efforts across agencies'
        ],
        riskFactors: [
          'Laicite restrictions on religious symbols in public institutions',
          'Rising antisemitic incidents reported by SPCJ',
          'Anti-Muslim sentiment in political discourse, particularly around elections'
        ],
        sources: [
          { title: 'US State Department — International Religious Freedom Report: France', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/france/', type: 'official' },
          { title: 'DILCRAH National Plan Against Racism', url: 'https://www.dilcrah.gouv.fr/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 6,
        summary: `Americans and Western European expats are generally well-received in ${locName}. France has a long immigration history with 10% foreign-born population. However, non-EU nationals face significant bureaucracy for residence permits and administrative processes are conducted exclusively in French.`,
        legalProtections: 'EU anti-discrimination directives, French labor code protections, long-stay visa holder rights under CESEDA immigration code',
        positiveFactors: [
          'Positive attitudes toward American culture and tourism',
          'Long tradition of immigration — 10% of population is foreign-born',
          'Strong consular support from US Embassy and regional consulates'
        ],
        riskFactors: [
          'Administrative bureaucracy for non-EU nationals is significant and French-only',
          'Political rhetoric around immigration has intensified across party lines',
          'Prefecture appointment system for residence permits is notoriously backlogged'
        ],
        sources: [
          { title: 'OECD International Migration Outlook — France', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' },
          { title: 'France Visas Official Portal', url: 'https://france-visas.gouv.fr/en/web/france-visas/', type: 'official' }
        ]
      },
      language: {
        score: 5,
        summary: `French language ability is strongly expected in daily life in ${locName}. Non-French speakers regularly encounter impatience or exclusion outside tourist areas. France ranks moderate on the EF English Proficiency Index. Learning conversational French is essentially required for meaningful integration.`,
        legalProtections: 'French is the sole official language (Article 2 of Constitution). Toubon Law (1994) mandates French in government, advertising, and workplace. No obligation to provide services in other languages.',
        positiveFactors: [
          'Alliance Francaise and free OFII integration courses available',
          'Younger generation has significantly better English skills',
          'Tourist and university areas accommodate English speakers'
        ],
        riskFactors: [
          'Strong cultural expectation to speak French — seen as a matter of respect',
          'All government services, healthcare, and legal proceedings in French only',
          'Social isolation risk for non-French speakers in daily life'
        ],
        sources: [
          { title: 'Toubon Law (1994) — French Language Protection', url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000349929', type: 'official' },
          { title: 'EF English Proficiency Index — France', url: 'https://www.ef.com/wwen/epi/regions/europe/france/', type: 'index' }
        ]
      }
    }
  }),

  Spain: (loc, locName) => ({
    country: 'Spain',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 8, countryOfOrigin: 7, language: 5 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Spain is generally welcoming to foreigners, with large established expat communities in coastal and urban areas near ${locName}. Legal anti-discrimination protections are strong under both Spanish and EU law. However, discrimination against Roma and sub-Saharan African immigrants is documented by ECRI and Spanish ombudsman reports.`,
        legalProtections: 'Spanish Constitution Article 14 (equality), EU Race Equality Directive 2000/43/EC, Integral Law against Racism (proposed), Council for the Elimination of Racial/Ethnic Discrimination',
        positiveFactors: [
          'Large diverse expat communities normalize foreign presence in coastal areas',
          'Strong EU and national anti-discrimination legal framework',
          'Economic incentive to welcome foreign retirees who contribute to local economy'
        ],
        riskFactors: [
          'Documented discrimination against Roma population per ECRI reports',
          'Housing discrimination can affect non-Western immigrants',
          'Rural areas may be less accustomed to racial diversity'
        ],
        sources: [
          { title: 'ECRI Report on Spain', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/spain', type: 'official' },
          { title: 'Spanish Ombudsman (Defensor del Pueblo)', url: 'https://www.defensordelpueblo.es/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Spain guarantees religious freedom constitutionally and maintains formal cooperation agreements with Catholic, Protestant, Jewish, and Islamic communities. ${locName} is historically Catholic but increasingly secular. Non-Christian worship facilities are available in major cities and expat areas. Religious discrimination is rare for Western retirees.`,
        legalProtections: 'Spanish Constitution Articles 14 and 16 (religious freedom), Organic Law 7/1980 on Religious Freedom, cooperation agreements with multiple faiths, EU anti-discrimination directives',
        positiveFactors: [
          'Constitutional religious freedom with formal multi-faith cooperation agreements',
          'No restrictions on religious symbols or dress in public life',
          'Diverse worship options available in major cities and expat areas'
        ],
        riskFactors: [
          'Very rural areas may lack non-Catholic worship facilities',
          'Cultural Catholicism still strong in social norms and public holidays'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Spain', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/spain/', type: 'official' },
          { title: 'Fundacion Pluralismo y Convivencia', url: 'https://www.pluralismoyconvivencia.es/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Spain has a well-established infrastructure for foreign residents, particularly retirees. ${locName} benefits from significant expat communities from the UK, Northern Europe, and North America. The Non-Lucrative Visa and Golden Visa programs demonstrate institutional welcome. Bureaucratic processes can be slow but are navigable.`,
        legalProtections: 'EU anti-discrimination directives, Spanish Foreigners Law (Ley de Extranjeria), Non-Lucrative Visa provisions, NIE registration system',
        positiveFactors: [
          'Established visa programs specifically welcoming retirees and investors',
          'Large existing expat communities with support networks',
          'Economic incentive structure favors welcoming foreign residents'
        ],
        riskFactors: [
          'Spanish bureaucracy can be slow and sometimes requires Spanish-language documents',
          'Two-tier perception between Western and non-Western immigrants persists',
          'Housing market pressure in popular expat areas can create local resentment'
        ],
        sources: [
          { title: 'Spanish Ministry of Inclusion — Foreign Residents Data', url: 'https://extranjeros.inclusion.gob.es/', type: 'official' },
          { title: 'OECD International Migration Outlook — Spain', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 5,
        summary: `Spanish (Castilian) is the primary language in ${locName}, and English proficiency outside tourist areas and younger demographics is limited. Spain ranks moderate on the EF English Proficiency Index. Expat communities provide English-language social networks, but daily tasks — healthcare, banking, government — typically require Spanish or a translator.`,
        legalProtections: 'Spanish Constitution Article 3 establishes Castilian as official language. Regional languages (Catalan, Basque, Galician) have co-official status in their territories. No obligation to provide government services in English.',
        positiveFactors: [
          'Expat communities provide English-language social support',
          'Tourist infrastructure accommodates English in popular areas',
          'Spanish language courses widely available and affordable'
        ],
        riskFactors: [
          'Healthcare and emergency services primarily in Spanish',
          'Government bureaucracy and legal documents require Spanish',
          'Social integration difficult without conversational Spanish'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Spain', url: 'https://www.ef.com/wwen/epi/regions/europe/spain/', type: 'index' },
          { title: 'Instituto Cervantes', url: 'https://www.cervantes.es/', type: 'official' }
        ]
      }
    }
  }),

  Portugal: (loc, locName) => ({
    country: 'Portugal',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 8, religious: 8, countryOfOrigin: 8, language: 6 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 8,
        summary: `Portugal is widely regarded as one of Europe's most welcoming countries for racial diversity, with a long multicultural history rooted in its colonial past. ${locName} reflects Portugal's generally tolerant social attitudes. However, Afro-Portuguese communities face documented socioeconomic disparities, and the housing crisis has strained some attitudes toward foreigners.`,
        legalProtections: 'Portuguese Constitution Article 13 (equality), EU Race Equality Directive 2000/43/EC, Commission for Equality and Against Racial Discrimination (CICDR), Law 93/2017 on racial discrimination',
        positiveFactors: [
          'Long multicultural history with generally positive social attitudes toward diversity',
          'Active anti-discrimination body (CICDR) with complaint mechanism',
          'Growing international community normalizes diversity in urban/tourism areas'
        ],
        riskFactors: [
          'Afro-Portuguese communities face documented socioeconomic disparities',
          'Housing crisis in Lisbon/Porto creating some anti-foreigner sentiment'
        ],
        sources: [
          { title: 'ECRI Report on Portugal', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/portugal', type: 'official' },
          { title: 'Portuguese CICDR — Commission for Equality', url: 'https://www.cicdr.pt/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Portugal guarantees religious freedom constitutionally and has a strong tradition of religious tolerance. ${locName} is historically Catholic but increasingly secular and pluralistic. The 2001 Religious Freedom Act establishes cooperation with multiple faiths. Anti-religious incidents are rare.`,
        legalProtections: 'Portuguese Constitution Article 41 (freedom of conscience and religion), Religious Freedom Act 2001, EU anti-discrimination directives, concordat with Vatican (historical but non-exclusive)',
        positiveFactors: [
          'Constitutional religious freedom with multi-faith cooperation framework',
          'Very low incidence of religious hate crimes compared to other EU states',
          'Growing interfaith dialogue supported by government programs'
        ],
        riskFactors: [
          'Catholic cultural dominance in social customs and public holidays',
          'Limited non-Christian worship facilities outside major cities'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Portugal', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/portugal/', type: 'official' },
          { title: 'Portuguese Commission for Religious Freedom', url: 'https://www.clr.mj.pt/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 8,
        summary: `Portugal is exceptionally welcoming to foreign residents, with well-established visa programs (D7 Passive Income Visa, Golden Visa) and a strong bureaucratic infrastructure for immigrants. ${locName} has a growing international community. The former NHR tax regime attracted many foreign retirees, and the IFICI replacement continues to draw interest.`,
        legalProtections: 'Portuguese Foreigners Law, D7 Passive Income Visa, SEF/AIMA immigration services, EU anti-discrimination directives, strong consular support network',
        positiveFactors: [
          'Well-designed visa programs specifically targeting retirees and remote workers',
          'Government actively promotes Portugal as a relocation destination',
          'Large established expat community with extensive support networks'
        ],
        riskFactors: [
          'Housing crisis in popular areas has created some local resentment toward foreign buyers',
          'Bureaucratic processing times for residence permits can be long'
        ],
        sources: [
          { title: 'AIMA — Agency for Integration, Migration and Asylum', url: 'https://www.aima.gov.pt/', type: 'official' },
          { title: 'OECD International Migration Outlook — Portugal', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 6,
        summary: `Portugal has among the highest English proficiency rates in Southern Europe, ranked "high proficiency" on the EF EPI. ${locName} benefits from Portugal's strong English education system and tourism infrastructure. Many younger Portuguese speak excellent English, and expat-oriented services operate in English. However, government documents and rural interactions remain primarily in Portuguese.`,
        legalProtections: 'Portuguese is the official language. Government services primarily in Portuguese. No legal obligation to provide services in English, but growing multilingual support in practice.',
        positiveFactors: [
          'High English proficiency — EF EPI ranks Portugal among top in Southern Europe',
          'Tourism and expat infrastructure widely supports English',
          'Portuguese language is relatively accessible for English speakers to learn basics'
        ],
        riskFactors: [
          'Government documents, healthcare, and legal proceedings primarily in Portuguese',
          'Rural areas have lower English proficiency'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Portugal', url: 'https://www.ef.com/wwen/epi/regions/europe/portugal/', type: 'index' },
          { title: 'Portuguese Government Services Portal', url: 'https://eportugal.gov.pt/', type: 'official' }
        ]
      }
    }
  }),

  Italy: (loc, locName) => ({
    country: 'Italy',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 5, religious: 7, countryOfOrigin: 6, language: 4 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 5,
        summary: `Italy has experienced growing racial tensions, particularly in northern regions, with documented incidents targeting African and Roma communities. ${locName} reflects Italy's complex relationship with immigration — historically a country of emigration now adjusting to immigration. Legal protections exist but enforcement is uneven. The Mancino Law criminalizes racial discrimination but prosecutions are limited.`,
        legalProtections: 'Italian Constitution Article 3 (equality), Mancino Law 205/1993 (racial discrimination), EU Race Equality Directive 2000/43/EC, UNAR (National Office Against Racial Discrimination)',
        positiveFactors: [
          'Legal framework criminalizing racial discrimination exists under Mancino Law',
          'UNAR provides complaint mechanism and anti-discrimination initiatives',
          'Italian culture is generally warm and hospitable to visitors'
        ],
        riskFactors: [
          'Documented racial incidents targeting African and Roma communities per ECRI reports',
          'Political rhetoric from far-right parties has normalized anti-immigrant sentiment',
          'Housing discrimination against non-Italian tenants documented by NGOs'
        ],
        sources: [
          { title: 'ECRI Report on Italy', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/italy', type: 'official' },
          { title: 'UNAR — National Office Against Racial Discrimination', url: 'https://www.unar.it/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Italy guarantees religious freedom constitutionally and has a largely tolerant religious environment. ${locName} is historically Catholic but increasingly secular. The Vatican's presence gives Catholicism cultural prominence, but non-Catholic communities worship freely. Islamophobia is present in political discourse but generally not reflected in daily interactions.`,
        legalProtections: 'Italian Constitution Articles 8 and 19 (religious freedom), Concordat with Vatican (1984 revision), bilateral agreements with other faiths, EU anti-discrimination directives',
        positiveFactors: [
          'Constitutional religious freedom with formal agreements for multiple faiths',
          'Generally tolerant population with deep cultural respect for personal faith',
          'Growing diversity of worship options in urban areas'
        ],
        riskFactors: [
          'Anti-Muslim rhetoric in political discourse, particularly from far-right parties',
          'Limited mosque construction due to local opposition in some areas',
          'Catholic cultural hegemony in social norms and public institutions'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Italy', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/italy/', type: 'official' },
          { title: 'OSCE ODIHR Hate Crime Reporting — Italy', url: 'https://hatecrime.osce.org/italy', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 6,
        summary: `Italy welcomes American and Western European retirees warmly, with the Elective Residency Visa available for those with passive income. ${locName} has growing expat interest, particularly among retirees attracted by affordable real estate and quality of life. Italian bureaucracy is notoriously complex and almost entirely in Italian.`,
        legalProtections: 'Italian immigration law (Testo Unico), Elective Residency Visa provisions, EU free movement directives (for EU citizens), bilateral social security agreements',
        positiveFactors: [
          'Italians are genuinely warm and curious toward foreign residents',
          'Elective Residency Visa available for retirees with passive income',
          'Growing international community in popular retirement areas'
        ],
        riskFactors: [
          'Italian bureaucracy is extremely complex and conducted entirely in Italian',
          'Two-tier treatment between Western and non-Western immigrants',
          'Rising anti-immigration political rhetoric at national level'
        ],
        sources: [
          { title: 'Italian Ministry of Interior — Immigration Portal', url: 'https://www.interno.gov.it/', type: 'official' },
          { title: 'OECD International Migration Outlook — Italy', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 4,
        summary: `Italian is overwhelmingly dominant in ${locName}, and English proficiency is very limited outside major tourist areas and younger demographics. Italy ranks "moderate" on the EF English Proficiency Index, well below Northern Europe. Daily life — healthcare, banking, government, shopping — requires Italian or a translator. Learning Italian is not optional for meaningful integration.`,
        legalProtections: 'Italian is the official language per Constitution. No legal obligation to provide services in other languages. Regional languages (German in South Tyrol, French in Aosta Valley) have co-official status in specific regions.',
        positiveFactors: [
          'Tourist areas and international hotels accommodate English speakers',
          'Italian language courses widely available for foreigners',
          'Expat communities provide English-language social support'
        ],
        riskFactors: [
          'Healthcare and emergency services operate almost exclusively in Italian',
          'Government bureaucracy, contracts, and legal documents are Italian-only',
          'Social isolation is a significant risk for non-Italian speakers'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Italy', url: 'https://www.ef.com/wwen/epi/regions/europe/italy/', type: 'index' },
          { title: 'Italian Ministry of Education — Language Policy', url: 'https://www.miur.gov.it/', type: 'official' }
        ]
      }
    }
  }),

  Ireland: (loc, locName) => ({
    country: 'Ireland',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 8, countryOfOrigin: 7, language: 9 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Ireland has rapidly diversified in recent decades and ${locName} reflects this transformation. Irish society is generally welcoming, though growing pains from rapid immigration have emerged. The Irish Human Rights and Equality Commission (IHREC) monitors discrimination. Anti-immigrant protests have increased since 2023 but remain a minority viewpoint.`,
        legalProtections: 'Irish Constitution, Employment Equality Acts 1998-2015, Equal Status Acts 2000-2018, Irish Human Rights and Equality Commission Act 2014, EU Race Equality Directive',
        positiveFactors: [
          'Strong legal anti-discrimination framework enforced by IHREC',
          'Irish cultural tradition of hospitality ("Cead Mile Failte")',
          'Growing diversity normalized in urban and suburban areas'
        ],
        riskFactors: [
          'Anti-immigrant protests have increased since 2023, particularly around asylum accommodation',
          'Ireland remains predominantly white — visible minorities may attract attention in rural areas',
          'Traveller community discrimination highlights ongoing bias patterns'
        ],
        sources: [
          { title: 'ECRI Report on Ireland', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/ireland', type: 'official' },
          { title: 'Irish Human Rights and Equality Commission', url: 'https://www.ihrec.ie/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Ireland has undergone a dramatic secularization since the 2000s while maintaining strong constitutional religious freedom protections. ${locName} is historically Catholic but increasingly pluralistic. Non-Christian communities worship freely. The 2018 blasphemy referendum removed the constitutional prohibition, signaling growing social liberalism.`,
        legalProtections: 'Irish Constitution Article 44 (freedom of religion), Employment Equality Acts, Equal Status Acts, EU anti-discrimination directives',
        positiveFactors: [
          'Constitutional religious freedom with strong enforcement',
          'Rapid secularization has reduced cultural pressure to conform to Catholic norms',
          'Growing religious diversity in urban areas'
        ],
        riskFactors: [
          'Catholic institutional legacy still visible in education (majority of schools are Catholic-patronage)',
          'Limited non-Christian worship facilities outside Dublin and major cities'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Ireland', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/ireland/', type: 'official' },
          { title: 'IHREC — Religion and Belief', url: 'https://www.ihrec.ie/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Ireland is welcoming to American residents, with deep cultural and diaspora ties to the United States. ${locName} benefits from Ireland's long tradition of emigration — the Irish understand what it means to be an outsider abroad. However, the housing crisis has created some resentment toward foreign property buyers, and visa processes for non-EU nationals can be slow.`,
        legalProtections: 'Irish immigration law, Stamp 0 retirement visa provisions, EU anti-discrimination directives, bilateral social security agreements with US',
        positiveFactors: [
          'Deep cultural ties between Ireland and the United States (Irish-American diaspora)',
          'Irish people have a strong empathy for immigrants rooted in their own emigration history',
          'Well-established American community and cultural connections'
        ],
        riskFactors: [
          'Severe housing crisis creating resentment toward foreign buyers/investors',
          'Non-EU immigration pathways are limited — no dedicated retiree visa program',
          'Rising anti-immigration sentiment, particularly in political discourse since 2023'
        ],
        sources: [
          { title: 'Irish Naturalisation and Immigration Service', url: 'https://www.irishimmigration.ie/', type: 'official' },
          { title: 'OECD International Migration Outlook — Ireland', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 9,
        summary: `English is the primary language of daily life in ${locName}, making Ireland one of the easiest European destinations for English-speaking retirees. Irish (Gaeilge) is the first official language constitutionally but is spoken as a daily language only in Gaeltacht areas. All government services, healthcare, and commercial life operate fully in English.`,
        legalProtections: 'Irish and English are both official languages per Constitution. Official Languages Act 2003 governs Irish-language rights. All government services available in English.',
        positiveFactors: [
          'English is the primary language — zero language barrier for English speakers',
          'All government, healthcare, legal, and commercial services in English',
          'Rich English-language media, cultural, and social landscape'
        ],
        riskFactors: [
          'No meaningful language risks for English-speaking retirees'
        ],
        sources: [
          { title: 'Official Languages Act 2003', url: 'https://www.irishstatutebook.ie/eli/2003/act/32/', type: 'official' }
        ]
      }
    }
  }),

  Greece: (loc, locName) => ({
    country: 'Greece',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 5, religious: 7, countryOfOrigin: 5, language: 4 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 5,
        summary: `Greece has faced challenges with xenophobia, particularly during economic crisis and migration flows. ${locName} reflects a society that is generally warm to tourists but can be less welcoming to immigrants from certain backgrounds. The far-right Golden Dawn party was banned but xenophobic attitudes persist in segments of the population. ECRI reports note concerns about police treatment of minorities.`,
        legalProtections: 'Greek Constitution Article 5 (equality), Law 4443/2016 (anti-discrimination), EU Race Equality Directive 2000/43/EC, Greek Ombudsman, National Council Against Racism and Intolerance',
        positiveFactors: [
          'Greek hospitality tradition ("philoxenia") is culturally deep-rooted',
          'Golden Dawn party banned — political extremism officially rejected',
          'Growing awareness and legal infrastructure for anti-discrimination'
        ],
        riskFactors: [
          'Xenophobic attitudes toward migrants documented by ECRI and UNHCR',
          'Police treatment of minorities flagged in international reports',
          'Ethnically homogeneous society — visible minorities may attract attention'
        ],
        sources: [
          { title: 'ECRI Report on Greece', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/greece', type: 'official' },
          { title: 'Greek Ombudsman — Anti-Discrimination', url: 'https://www.synigoros.gr/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Greece has the Greek Orthodox Church as a constitutionally established religion, but religious freedom is guaranteed. ${locName} is predominantly Orthodox but non-Orthodox communities worship freely in practice. Relations between Orthodox establishment and other faiths are generally cordial but institutional favoritism exists.`,
        legalProtections: 'Greek Constitution Articles 3 and 13 (religious freedom), EU anti-discrimination directives, Law 4443/2016',
        positiveFactors: [
          'Constitutional guarantee of religious freedom despite established church',
          'Non-Orthodox communities worship freely in practice',
          'Greek society is generally tolerant of different personal beliefs'
        ],
        riskFactors: [
          'Greek Orthodox Church has constitutional privileged status affecting education and public life',
          'Mosque construction in Athens faced decades of political opposition (opened 2020)',
          'Proselytism technically restricted by law'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Greece', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/greece/', type: 'official' },
          { title: 'OSCE ODIHR Hate Crime Reporting — Greece', url: 'https://hatecrime.osce.org/greece', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 5,
        summary: `Greece welcomes American tourists warmly, and ${locName} has growing expat interest. However, the bureaucratic infrastructure for foreign residents is less developed than in Spain or Portugal. Greece offers no dedicated retiree visa, and residence permit processes are conducted in Greek. The economic crisis legacy means some resentment toward perceived wealthy foreigners.`,
        legalProtections: 'Greek immigration law, EU free movement directives (for EU citizens), bilateral agreements, Greek Ombudsman for complaints',
        positiveFactors: [
          'Strong cultural affinity with the US and appreciation for American visitors',
          'Golden Visa program for property investors (over 250K EUR)',
          'Growing expat community in popular retirement destinations'
        ],
        riskFactors: [
          'Bureaucracy is complex and conducted primarily in Greek',
          'No dedicated retiree visa — limited non-EU immigration pathways',
          'Economic frustration can manifest as resentment toward wealthy foreigners'
        ],
        sources: [
          { title: 'Greek Ministry of Migration and Asylum', url: 'https://migration.gov.gr/', type: 'official' },
          { title: 'OECD International Migration Outlook — Greece', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 4,
        summary: `Greek is the dominant language in ${locName}, and English proficiency is limited outside Athens, tourist areas, and younger demographics. Greece uses a non-Latin alphabet which adds an additional barrier. Daily tasks — healthcare, government services, banking — require Greek or a translator. Tourism areas accommodate English but integration requires Greek language skills.`,
        legalProtections: 'Greek is the official language. No legal obligation to provide services in other languages. Some tourism areas provide multilingual information.',
        positiveFactors: [
          'Tourist areas and younger generation often speak functional English',
          'Greek language courses available for foreigners in major cities',
          'Many expat communities provide English-language social support'
        ],
        riskFactors: [
          'Non-Latin alphabet creates additional barriers for daily navigation',
          'Healthcare and emergency services primarily in Greek',
          'Government bureaucracy operates exclusively in Greek'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Greece', url: 'https://www.ef.com/wwen/epi/regions/europe/greece/', type: 'index' },
          { title: 'Greek Ministry of Education — Language Policy', url: 'https://www.minedu.gov.gr/', type: 'official' }
        ]
      }
    }
  }),

  Croatia: (loc, locName) => ({
    country: 'Croatia',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 5, religious: 7, countryOfOrigin: 5, language: 4 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 5,
        summary: `Croatia is ethnically homogeneous (over 90% ethnic Croat) and ${locName} reflects this limited diversity. Western expats are generally welcomed warmly, but visible minorities may attract curiosity or occasional hostility. Discrimination against Serbs and Roma is documented by ECRI. The 1990s wars left ethnic tensions that persist in some communities.`,
        legalProtections: 'Croatian Constitution Article 14 (equality), Anti-Discrimination Act 2008, EU Race Equality Directive 2000/43/EC, Ombudswoman for Human Rights',
        positiveFactors: [
          'Anti-Discrimination Act provides legal framework since EU accession',
          'Croatian hospitality tradition is warm toward visitors and guests',
          'Growing tourism economy incentivizes welcoming attitudes'
        ],
        riskFactors: [
          'Ethnically homogeneous population — visible minorities stand out',
          'Discrimination against Serbian minority and Roma documented by ECRI',
          '1990s war legacy creates residual ethnic tensions in some areas'
        ],
        sources: [
          { title: 'ECRI Report on Croatia', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/croatia', type: 'official' },
          { title: 'Croatian Ombudswoman for Human Rights', url: 'https://www.ombudsman.hr/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Croatia guarantees religious freedom constitutionally and is predominantly Roman Catholic. ${locName} is culturally Catholic but generally tolerant of other faiths. Agreements exist with multiple religious communities. Interfaith relations are generally positive, though Catholic institutional influence is strong in education and public life.`,
        legalProtections: 'Croatian Constitution Article 40 (religious freedom), agreements with Holy See and other religious communities, Anti-Discrimination Act 2008, EU anti-discrimination directives',
        positiveFactors: [
          'Constitutional religious freedom with formal multi-faith agreements',
          'Generally tolerant social attitudes toward different personal beliefs',
          'Growing religious diversity in urban areas'
        ],
        riskFactors: [
          'Strong Catholic institutional influence in education and public life',
          'Limited non-Christian worship facilities outside Zagreb and major cities'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Croatia', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/croatia/', type: 'official' },
          { title: 'Croatian Commission for Relations with Religious Communities', url: 'https://www.telecom.hr/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 5,
        summary: `Croatia welcomes American tourists but its infrastructure for foreign residents is less developed than Western European destinations. ${locName} has limited expat support compared to Spain or Portugal. Since EU accession in 2013, the bureaucratic framework has improved but processes remain slow. Digital nomad visa introduced in 2021 shows growing openness.`,
        legalProtections: 'Croatian Foreigners Act, EU free movement (for EU citizens), bilateral agreements, digital nomad visa provisions',
        positiveFactors: [
          'Digital nomad visa (2021) signals institutional openness to foreign residents',
          'Genuine curiosity and warmth toward Americans',
          'EU membership provides strong legal framework'
        ],
        riskFactors: [
          'Limited expat infrastructure compared to established retirement destinations',
          'Bureaucracy conducted in Croatian with limited English support',
          'Small foreign resident community means fewer support networks'
        ],
        sources: [
          { title: 'Croatian Ministry of Interior — Foreigners', url: 'https://mup.gov.hr/', type: 'official' },
          { title: 'OECD International Migration Outlook — Croatia', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 4,
        summary: `Croatian is the dominant language in ${locName}, and English proficiency varies significantly. Younger Croatians in urban areas often speak good English, but older generations and rural communities have limited English. Healthcare, government services, and banking operate primarily in Croatian. Tourism areas on the coast are more English-friendly.`,
        legalProtections: 'Croatian is the official language per Constitution. No legal obligation for English-language services. Some tourism-oriented municipalities provide multilingual information.',
        positiveFactors: [
          'Younger generation has significantly better English proficiency',
          'Coastal tourism areas accommodate English speakers',
          'Croatian language courses available in major cities'
        ],
        riskFactors: [
          'Healthcare and emergency services primarily in Croatian',
          'Government documents and legal proceedings in Croatian only',
          'Social integration requires basic Croatian language skills'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Croatia', url: 'https://www.ef.com/wwen/epi/regions/europe/croatia/', type: 'index' },
          { title: 'Croatian Government Services', url: 'https://gov.hr/', type: 'official' }
        ]
      }
    }
  }),

  Cyprus: (loc, locName) => ({
    country: 'Cyprus',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 6, religious: 7, countryOfOrigin: 6, language: 6 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 6,
        summary: `Cyprus has a complex ethnic landscape shaped by its division between Greek and Turkish Cypriot communities. ${locName} (in the Republic of Cyprus) is predominantly Greek Cypriot. British colonial history and ongoing UK military presence mean English-speaking Westerners are well-accepted. However, discrimination against migrant workers from South/Southeast Asia has been documented.`,
        legalProtections: 'Cypriot Constitution (equality provisions), EU Race Equality Directive 2000/43/EC, Anti-Discrimination Commissioner (Equality Body), Law 42(I)/2004',
        positiveFactors: [
          'British colonial heritage means familiarity with English-speaking foreigners',
          'EU membership provides strong anti-discrimination framework',
          'Growing international community in coastal cities'
        ],
        riskFactors: [
          'Documented discrimination against migrant workers from South/Southeast Asia',
          'Greek-Turkish ethnic division shapes social attitudes toward "otherness"',
          'Small island mentality can make integration challenging for outsiders'
        ],
        sources: [
          { title: 'ECRI Report on Cyprus', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/cyprus', type: 'official' },
          { title: 'Cyprus Equality Body (Commissioner for Administration)', url: 'http://www.ombudsman.gov.cy/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `The Church of Cyprus (Greek Orthodox) has constitutional recognition but religious freedom is guaranteed. ${locName} is predominantly Orthodox but diverse religious communities worship freely. British colonial heritage means Anglican churches and other denominations are present. Muslim communities exist primarily in mixed areas.`,
        legalProtections: 'Cypriot Constitution Articles 18-19 (religious freedom), EU anti-discrimination directives, Anti-Discrimination Commissioner',
        positiveFactors: [
          'Constitutional religious freedom with established multi-faith presence',
          'British colonial legacy includes Anglican churches and multicultural heritage',
          'Generally tolerant social attitudes toward different faiths'
        ],
        riskFactors: [
          'Greek Orthodox Church has significant institutional and cultural influence',
          'Greek-Turkish division has a religious dimension (Orthodox vs. Muslim)'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Cyprus', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/cyprus/', type: 'official' },
          { title: 'OSCE ODIHR Hate Crime Reporting — Cyprus', url: 'https://hatecrime.osce.org/cyprus', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 6,
        summary: `Cyprus has established pathways for foreign residents, particularly from the UK (historically) and other EU countries. ${locName} has a notable British expat community. Non-EU nationals can apply for immigration permits with proof of income. Bureaucracy is moderate — slower than Northern Europe but more English-friendly than Southern European counterparts.`,
        legalProtections: 'Cypriot immigration law, EU free movement directives, Category F immigration permit for retirees, bilateral agreements',
        positiveFactors: [
          'Established British expat community provides familiar social infrastructure',
          'Category F permit available for non-EU retirees with proof of income',
          'English widely used in business and government compared to other Mediterranean countries'
        ],
        riskFactors: [
          'Small island bureaucracy can be slow and relationship-dependent',
          'Post-Brexit changes affecting British residents may signal future immigration shifts'
        ],
        sources: [
          { title: 'Cyprus Civil Registry and Migration Department', url: 'http://www.moi.gov.cy/crmd', type: 'official' },
          { title: 'OECD International Migration Outlook — Cyprus', url: 'https://www.oecd.org/en/publications/international-migration-outlook_1999124x.html', type: 'research' }
        ]
      },
      language: {
        score: 6,
        summary: `English is widely spoken in ${locName} due to British colonial history and ongoing tourism/expat presence. Cyprus has one of the highest English proficiency rates in the Mediterranean. Government services offer English support in many cases. Daily life is manageable in English, though Greek is dominant for official documents and rural areas.`,
        legalProtections: 'Greek and Turkish are official languages. English has no official status but is widely used in government, legal, and business contexts due to British colonial legacy.',
        positiveFactors: [
          'High English proficiency — British colonial heritage created bilingual culture',
          'Many government services available in English',
          'Business and tourism sectors operate extensively in English'
        ],
        riskFactors: [
          'Official documents and legal proceedings primarily in Greek',
          'Rural areas and older generation may have limited English'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Cyprus', url: 'https://www.ef.com/wwen/epi/', type: 'index' },
          { title: 'Cyprus Government Web Portal', url: 'https://www.gov.cy/', type: 'official' }
        ]
      }
    }
  }),

  Malta: (loc, locName) => ({
    country: 'Malta',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 7, countryOfOrigin: 7, language: 8 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Malta has a diverse maritime history as a crossroads between Europe, North Africa, and the Middle East. ${locName} reflects a society that is generally tolerant but has experienced growing pains from rapid immigration. The small island population means visible minorities are noticed but not typically treated with hostility. Some racial tensions toward sub-Saharan African migrants have been documented.`,
        legalProtections: 'Maltese Constitution Chapter IV (fundamental rights), EU Race Equality Directive 2000/43/EC, National Commission for the Promotion of Equality (NCPE), Equality Act 2015',
        positiveFactors: [
          'Diverse Mediterranean heritage with historical tolerance',
          'Strong EU anti-discrimination framework enforced by NCPE',
          'Growing international community in Sliema, St. Julian\'s, and Valletta'
        ],
        riskFactors: [
          'Small island population means minorities are very visible',
          'Some racial tension toward sub-Saharan African migrants documented by ECRI',
          'Rapid immigration has created social friction in some communities'
        ],
        sources: [
          { title: 'ECRI Report on Malta', url: 'https://www.coe.int/en/web/european-commission-against-racism-and-intolerance/malta', type: 'official' },
          { title: 'NCPE — National Commission for the Promotion of Equality', url: 'https://ncpe.gov.mt/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Malta is historically deeply Catholic with the Church playing a significant cultural role. ${locName} reflects this heritage, but religious freedom is constitutionally guaranteed. Non-Catholic communities worship freely. Social secularization has accelerated in recent years (divorce legalized 2011, same-sex civil unions 2014, same-sex marriage 2017).`,
        legalProtections: 'Maltese Constitution Articles 40-41 (religious freedom), Roman Catholic Church established but freedom of other faiths guaranteed, EU anti-discrimination directives',
        positiveFactors: [
          'Constitutional religious freedom despite Catholic establishment',
          'Rapid social liberalization demonstrates growing pluralism',
          'International community brings diverse faith traditions'
        ],
        riskFactors: [
          'Catholic Church has significant cultural and institutional influence',
          'Limited non-Catholic worship facilities on a small island'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Malta', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/malta/', type: 'official' },
          { title: 'OSCE ODIHR Hate Crime Reporting — Malta', url: 'https://hatecrime.osce.org/malta', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Malta actively courts foreign residents through programs like the Global Residence Programme and Malta Retirement Programme. ${locName} has a significant international community, particularly British and other European expats. The bilingual English-Maltese environment makes Malta unusually accessible for English speakers among Mediterranean destinations.`,
        legalProtections: 'Maltese immigration law, Global Residence Programme, Malta Retirement Programme, EU free movement directives, Identity Malta agency',
        positiveFactors: [
          'Specific visa/tax programs designed to attract retirees and foreign residents',
          'Strong British cultural influence means familiarity with English-speaking foreigners',
          'EU membership provides solid legal framework for foreign residents'
        ],
        riskFactors: [
          'Small island — expat communities can feel insular',
          'Rapid population growth from immigration creating housing pressure'
        ],
        sources: [
          { title: 'Identity Malta — Residency Programmes', url: 'https://identitymalta.com/', type: 'official' },
          { title: 'Malta Retirement Programme', url: 'https://residencymalta.gov.mt/', type: 'official' }
        ]
      },
      language: {
        score: 8,
        summary: `English is an official language of Malta alongside Maltese, making ${locName} one of the most accessible Mediterranean destinations for English speakers. Government services, healthcare, education, and business all operate in English. Nearly all Maltese speak English fluently — it is the primary language of higher education and business.`,
        legalProtections: 'Maltese and English are both official languages per Constitution. All legislation published in both languages. Government services available in English.',
        positiveFactors: [
          'English is an official language — all government services available in English',
          'Nearly universal English proficiency among the population',
          'Education system, media, and business operate extensively in English'
        ],
        riskFactors: [
          'Daily social conversation among Maltese is typically in Maltese',
          'Some government forms may default to Maltese first'
        ],
        sources: [
          { title: 'Constitution of Malta — Official Languages', url: 'https://legislation.mt/eli/const/eng', type: 'official' }
        ]
      }
    }
  }),

  Mexico: (loc, locName) => ({
    country: 'Mexico',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 7, countryOfOrigin: 7, language: 4 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Mexico is a multiracial society with a complex racial hierarchy (colorism). ${locName} reflects a culture that is generally welcoming to foreigners, particularly American retirees. Light-skinned foreigners may receive preferential treatment (reflecting internal colorism), while indigenous and Afro-Mexican communities face documented discrimination. For most American retirees, racial acceptance is not a significant concern.`,
        legalProtections: 'Mexican Constitution Article 1 (non-discrimination), Federal Law to Prevent and Eliminate Discrimination (2003), CONAPRED (National Council to Prevent Discrimination), anti-discrimination amendments 2011',
        positiveFactors: [
          'Mexican culture is genuinely curious and welcoming toward foreigners',
          'CONAPRED provides federal anti-discrimination enforcement',
          'Long tradition of receiving American retirees with positive attitudes'
        ],
        riskFactors: [
          'Colorism is deeply embedded — lighter skin correlates with social privilege',
          'Indigenous communities face documented systemic discrimination',
          'American retirees may benefit from racial privilege without realizing it'
        ],
        sources: [
          { title: 'CONAPRED — National Council to Prevent Discrimination', url: 'https://www.conapred.org.mx/', type: 'official' },
          { title: 'UN OHCHR — Mexico Country Report', url: 'https://www.ohchr.org/en/countries/mexico', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Mexico guarantees religious freedom constitutionally with strong secularism provisions (laicidad). ${locName} is predominantly Catholic but increasingly diverse. Evangelical/Protestant communities are growing rapidly. Non-Christian faiths are uncommon outside Mexico City but face no legal restrictions. Religious tolerance is generally high in daily life.`,
        legalProtections: 'Mexican Constitution Articles 24 and 130 (religious freedom and church-state separation), Law of Religious Associations and Public Worship, CONAPRED',
        positiveFactors: [
          'Strong constitutional secularism with genuine religious freedom',
          'Growing religious diversity across the country',
          'Mexican society is generally tolerant of different personal beliefs'
        ],
        riskFactors: [
          'Catholic cultural dominance in social customs and public holidays',
          'Non-Christian worship facilities very limited outside major cities'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Mexico', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/mexico/', type: 'official' },
          { title: 'Mexican Secretariat of Governance — Religious Affairs', url: 'https://www.gob.mx/segob', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Mexico has a long tradition of welcoming American retirees, with an estimated 1.5 million Americans living in Mexico. ${locName} benefits from established expat infrastructure. The Temporary and Permanent Resident visa programs are accessible. Mexican attitudes toward Americans are complex — generally positive on a personal level despite political tensions at the national level.`,
        legalProtections: 'Mexican Immigration Law, Temporary Resident visa (4 years), Permanent Resident visa, INAMI immigration authority, bilateral agreements with US',
        positiveFactors: [
          'Estimated 1.5 million Americans already living in Mexico — well-established expat infrastructure',
          'Accessible visa programs for retirees with proof of income',
          'Personal-level warmth toward Americans despite political complexity'
        ],
        riskFactors: [
          'US-Mexico political tensions occasionally create awkward social moments',
          'Security concerns vary significantly by region'
        ],
        sources: [
          { title: 'Mexican INAMI — Immigration Authority', url: 'https://www.gob.mx/inm', type: 'official' },
          { title: 'US Embassy Mexico — Citizen Services', url: 'https://mx.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 4,
        summary: `Spanish is overwhelmingly dominant in ${locName}, and English proficiency is very limited outside major tourist areas and luxury service sectors. Mexico ranks "very low" on the EF English Proficiency Index. Expat communities provide English-language social networks, but daily life — healthcare, banking, government, shopping — requires Spanish or a translator.`,
        legalProtections: 'Spanish is the de facto national language. 68 indigenous languages have official recognition. No obligation to provide government services in English.',
        positiveFactors: [
          'Expat communities in popular areas provide English-language support',
          'Tourist-oriented businesses often have English-speaking staff',
          'Spanish language courses widely available and affordable'
        ],
        riskFactors: [
          'Healthcare and emergency services primarily in Spanish',
          'Government bureaucracy, contracts, and legal documents in Spanish only',
          'Social isolation is a significant risk for non-Spanish speakers outside expat bubbles'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Mexico', url: 'https://www.ef.com/wwen/epi/regions/latin-america/mexico/', type: 'index' },
          { title: 'Instituto Nacional de Lenguas Indigenas', url: 'https://www.inali.gob.mx/', type: 'official' }
        ]
      }
    }
  }),

  Colombia: (loc, locName) => ({
    country: 'Colombia',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 7, countryOfOrigin: 7, language: 3 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Colombia is a multiracial society with significant mestizo, Afro-Colombian, and indigenous populations. ${locName} reflects a culture that is generally curious and welcoming toward foreigners. Like much of Latin America, colorism exists, but outright racial hostility toward American expats is rare. Afro-Colombian and indigenous communities face documented discrimination.`,
        legalProtections: 'Colombian Constitution Article 13 (equality), Law 1482/2011 (anti-discrimination and racism), Law 70/1993 (Afro-Colombian communities), Constitutional Court rulings on racial equality',
        positiveFactors: [
          'Colombian culture is genuinely warm and curious toward foreigners',
          'Constitutional framework with specific anti-racism legislation',
          'Multiracial society normalizes diversity in daily interactions'
        ],
        riskFactors: [
          'Colorism embedded in social hierarchies — lighter skin associated with higher status',
          'Afro-Colombian and indigenous communities face systemic socioeconomic disparities',
          'Security concerns vary by region and neighborhood'
        ],
        sources: [
          { title: 'UN OHCHR — Colombia Country Report', url: 'https://www.ohchr.org/en/countries/colombia', type: 'official' },
          { title: 'Colombian Constitutional Court — Equality Jurisprudence', url: 'https://www.corteconstitucional.gov.co/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Colombia guarantees religious freedom constitutionally and has moved from Catholic dominance to increasing religious diversity. ${locName} has growing evangelical and non-denominational Christian communities alongside Catholicism. Non-Christian faiths face no legal restrictions but have limited visibility outside Bogota.`,
        legalProtections: 'Colombian Constitution Articles 18-19 (freedom of conscience and religion), Law 133/1994 (religious freedom), concordat with Vatican (revised), agreements with non-Catholic communities',
        positiveFactors: [
          'Constitutional religious freedom with growing pluralism',
          'Colombian society is generally respectful of personal religious choices',
          'Growing religious diversity beyond Catholicism'
        ],
        riskFactors: [
          'Catholic cultural norms still dominant in social customs',
          'Non-Christian worship facilities limited outside major cities'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Colombia', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/colombia/', type: 'official' },
          { title: 'Colombian Ministry of Interior — Religious Affairs', url: 'https://www.mininterior.gov.co/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Colombia has a growing but still developing expat infrastructure. ${locName} is increasingly popular with American retirees and digital nomads. The 2022 digital nomad visa demonstrates institutional openness. Colombians are generally warm toward Americans, though stereotypes about US intervention history may surface occasionally.`,
        legalProtections: 'Colombian immigration law, Retirement Visa (Visa M), Digital Nomad Visa (2022), Migracion Colombia immigration authority',
        positiveFactors: [
          'Growing expat infrastructure with accessible visa programs',
          'Genuine curiosity and warmth toward American residents',
          'Lower cost of living attracts retirees with favorable economic reception'
        ],
        riskFactors: [
          'Expat infrastructure less developed than Mexico or Panama',
          'Some lingering stereotypes about US foreign policy in Colombia'
        ],
        sources: [
          { title: 'Migracion Colombia — Immigration Authority', url: 'https://www.migracioncolombia.gov.co/', type: 'official' },
          { title: 'US Embassy Colombia — Citizen Services', url: 'https://co.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 3,
        summary: `Spanish is overwhelmingly dominant in ${locName}, and English proficiency is minimal outside international business districts and upscale tourist services. Colombia ranks "very low" on the EF English Proficiency Index. Daily life requires Spanish for all practical purposes — healthcare, banking, shopping, and government services.`,
        legalProtections: 'Spanish is the official language. Indigenous languages have official status in their territories. No obligation to provide government services in English.',
        positiveFactors: [
          'Colombian Spanish is considered clear and relatively easy to learn',
          'Growing number of bilingual professionals in major cities',
          'Spanish language schools catering to foreigners in Medellin and Bogota'
        ],
        riskFactors: [
          'Very limited English proficiency — EF EPI ranks Colombia among lowest in Latin America',
          'Healthcare emergencies without Spanish can be dangerous',
          'Government and legal processes exclusively in Spanish'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Colombia', url: 'https://www.ef.com/wwen/epi/regions/latin-america/colombia/', type: 'index' },
          { title: 'Colombian Ministry of Education — Bilingualism Program', url: 'https://www.mineducacion.gov.co/', type: 'official' }
        ]
      }
    }
  }),

  'Costa Rica': (loc, locName) => ({
    country: 'Costa Rica',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 8, religious: 8, countryOfOrigin: 8, language: 5 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 8,
        summary: `Costa Rica is widely regarded as one of Latin America's most inclusive and stable societies. ${locName} benefits from a culture that values "pura vida" — a live-and-let-live philosophy. The country abolished its military in 1948 and has invested heavily in education and social programs. Some discrimination against Nicaraguan immigrants and Afro-Costa Ricans exists but is less severe than in neighboring countries.`,
        legalProtections: 'Costa Rican Constitution Article 33 (equality), Law Against Racial Discrimination 2015, anti-discrimination provisions in Labor Code, National Commission Against Racism (CONED)',
        positiveFactors: [
          'Strong "pura vida" culture promotes tolerance and acceptance',
          'Well-established American and European expat communities',
          'Government investment in education has created generally progressive social attitudes'
        ],
        riskFactors: [
          'Some discrimination against Nicaraguan immigrants documented by NGOs',
          'Afro-Costa Ricans in Limon province face socioeconomic disparities'
        ],
        sources: [
          { title: 'UN OHCHR — Costa Rica Country Report', url: 'https://www.ohchr.org/en/countries/costa-rica', type: 'official' },
          { title: 'Costa Rican Ombudsman (Defensoría de los Habitantes)', url: 'https://www.dhr.go.cr/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Costa Rica is constitutionally Catholic but practices broad religious tolerance. ${locName} has diverse worship options including Catholic, Protestant, Jewish, and non-denominational communities. The country's progressive social policies reflect a secular governance approach despite the official religion.`,
        legalProtections: 'Costa Rican Constitution Article 75 (Catholic as state religion but freedom of other faiths guaranteed), anti-discrimination provisions, Inter-American Human Rights system',
        positiveFactors: [
          'Broad religious tolerance despite official Catholic designation',
          'Diverse worship communities in expat areas',
          'Progressive social policies reflect secular governance in practice'
        ],
        riskFactors: [
          'Catholic Church has constitutional status and institutional influence',
          'Non-Christian worship options limited in rural areas'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Costa Rica', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/costa-rica/', type: 'official' },
          { title: 'Costa Rican Government Portal', url: 'https://www.gob.go.cr/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 8,
        summary: `Costa Rica is among the most expat-friendly countries in the Americas. ${locName} benefits from decades of American and European retirement migration. The Pensionado and Rentista visa programs are well-established and accessible. Costa Ricans ("Ticos") are generally positive toward foreign residents who contribute to the local economy.`,
        legalProtections: 'Costa Rican General Immigration Law, Pensionado visa program, Rentista visa program, DGME immigration authority',
        positiveFactors: [
          'Well-established Pensionado and Rentista visa programs for retirees',
          'Decades of positive experience with American and European expats',
          'Strong expat support infrastructure in popular areas'
        ],
        riskFactors: [
          'Rising cost of living in popular expat areas can create local resentment',
          'Bureaucratic processes can be slow — "Tico time" is real'
        ],
        sources: [
          { title: 'DGME — Costa Rica Immigration', url: 'https://www.migracion.go.cr/', type: 'official' },
          { title: 'US Embassy Costa Rica — Citizen Services', url: 'https://cr.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 5,
        summary: `Spanish is the dominant language in ${locName}, but Costa Rica has better English infrastructure than most Latin American countries due to decades of tourism and expat presence. EF EPI ranks Costa Rica as "moderate" for the region. Popular expat and tourist areas offer more English services, but healthcare and government operations require Spanish.`,
        legalProtections: 'Spanish is the official language per Constitution. English widely taught in schools but no obligation for government services in English.',
        positiveFactors: [
          'Higher English proficiency than most Latin American countries',
          'Tourist and expat areas provide English-language services',
          'English widely taught in schools — younger Costa Ricans often speak it'
        ],
        riskFactors: [
          'Healthcare and emergency services primarily in Spanish',
          'Government bureaucracy and legal documents in Spanish',
          'Outside tourist/expat areas, English is very limited'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Costa Rica', url: 'https://www.ef.com/wwen/epi/regions/latin-america/costa-rica/', type: 'index' },
          { title: 'Costa Rican Ministry of Education', url: 'https://www.mep.go.cr/', type: 'official' }
        ]
      }
    }
  }),

  Panama: (loc, locName) => ({
    country: 'Panama',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 8, religious: 8, countryOfOrigin: 8, language: 6 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 8,
        summary: `Panama is a genuinely multiracial society shaped by the Canal Zone's international workforce history. ${locName} reflects a diverse population of mestizo, Afro-Panamanian, indigenous, and international residents. Colorism exists within Panamanian society, but outright racial hostility toward foreign residents is rare. The country's cosmopolitan heritage from the Canal era creates a relatively tolerant environment.`,
        legalProtections: 'Panamanian Constitution Article 19 (non-discrimination), Law 16/2002 (anti-discrimination), Executive Decree 124/2005 implementing anti-discrimination measures, INAMU (National Women\'s Institute with anti-discrimination mandate)',
        positiveFactors: [
          'Genuinely multiracial society shaped by Canal Zone international heritage',
          'Dollar economy attracts diverse international community',
          'Long tradition of receiving American and other foreign residents'
        ],
        riskFactors: [
          'Colorism embedded in social hierarchies — lighter skin associated with privilege',
          'Indigenous communities (Guna, Embera, Ngabe-Bugle) face documented marginalization'
        ],
        sources: [
          { title: 'UN OHCHR — Panama Country Report', url: 'https://www.ohchr.org/en/countries/panama', type: 'official' },
          { title: 'Panamanian Ombudsman (Defensoría del Pueblo)', url: 'https://www.defensoria.gob.pa/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Panama guarantees religious freedom and has a historically tolerant multiethnic society. ${locName} is predominantly Catholic but increasingly diverse with Protestant, Jewish, Hindu, Muslim, Baha'i, and Buddhist communities. Panama City's diverse Canal Zone heritage created unusual religious pluralism for the region.`,
        legalProtections: 'Panamanian Constitution Article 35 (religious freedom), no state religion despite Catholic majority, anti-discrimination legislation',
        positiveFactors: [
          'Constitutional religious freedom with no established state religion',
          'Diverse religious communities reflecting Canal Zone international heritage',
          'Generally tolerant social attitudes toward different faiths'
        ],
        riskFactors: [
          'Catholic cultural dominance in social customs, particularly in rural areas',
          'Non-Christian worship facilities limited outside Panama City'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Panama', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/panama/', type: 'official' },
          { title: 'Panamanian Government Portal', url: 'https://www.gob.pa/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 8,
        summary: `Panama is arguably the most expat-friendly country in the Americas, with the Pensionado program offering one of the world's best retirement visa packages. ${locName} benefits from Panama's dollar economy, Canal Zone heritage, and explicit government strategy to attract foreign retirees. The "Friendly Nations" visa and investor options further demonstrate institutional welcome.`,
        legalProtections: 'Panamanian immigration law, Pensionado visa program (one of world\'s best), Friendly Nations visa, Servicio Nacional de Migracion',
        positiveFactors: [
          'Pensionado program offers extensive senior discounts and straightforward residency',
          'Dollar economy eliminates currency risk',
          'Canal Zone heritage means deep familiarity with American culture and business'
        ],
        riskFactors: [
          'Expat bubble risk — some foreign communities are disconnected from local life',
          'Rising costs in popular areas may reduce traditional cost advantage'
        ],
        sources: [
          { title: 'Panama Servicio Nacional de Migracion', url: 'https://www.migracion.gob.pa/', type: 'official' },
          { title: 'US Embassy Panama — Citizen Services', url: 'https://pa.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 6,
        summary: `Spanish is the official language of ${locName}, but Panama has higher English proficiency than most Latin American countries due to the Canal Zone heritage and American military presence history. In Panama City and tourist/expat areas, English is widely understood. Government services and healthcare operate primarily in Spanish, but finding bilingual providers is easier than elsewhere in the region.`,
        legalProtections: 'Spanish is the official language per Constitution. English has no official status but is widely used in business and Canal Zone-influenced areas.',
        positiveFactors: [
          'Canal Zone heritage created significant English-speaking population',
          'Bilingual professionals more available than in most Latin American countries',
          'Expat and tourism areas widely accommodate English speakers'
        ],
        riskFactors: [
          'Government documents and legal proceedings in Spanish',
          'Outside Panama City and expat areas, English drops off significantly'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Panama', url: 'https://www.ef.com/wwen/epi/regions/latin-america/panama/', type: 'index' },
          { title: 'Panama Government Portal', url: 'https://www.gob.pa/', type: 'official' }
        ]
      }
    }
  }),

  Ecuador: (loc, locName) => ({
    country: 'Ecuador',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 7, religious: 7, countryOfOrigin: 7, language: 3 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 7,
        summary: `Ecuador is a multiethnic society with significant mestizo, indigenous, Afro-Ecuadorian, and white populations. ${locName} reflects a culture that is generally welcoming to foreigners. Ecuador's 2008 constitution is one of the world's most progressive on indigenous rights and nature. However, indigenous and Afro-Ecuadorian communities face documented socioeconomic disparities.`,
        legalProtections: 'Ecuadorian Constitution 2008 (extensive equality and indigenous rights), Organic Law on Intercultural Education, CODENPE (Council for Indigenous Development), anti-discrimination provisions',
        positiveFactors: [
          'One of the world\'s most progressive constitutions on equality and indigenous rights',
          'Welcoming culture toward American and European retirees',
          'Multiethnic society normalizes diversity in daily interactions'
        ],
        riskFactors: [
          'Colorism and socioeconomic stratification along racial lines persist in practice',
          'Indigenous communities face systemic disparities despite constitutional protections'
        ],
        sources: [
          { title: 'UN OHCHR — Ecuador Country Report', url: 'https://www.ohchr.org/en/countries/ecuador', type: 'official' },
          { title: 'Ecuadorian Ombudsman (Defensoría del Pueblo)', url: 'https://www.dpe.gob.ec/', type: 'official' }
        ]
      },
      religious: {
        score: 7,
        summary: `Ecuador guarantees religious freedom constitutionally and has no state religion since the 2008 constitution. ${locName} is predominantly Catholic but increasingly diverse. Evangelical and indigenous spiritual practices coexist with Catholicism. Religious tolerance is generally high.`,
        legalProtections: 'Ecuadorian Constitution 2008 (secular state, freedom of conscience and religion), Law on Religious Freedom and Public Worship, anti-discrimination provisions',
        positiveFactors: [
          'Secular state with constitutional religious freedom since 2008',
          'Growing religious diversity with tolerance for different practices',
          'Indigenous spiritual traditions respected alongside Western religions'
        ],
        riskFactors: [
          'Catholic cultural dominance in social customs, particularly in rural areas',
          'Non-Christian worship facilities limited outside Quito and Guayaquil'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Ecuador', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/ecuador/', type: 'official' },
          { title: 'Ecuadorian Government Portal', url: 'https://www.gob.ec/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 7,
        summary: `Ecuador has been a popular retirement destination for Americans, particularly in Cuenca and along the coast. ${locName} benefits from established expat communities and accessible visa programs. Ecuador uses the US dollar as official currency, eliminating exchange rate risk. The Professional/Investor visa and Retirement visa are accessible with proof of pension income.`,
        legalProtections: 'Ecuadorian immigration law, Retirement visa (Jubilado), Professional visa, dollarized economy, bilateral agreements',
        positiveFactors: [
          'Dollar economy eliminates currency risk — unique in South America',
          'Established expat communities with support infrastructure in Cuenca and coastal areas',
          'Accessible retirement visa program with reasonable income requirements'
        ],
        riskFactors: [
          'Security concerns have increased in recent years, particularly in Guayaquil',
          'Political instability and occasional state of emergency declarations'
        ],
        sources: [
          { title: 'Ecuadorian Ministry of Foreign Affairs — Visas', url: 'https://www.cancilleria.gob.ec/', type: 'official' },
          { title: 'US Embassy Ecuador — Citizen Services', url: 'https://ec.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 3,
        summary: `Spanish is overwhelmingly dominant in ${locName}, and English proficiency is very limited. Ecuador ranks among the lowest in Latin America on the EF English Proficiency Index. Established expat communities in Cuenca provide English-language social support, but daily life — healthcare, banking, government — requires Spanish. Indigenous languages (Kichwa, Shuar) have official status in their territories.`,
        legalProtections: 'Spanish is the official language. Kichwa and Shuar are official languages for intercultural relations. No obligation for government services in English.',
        positiveFactors: [
          'Expat communities in Cuenca and popular areas provide English-language networks',
          'Spanish language courses available and affordable',
          'Ecuadorian Spanish is considered clear and relatively easy to learn'
        ],
        riskFactors: [
          'Very low English proficiency nationally — one of lowest in Latin America',
          'Healthcare emergencies without Spanish can be dangerous',
          'Government and legal processes exclusively in Spanish'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Ecuador', url: 'https://www.ef.com/wwen/epi/regions/latin-america/ecuador/', type: 'index' },
          { title: 'Ecuadorian Ministry of Education', url: 'https://educacion.gob.ec/', type: 'official' }
        ]
      }
    }
  }),

  Uruguay: (loc, locName) => ({
    country: 'Uruguay',
    region: locName,
    overallInclusionScore: computeOverall({ racial: 8, religious: 8, countryOfOrigin: 8, language: 4 }),
    lastUpdated: '2026-03-24',
    categories: {
      racial: {
        score: 8,
        summary: `Uruguay is widely regarded as one of South America's most progressive and inclusive societies. ${locName} reflects a culture with strong egalitarian traditions and advanced social legislation. The population is predominantly of European descent with a significant Afro-Uruguayan minority. While racial discrimination exists, it is less severe than in most neighboring countries.`,
        legalProtections: 'Uruguayan Constitution Article 8 (equality), Law 17,817/2004 (anti-discrimination), Law 19,122/2013 (affirmative action for Afro-Uruguayans), Commissioner for Racism and Xenophobia',
        positiveFactors: [
          'Strong egalitarian cultural tradition with progressive social legislation',
          'Affirmative action legislation for Afro-Uruguayan community since 2013',
          'Consistently ranked among most inclusive Latin American countries by international indices'
        ],
        riskFactors: [
          'Afro-Uruguayan community faces socioeconomic disparities despite legal protections',
          'Society is predominantly European-descent — visible minorities may attract attention in smaller cities'
        ],
        sources: [
          { title: 'UN OHCHR — Uruguay Country Report', url: 'https://www.ohchr.org/en/countries/uruguay', type: 'official' },
          { title: 'Uruguayan Commissioner for Racism and Xenophobia', url: 'https://www.gub.uy/', type: 'official' }
        ]
      },
      religious: {
        score: 8,
        summary: `Uruguay is the most secular country in Latin America, with formal church-state separation since 1917. ${locName} reflects a culture where religious identity is treated as a private matter. There is no state religion and religious institutions receive no public funding. Religious diversity is respected as a matter of course.`,
        legalProtections: 'Uruguayan Constitution Articles 5 and 40 (separation of church and state, religious freedom), anti-discrimination legislation',
        positiveFactors: [
          'Most secular country in Latin America — church-state separation since 1917',
          'Religious identity treated as a private matter with no social pressure',
          'No public funding for religious institutions — genuine neutrality'
        ],
        riskFactors: [
          'Strong secularity means religious expression may seem unusual to some locals',
          'Limited worship facilities for minority faiths outside Montevideo'
        ],
        sources: [
          { title: 'US State Department — Religious Freedom Report: Uruguay', url: 'https://www.state.gov/reports/2023-report-on-international-religious-freedom/uruguay/', type: 'official' },
          { title: 'Uruguayan Government Portal', url: 'https://www.gub.uy/', type: 'official' }
        ]
      },
      countryOfOrigin: {
        score: 8,
        summary: `Uruguay is welcoming to foreign residents with accessible residency programs. ${locName} benefits from Uruguay's tradition as a destination for immigrants from Europe and neighboring South American countries. The residency process is relatively straightforward compared to other Latin American nations. Uruguay's political stability and rule of law make it attractive for retirees.`,
        legalProtections: 'Uruguayan immigration law, residency permit programs, bilateral social security agreements, strong rule of law',
        positiveFactors: [
          'Long immigrant tradition creates welcoming social attitudes',
          'Relatively straightforward residency process compared to regional peers',
          'Political stability and strong rule of law provide security for foreign residents'
        ],
        riskFactors: [
          'Small expat community compared to Mexico, Panama, or Costa Rica — less English-language support',
          'Higher cost of living than some competing Latin American destinations'
        ],
        sources: [
          { title: 'Uruguayan Immigration Authority (DNM)', url: 'https://www.gub.uy/direccion-nacional-migracion/', type: 'official' },
          { title: 'US Embassy Uruguay — Citizen Services', url: 'https://uy.usembassy.gov/', type: 'official' }
        ]
      },
      language: {
        score: 4,
        summary: `Spanish is the overwhelmingly dominant language in ${locName}, with very limited English proficiency outside of international business and luxury tourism. Uruguay ranks "low" on the EF English Proficiency Index for the region. The expat community is smaller than in Mexico or Costa Rica, providing less English-language social infrastructure. Portuguese influence exists near the Brazilian border.`,
        legalProtections: 'Spanish is the official language. No obligation to provide government services in English.',
        positiveFactors: [
          'Uruguayan Spanish is clear with rioplatense accent similar to Argentine Spanish',
          'Growing English education in schools, particularly in Montevideo',
          'Small but supportive expat communities in popular areas'
        ],
        riskFactors: [
          'Very limited English proficiency nationally',
          'Healthcare and government services exclusively in Spanish',
          'Smaller expat community means less English-language infrastructure than competing destinations'
        ],
        sources: [
          { title: 'EF English Proficiency Index — Uruguay', url: 'https://www.ef.com/wwen/epi/regions/latin-america/uruguay/', type: 'index' },
          { title: 'Uruguayan Ministry of Education', url: 'https://www.gub.uy/ministerio-educacion-cultura/', type: 'official' }
        ]
      }
    }
  }),
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function computeOverall(scores) {
  const avg = (scores.racial + scores.religious + scores.countryOfOrigin + scores.language) / 4;
  return Math.round(avg * 2) / 2; // round to nearest 0.5
}

function getLocationName(loc) {
  // Extract a short name from the location name (before comma or dash)
  const name = loc.name || loc.id;
  // Remove country suffix after last comma
  const parts = name.split(',');
  return parts[0].trim();
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

let created = 0;
let skipped = 0;
let errors = 0;

for (const dirName of dirs) {
  const inclusionPath = path.join(DATA_DIR, dirName, 'inclusion.json');
  const locationPath = path.join(DATA_DIR, dirName, 'location.json');

  // Skip if already has inclusion data
  if (fs.existsSync(inclusionPath)) {
    skipped++;
    continue;
  }

  // Read location.json to get country and name
  if (!fs.existsSync(locationPath)) {
    console.error(`  SKIP ${dirName} — no location.json`);
    errors++;
    continue;
  }

  let loc;
  try {
    loc = JSON.parse(fs.readFileSync(locationPath, 'utf8'));
  } catch (e) {
    console.error(`  ERROR ${dirName} — invalid location.json: ${e.message}`);
    errors++;
    continue;
  }

  const country = loc.country;
  const locName = getLocationName(loc);
  const templateFn = COUNTRY_TEMPLATES[country];

  if (!templateFn) {
    console.error(`  SKIP ${dirName} — no template for country "${country}"`);
    errors++;
    continue;
  }

  // For US locations, extract state code for score variation
  const stateCode = country === 'United States' ? getUSStateFromId(dirName) : null;

  let data;
  try {
    data = templateFn(loc, locName, stateCode);
  } catch (e) {
    console.error(`  ERROR ${dirName} — template error: ${e.message}`);
    errors++;
    continue;
  }

  // Write to data/locations/
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(inclusionPath, json, 'utf8');

  // Sync to dashboard public
  const dashDir = path.join(DASHBOARD_DIR, dirName);
  if (fs.existsSync(dashDir)) {
    fs.writeFileSync(path.join(dashDir, 'inclusion.json'), json, 'utf8');
  }

  console.log(`  OK ${dirName} (${country}, score ${data.overallInclusionScore})`);
  created++;
}

console.log(`\nDone: ${created} created, ${skipped} skipped (existing), ${errors} errors`);
