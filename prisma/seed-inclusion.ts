/**
 * Seed script: generates inclusion/prejudice assessment data for all 118 new locations
 * and upserts into adminLocationSupplement with dataType = 'inclusion'.
 *
 * Usage:
 *   npx tsx prisma/seed-inclusion.ts              # Run
 *   npx tsx prisma/seed-inclusion.ts --dry-run    # Preview without writing
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  cities: string[];
  [key: string]: unknown;
}

interface InclusionCategory {
  score: number;
  summary: string;
  legalProtections: string;
  positiveFactors: string[];
  riskFactors: string[];
}

interface InclusionData {
  country: string;
  region: string;
  overallInclusionScore: number;
  lastUpdated: string;
  categories: {
    racial: InclusionCategory;
    religious: InclusionCategory;
    countryOfOrigin: InclusionCategory;
    language: InclusionCategory;
  };
  expat_experience: {
    communitySupport: string;
    integrationResources: string[];
    socialMediaSentiment: string;
  };
}

// ─── Deterministic seeded random ─────────────────────────────────────────────

function makeRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(h) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function vary(rng: () => number, base: number, range: number = 1): number {
  const delta = Math.round((rng() * 2 - 1) * range);
  return clamp(base + delta, 1, 10);
}

// ─── Country scoring profiles ────────────────────────────────────────────────

interface CountryProfile {
  overall: number;
  racial: number;
  religious: number;
  origin: number;
  language: number;
  group: string;
  racialSummary: string;
  racialLegal: string;
  racialPositive: string[];
  racialRisk: string[];
  religiousSummary: string;
  religiousLegal: string;
  religiousPositive: string[];
  religiousRisk: string[];
  originSummary: string;
  originLegal: string;
  originPositive: string[];
  originRisk: string[];
  languageSummary: string;
  languageLegal: string;
  languagePositive: string[];
  languageRisk: string[];
  expatCommunity: string;
  expatResources: string[];
  expatSentiment: string;
}

const countryProfiles: Record<string, CountryProfile> = {
  'United States': {
    overall: 7, racial: 7, religious: 8, origin: 8, language: 9,
    group: 'US',
    racialSummary: 'The US has strong anti-discrimination laws but racial disparities persist in housing, policing, and healthcare. Experience varies significantly by region and city, with urban areas generally more diverse and inclusive.',
    racialLegal: 'Federal Civil Rights Act of 1964, Fair Housing Act, Equal Employment Opportunity Commission (EEOC) enforcement. State-level human rights acts provide additional protections.',
    racialPositive: ['Strong federal civil rights framework with active enforcement', 'Increasing diversity in most metro areas', 'Active civil rights organizations and legal aid'],
    racialRisk: ['Racial disparities in policing and criminal justice documented nationally', 'Housing discrimination persists despite legal protections', 'Regional variation — rural areas less diverse and may be less welcoming'],
    religiousSummary: 'First Amendment provides robust religious freedom protections. Diverse religious communities exist in most cities. Antisemitic and anti-Muslim incidents are tracked and generally prosecuted.',
    religiousLegal: 'First Amendment to the US Constitution, Religious Freedom Restoration Act, state-level protections. Federal hate crime laws cover religion.',
    religiousPositive: ['Among the strongest religious freedom protections globally', 'Diverse faith communities in most metro areas', 'Active interfaith dialogue organizations'],
    religiousRisk: ['Rising antisemitic incidents nationally', 'Anti-Muslim sentiment in some communities', 'Strong Christian cultural default in Southern and rural areas'],
    originSummary: 'As a domestic move within the US, there are no immigration barriers. Most cities are welcoming to newcomers, especially metro areas with transient populations from military, tech, or government sectors.',
    originLegal: 'Federal anti-discrimination protections, no internal migration restrictions. Legal residents have full mobility rights.',
    originPositive: ['No immigration barriers for domestic relocation', 'Most metro areas have high newcomer populations', 'Strong newcomer infrastructure in growing cities'],
    originRisk: ['Some tight-knit rural communities can be slow to welcome outsiders', 'Political polarization around immigration policy at federal level'],
    languageSummary: 'English is the dominant language. All government, healthcare, and business services are available in English. Zero language barrier for English-speaking retirees.',
    languageLegal: 'No federal official language law, though English is de facto national language. Government services widely available in English and Spanish.',
    languagePositive: ['English is the primary language — no barrier', 'All government and healthcare services in English', 'Multilingual services increasing in diverse metro areas'],
    languageRisk: ['No meaningful language risks for English-speaking retirees'],
    expatCommunity: 'Not applicable in traditional expat sense — domestic relocation. Strong newcomer support through community organizations, senior centers, Meetup groups, and OLLI programs at local universities.',
    expatResources: ['Local senior centers and community organizations', 'Meetup.com groups for newcomers', 'OLLI (Osher Lifelong Learning Institute) at nearby universities', 'Public library programs and community events'],
    expatSentiment: 'Generally positive reception for retirees. Common themes: cost of living, healthcare access, and community engagement opportunities vary by location.',
  },
  Portugal: {
    overall: 7, racial: 7, religious: 8, origin: 7, language: 5,
    group: 'Southern EU',
    racialSummary: 'Portugal is generally welcoming to people of color, with a growing multicultural society. Lisbon and Porto have diverse populations. Rural areas are less diverse. Portugal has anti-discrimination laws aligned with EU directives.',
    racialLegal: 'Portuguese Constitution Article 13, EU Race Equality Directive 2000/43/EC, Commission for Equality and Against Racial Discrimination (CICDR) enforces complaints.',
    racialPositive: ['Generally warm and welcoming culture', 'Growing multicultural population in urban areas', 'EU-aligned anti-discrimination framework'],
    racialRisk: ['Housing discrimination in rental market documented by SOS Racismo', 'Rural areas significantly less diverse', 'Some institutional racism in policing reported'],
    religiousSummary: 'Portugal has strong religious freedom protections. Historically Catholic but increasingly secular. Non-Christian communities are small but growing in urban areas.',
    religiousLegal: 'Portuguese Constitution guarantees religious freedom. Religious Freedom Law (Lei da Liberdade Religiosa) 2001. EU anti-discrimination framework.',
    religiousPositive: ['Strong legal protections for religious freedom', 'Tolerant secular culture in urban areas', 'Growing interfaith communities'],
    religiousRisk: ['Catholic cultural default may make non-Christians feel excluded in rural areas', 'Small but present antisemitic sentiment'],
    originSummary: 'Portugal has a long tradition of welcoming foreign residents, especially through the D7 visa program. American and British retirees are common and well-received. Bureaucracy can be challenging but the culture is welcoming.',
    originLegal: 'EU anti-discrimination directives, Portuguese labor code, D7 visa framework provides clear legal status for foreign retirees.',
    originPositive: ['Well-established expat communities', 'D7 visa provides clear legal framework for retirees', 'Portuguese culture generally welcoming to foreigners'],
    originRisk: ['Bureaucratic processes can be slow and Portuguese-only', 'Growing concern about foreign property buyers driving up housing costs'],
    languageSummary: 'Portuguese is the official language and essential for daily life outside tourist areas. English proficiency is growing, especially among younger Portuguese, but government services and healthcare are in Portuguese.',
    languageLegal: 'Portuguese is the official language. No legal obligation to provide services in other languages, though tourist areas and hospitals in cities often have English speakers.',
    languagePositive: ['English increasingly spoken by younger generation', 'Tourist areas accommodate English speakers', 'Many expat services and communities operate in English'],
    languageRisk: ['Government services and healthcare primarily in Portuguese', 'Social isolation risk for non-Portuguese speakers', 'Learning conversational Portuguese strongly recommended'],
    expatCommunity: 'Well-established English-speaking expat communities, especially in Algarve, Lisbon, and Porto. Active online forums, InterNations chapters, and social groups.',
    expatResources: ['InterNations local chapters', 'Expat Facebook groups (country-specific)', 'SEF/AIMA immigration services', 'Alliance Française / British Council equivalent language schools'],
    expatSentiment: 'Overwhelmingly positive. Expats praise quality of life, safety, healthcare, and welcoming culture. Main complaints: bureaucracy, language barrier, and rising property costs.',
  },
  Spain: {
    overall: 7, racial: 7, religious: 8, origin: 7, language: 5,
    group: 'Southern EU',
    racialSummary: 'Spain is generally welcoming with strong anti-discrimination laws. Coastal areas with large expat communities are particularly tolerant. Some racial profiling concerns exist in major cities.',
    racialLegal: 'Spanish Constitution Article 14, EU Race Equality Directive, Council for the Elimination of Racial or Ethnic Discrimination enforces complaints.',
    racialPositive: ['Multicultural coastal communities well-established', 'Strong EU anti-discrimination framework', 'Generally warm and inclusive culture'],
    racialRisk: ['Documented cases of racial profiling in major cities', 'Rise in far-right political rhetoric', 'Housing discrimination in rental market reported by SOS Racismo'],
    religiousSummary: 'Spain has strong religious freedom protections despite Catholic cultural heritage. Increasingly secular society. Non-Christian communities are growing in urban areas.',
    religiousLegal: 'Spanish Constitution guarantees religious freedom. Organic Law on Religious Freedom 1980. Cooperation agreements with Protestant, Jewish, and Muslim federations.',
    religiousPositive: ['Constitutional guarantees of religious freedom', 'Increasingly secular and tolerant society', 'Official state agreements with non-Catholic religions'],
    religiousRisk: ['Catholic cultural default in rural and traditional areas', 'Some anti-Muslim sentiment linked to political discourse'],
    originSummary: 'Spain welcomes foreign retirees, especially in established expat communities along the Mediterranean coast and islands. Non-lucrative visa provides a clear framework for retirees.',
    originLegal: 'EU anti-discrimination directives, Spanish Foreigners Law (Ley de Extranjería), non-lucrative visa framework.',
    originPositive: ['Large, established expat communities', 'Non-lucrative visa provides clear legal status', 'Culture generally welcoming to foreign residents'],
    originRisk: ['Bureaucratic processes can be slow and Spanish-only', 'Growing tension about mass tourism and foreign property buyers in some areas'],
    languageSummary: 'Spanish is essential for daily life. Coastal expat areas have more English infrastructure, but government services and healthcare are in Spanish. Regional languages (Catalan, Basque, Galician) add complexity.',
    languageLegal: 'Castilian Spanish is the official language. Regional languages are co-official in their territories. No obligation to provide English services.',
    languagePositive: ['Expat areas have English-speaking services', 'Spanish is relatively accessible for English speakers to learn', 'Growing English proficiency among younger Spaniards'],
    languageRisk: ['Government and healthcare services in Spanish only', 'Regional language requirements in Catalonia, Basque Country', 'Social isolation risk without Spanish language skills'],
    expatCommunity: 'Very large, well-established expat communities along Mediterranean coast and islands. Active social clubs, English-language media, and support networks.',
    expatResources: ['Expat social clubs and associations', 'InterNations chapters', 'English-language newspapers (Sur in English, etc.)', 'Municipal foreigner registration offices (Padrón)'],
    expatSentiment: 'Highly positive. Expats praise climate, lifestyle, healthcare system, and social life. Main complaints: bureaucracy, language barrier, and property/tax complexity.',
  },
  France: {
    overall: 7, racial: 7, religious: 7, origin: 7, language: 5,
    group: 'Western EU',
    racialSummary: 'France has strong anti-discrimination laws but faces documented challenges with racial profiling and housing discrimination. Cities are diverse; rural areas less so. ECRI and EU FRA have flagged ongoing issues.',
    racialLegal: 'French Constitution, EU Race Equality Directive 2000/43/EC, Défenseur des droits enforces complaints, Law 2008-496 prohibits direct and indirect discrimination.',
    racialPositive: ['Strong legal framework with active enforcement body', 'Diverse urban populations', 'Active anti-discrimination ombudsman (Défenseur des droits)'],
    racialRisk: ['Police racial profiling documented by ECRI', 'Housing discrimination in rental market', 'France does not collect ethnic census data, making tracking difficult'],
    religiousSummary: 'France\'s strict laïcité (secularism) policy can feel exclusionary to visibly religious individuals. The 2004 religious symbols ban and 2010 face-covering ban affect daily life. Antisemitic and anti-Muslim incidents are tracked.',
    religiousLegal: '1905 Separation of Church and State law, religious discrimination prohibited under penal code, EU Framework Decision on racism and xenophobia.',
    religiousPositive: ['Freedom of worship fully protected', 'Diverse religious communities in cities', 'Government tracks hate crime statistics'],
    religiousRisk: ['Laïcité restrictions on religious symbols in public institutions', 'Rising antisemitic incidents', 'Anti-Muslim sentiment in political discourse'],
    originSummary: 'Americans and Western expats are generally well-received. France has a long immigration tradition. Bureaucratic hurdles for non-EU nationals are significant. Long-stay visa framework provides legal status.',
    originLegal: 'EU anti-discrimination directives, French labor code protections, CESEDA immigration code for long-stay visa holders.',
    originPositive: ['Positive attitudes toward American culture', 'Long tradition of immigration', 'Strong consular support from US Embassy'],
    originRisk: ['Administrative bureaucracy for non-EU nationals is significant and French-only', 'Political rhetoric around immigration has intensified', 'Prefecture appointment system is notoriously backlogged'],
    languageSummary: 'French language ability is strongly expected in daily life. Non-French speakers regularly encounter impatience outside tourist areas. Learning conversational French is essentially required for integration.',
    languageLegal: 'French is the sole official language (Article 2 of Constitution). Toubon Law (1994) mandates French in government and workplace. No obligation for English services.',
    languagePositive: ['Alliance Française and OFII integration courses available', 'Younger generation has better English skills', 'University areas more multilingual'],
    languageRisk: ['Strong cultural expectation to speak French', 'All government and healthcare in French only', 'Social isolation risk for non-French speakers', 'Medical emergencies without French can be dangerous'],
    expatCommunity: 'English-speaking expat groups in most French cities. InterNations chapters, American Women\'s Groups, and regional British associations active. Online forums well-established.',
    expatResources: ['OFII — free French courses for immigrants', 'Alliance Française — language courses', 'InterNations local chapters', 'English-speaking expat Facebook groups'],
    expatSentiment: 'Mixed but generally positive. Expats praise quality of life, healthcare, culture. Language barrier is the #1 challenge cited. Bureaucracy is a common frustration.',
  },
  Greece: {
    overall: 7, racial: 6, religious: 7, origin: 7, language: 5,
    group: 'Southern EU',
    racialSummary: 'Greece has a mixed record on racial inclusion. Large cities are becoming more diverse, but far-right movements have had significant support. Refugee crisis created tensions. Anti-discrimination laws exist but enforcement varies.',
    racialLegal: 'Greek Constitution, EU Race Equality Directive, National Council Against Racism and Intolerance, Law 4443/2016 on equal treatment.',
    racialPositive: ['Growing multicultural population in Athens and Thessaloniki', 'EU anti-discrimination framework', 'Dissolution of Golden Dawn party in 2020'],
    racialRisk: ['History of far-right political movements', 'Refugee crisis created social tensions', 'Documented instances of racially motivated violence'],
    religiousSummary: 'Greek Orthodox Christianity is deeply embedded in culture and state. Religious freedom is constitutional but the Orthodox Church holds a privileged position. Non-Christian minorities are small.',
    religiousLegal: 'Greek Constitution guarantees religious freedom but recognizes Greek Orthodoxy as the prevailing religion. EU anti-discrimination framework applies.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Secular lifestyle common in urban areas', 'Tourism-oriented communities are accepting'],
    religiousRisk: ['Orthodox Church holds privileged state position', 'Building permits for non-Orthodox places of worship historically difficult', 'Social pressure in smaller communities'],
    originSummary: 'Greece is welcoming to Western tourists and retirees. Established expat communities exist on islands and in Athens. Bureaucracy can be challenging but improving.',
    originLegal: 'EU anti-discrimination directives, Greek immigration law, residence permit framework for non-EU nationals.',
    originPositive: ['Tourism-oriented culture welcomes foreigners', 'Established expat communities on islands', 'Greeks generally hospitable to individuals'],
    originRisk: ['Bureaucratic processes notoriously slow', 'Growing anti-immigration sentiment linked to refugee crisis', 'Property purchase restrictions for non-EU nationals in some border areas'],
    languageSummary: 'Greek is the official language. English is widely spoken in tourist areas and among younger Greeks, but government services and healthcare are in Greek. The Greek alphabet adds complexity.',
    languageLegal: 'Greek is the sole official language. No obligation to provide services in English, though tourist areas widely accommodate English speakers.',
    languagePositive: ['English widely spoken in tourist areas and by younger generation', 'Greece ranks above average in EU for English proficiency', 'Greek alphabet can be learned quickly'],
    languageRisk: ['Government and healthcare services in Greek only', 'Non-tourist areas have limited English', 'Greek alphabet creates an additional learning barrier'],
    expatCommunity: 'Active expat communities especially on Crete, Corfu, and in Athens. English-language groups, social clubs, and online forums available.',
    expatResources: ['InterNations chapters in Athens and islands', 'Expat Facebook groups by region', 'KEP (Citizen Service Centers) for bureaucratic help', 'Language schools offering Greek courses'],
    expatSentiment: 'Generally positive. Expats praise the lifestyle, climate, low costs, and hospitality. Bureaucracy and language barrier are main challenges. Economic uncertainty sometimes mentioned.',
  },
  Italy: {
    overall: 7, racial: 6, religious: 8, origin: 7, language: 5,
    group: 'Southern EU',
    racialSummary: 'Italy has anti-discrimination laws but faces challenges with discrimination, particularly against Roma and African immigrants. Northern cities are more diverse; southern Italy is less so. Political rhetoric around immigration has intensified.',
    racialLegal: 'Italian Constitution, EU Race Equality Directive, UNAR (National Office Against Racial Discrimination), Mancino Law against racial violence.',
    racialPositive: ['Strong EU anti-discrimination legal framework', 'Growing multicultural communities in northern cities', 'Active anti-discrimination office (UNAR)'],
    racialRisk: ['Documented discrimination against Roma and African communities', 'Far-right political rhetoric around immigration', 'Housing discrimination reported by UNAR'],
    religiousSummary: 'Italy has strong Catholic cultural heritage but is increasingly secular. Religious freedom is protected. The Vatican\'s presence gives Catholicism cultural prominence but legal protections exist for all faiths.',
    religiousLegal: 'Italian Constitution guarantees religious freedom. Concordat with Vatican, and agreements (intese) with many non-Catholic faiths. EU anti-discrimination framework.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Increasingly secular urban populations', 'Formal agreements with multiple faith communities'],
    religiousRisk: ['Strong Catholic cultural default, especially in south', 'Limited mosque infrastructure in some areas', 'Social expectations around Catholic traditions'],
    originSummary: 'Italy welcomes foreign retirees, especially in areas with established expat communities. The elective residence visa provides a framework for retirees. Bureaucracy is notoriously challenging.',
    originLegal: 'EU anti-discrimination directives, Italian immigration law (Testo Unico), elective residence visa for retirees.',
    originPositive: ['Warm, hospitable culture', 'Established expat communities in Tuscany, Abruzzo, Puglia', 'Elective residence visa framework for retirees'],
    originRisk: ['Bureaucracy is extremely challenging and slow', 'Growing anti-immigration political rhetoric', 'Documentation requirements can be onerous'],
    languageSummary: 'Italian is essential for daily life. English proficiency is lower than in Northern Europe. Tourist areas and younger Italians speak some English, but government services and healthcare are Italian-only.',
    languageLegal: 'Italian is the sole official language. No legal obligation to provide English services. Regional minority languages protected but not relevant for expats.',
    languagePositive: ['Italian is relatively accessible for English speakers to learn', 'Tourist areas accommodate English to some degree', 'Expat communities provide English-language support'],
    languageRisk: ['Government and healthcare services in Italian only', 'Lower English proficiency than Northern European countries', 'Social isolation risk without Italian language skills', 'Regional dialects can complicate understanding'],
    expatCommunity: 'Well-established expat communities in Tuscany, Umbria, Abruzzo, and Puglia. Active online forums, social groups, and English-language resources.',
    expatResources: ['InterNations chapters', 'Expat Facebook groups by region', 'Italian language schools (often subsidized)', 'Questura immigration offices'],
    expatSentiment: 'Very positive about lifestyle, food, culture, and climate. Universal complaints about bureaucracy. Language barrier is significant. Healthcare quality praised but navigation in Italian required.',
  },
  Ireland: {
    overall: 8, racial: 7, religious: 8, origin: 8, language: 9,
    group: 'Western EU',
    racialSummary: 'Ireland has become significantly more diverse since the Celtic Tiger era. Anti-discrimination laws are strong. Dublin is notably diverse; rural areas less so. Racism exists but is generally not systemic.',
    racialLegal: 'Irish Human Rights and Equality Commission (IHREC), Employment Equality Acts, Equal Status Acts, EU Race Equality Directive. Hate crime legislation strengthened in 2024.',
    racialPositive: ['Strong anti-discrimination legal framework', 'Rapidly diversifying population', 'Active IHREC enforcement', 'Generally welcoming culture'],
    racialRisk: ['Direct provision system for asylum seekers controversial', 'Some anti-immigrant protests in 2023-2024', 'Housing crisis affects marginalized communities disproportionately'],
    religiousSummary: 'Ireland has rapidly secularized. While historically Catholic, religious freedom is protected and diverse faith communities exist in cities. Same-sex marriage passed by referendum in 2015.',
    religiousLegal: 'Irish Constitution guarantees religious freedom. Employment Equality Acts protect against religious discrimination. Blasphemy law removed by referendum in 2018.',
    religiousPositive: ['Strong constitutional protections', 'Rapid secularization and social liberalization', 'Diverse faith communities in cities'],
    religiousRisk: ['Catholic cultural heritage still strong in rural areas', 'School system heavily influenced by Catholic Church'],
    originSummary: 'Ireland is welcoming to English-speaking retirees. Strong cultural ties to the US (Irish diaspora). Well-established American community.',
    originLegal: 'EU anti-discrimination directives, Irish immigration law, stamp 0 visa for financially independent retirees.',
    originPositive: ['Strong cultural ties with the US', 'English-speaking — minimal cultural adjustment', 'Well-established American community'],
    originRisk: ['Housing crisis makes finding accommodation challenging', 'Cost of living has risen significantly'],
    languageSummary: 'English is the primary language of daily life. Irish (Gaeilge) is the first official language but rarely spoken outside Gaeltacht areas. No language barrier for English speakers.',
    languageLegal: 'Irish and English are both official languages. All government services available in English. Bilingual signage in many areas.',
    languagePositive: ['English is the primary spoken language', 'All government and healthcare services in English', 'No language barrier whatsoever for English speakers'],
    languageRisk: ['No meaningful language risks for English speakers'],
    expatCommunity: 'Large American community especially in Dublin, Galway, and Cork. Active social groups, professional networks, and cultural organizations.',
    expatResources: ['American Chamber of Commerce Ireland', 'InterNations Dublin/Cork chapters', 'Citizens Information Centres (free advisory service)', 'Active Meetup.com community'],
    expatSentiment: 'Very positive. Praised for friendliness, safety, English language, and quality of life. Main complaints: weather, cost of living, and housing availability.',
  },
  Croatia: {
    overall: 6, racial: 6, religious: 7, origin: 6, language: 5,
    group: 'Southern EU',
    racialSummary: 'Croatia is an ethnically homogeneous country. Racial diversity is limited. Anti-discrimination laws exist through EU membership but enforcement can be inconsistent. Tourists are generally well-received.',
    racialLegal: 'Croatian Constitution Article 14, EU Race Equality Directive, Ombudsman for Human Rights, Anti-Discrimination Act 2008.',
    racialPositive: ['EU anti-discrimination framework applies', 'Tourist-oriented coastal areas welcoming', 'Active ombudsman institution'],
    racialRisk: ['Ethnically homogeneous — visible minorities stand out', 'Historical ethnic tensions (post-Yugoslav war)', 'Documented discrimination against Roma and Serb minorities'],
    religiousSummary: 'Croatia is predominantly Catholic. Religious freedom is protected but Catholic Church has significant social influence. Non-Christian minorities are very small.',
    religiousLegal: 'Croatian Constitution guarantees religious freedom. Concordat with Vatican. EU anti-discrimination framework.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Secular lifestyle common in coastal tourism areas', 'EU protections apply'],
    religiousRisk: ['Strong Catholic cultural influence', 'Very small non-Christian communities', 'Conservative social attitudes in rural areas'],
    originSummary: 'Croatia welcomes foreign property buyers and retirees, especially in coastal areas. EU membership has improved legal frameworks. Bureaucracy can be slow.',
    originLegal: 'EU anti-discrimination directives, Croatian Foreigners Act, temporary stay permit for financially independent foreigners.',
    originPositive: ['Tourist-oriented culture welcomes foreigners', 'EU membership provides strong legal framework', 'Affordable cost of living attracts retirees'],
    originRisk: ['Bureaucratic processes can be slow', 'Property purchase rules for non-EU nationals can be complex', 'Limited English in government offices'],
    languageSummary: 'Croatian is the official language. English is widely spoken in tourist areas along the coast. Government services are in Croatian. Younger generation generally speaks English.',
    languageLegal: 'Croatian is the sole official language. No obligation to provide English services. Minority languages protected in some municipalities.',
    languagePositive: ['English widely spoken in coastal tourist areas', 'Younger generation has good English skills', 'Croatian uses Latin alphabet'],
    languageRisk: ['Government and healthcare services in Croatian only', 'Inland and rural areas have limited English', 'Social isolation risk without basic Croatian'],
    expatCommunity: 'Growing expat community, especially along Dalmatian coast and in Zagreb. Digital nomad visa has attracted younger expats. English-language social groups exist in main cities.',
    expatResources: ['Expat in Croatia Facebook groups', 'InterNations Zagreb chapter', 'MUP (Ministry of Interior) for residence permits', 'Croatian language courses at various institutions'],
    expatSentiment: 'Positive, especially about natural beauty, cost of living, and Mediterranean lifestyle. Bureaucracy and language barrier are main challenges. Winters can feel isolating in smaller towns.',
  },
  Cyprus: {
    overall: 7, racial: 6, religious: 7, origin: 7, language: 7,
    group: 'Southern EU',
    racialSummary: 'Cyprus has a complex demographic situation due to the island\'s division. Greek Cypriot south is generally welcoming to Western expats. Significant British expat community provides infrastructure.',
    racialLegal: 'Cyprus Constitution, EU Race Equality Directive, Ombudsman/Commissioner for Administration, Anti-Discrimination Body.',
    racialPositive: ['Large established British expat community', 'EU anti-discrimination framework', 'Tourism-oriented culture generally welcoming'],
    racialRisk: ['Complex ethnic dynamics (Greek-Turkish division)', 'Documented discrimination against migrant workers', 'Limited diversity outside cities'],
    religiousSummary: 'Greek Orthodox Christianity is the dominant religion. Religious freedom is protected. The Orthodox Church has significant cultural and political influence.',
    religiousLegal: 'Cyprus Constitution guarantees religious freedom. EU anti-discrimination framework applies.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Secular lifestyle in urban areas and expat communities', 'EU protections apply'],
    religiousRisk: ['Orthodox Church has significant cultural influence', 'Non-Christian communities are small', 'Religious politics intertwined with ethnic identity'],
    originSummary: 'Cyprus has a very large British expat community, especially in Paphos and Limassol. English-speaking retirees are common and well-received. EU membership provides legal framework.',
    originLegal: 'EU anti-discrimination directives, Cyprus immigration law, Category F residence permit for retirees.',
    originPositive: ['Very large established British/English-speaking expat community', 'English widely spoken', 'EU membership provides strong legal framework'],
    originRisk: ['Post-Brexit changes affecting British expats', 'Island divided — political complexity', 'Some anti-immigrant sentiment toward non-Western migrants'],
    languageSummary: 'Greek is the official language but English is very widely spoken due to British colonial history and large expat population. Government services are available in Greek but English is widely accommodated.',
    languageLegal: 'Greek and Turkish are official languages. English is not official but widely used in business, tourism, and daily life due to British colonial legacy.',
    languagePositive: ['English very widely spoken', 'British colonial legacy means English in daily commerce', 'Government offices often accommodate English speakers', 'English-language media and services abundant'],
    languageRisk: ['Official documents and legal proceedings in Greek', 'Rural areas may have less English', 'Northern Cyprus has different language dynamics'],
    expatCommunity: 'Very large and well-established English-speaking expat community, especially in Paphos. Numerous social clubs, associations, and English-language services.',
    expatResources: ['Cyprus Expat Association', 'InterNations Limassol/Paphos', 'English-language newspapers (Cyprus Mail)', 'Citizens Advice Cyprus'],
    expatSentiment: 'Very positive. Praised for climate, safety, English accessibility, and relaxed lifestyle. Main complaints: summer heat, driving standards, and bureaucracy.',
  },
  Malta: {
    overall: 7, racial: 6, religious: 7, origin: 7, language: 8,
    group: 'Southern EU',
    racialSummary: 'Malta is a small, relatively homogeneous island nation. Growing diversity through immigration. Anti-discrimination laws exist through EU membership. Visible minorities may attract attention but tourism culture helps.',
    racialLegal: 'Malta Constitution, EU Race Equality Directive, National Commission for the Promotion of Equality (NCPE).',
    racialPositive: ['EU anti-discrimination framework', 'Tourism-oriented culture', 'Growing international community', 'Active equality commission'],
    racialRisk: ['Small homogeneous society — visible minorities stand out', 'Anti-immigrant sentiment regarding African boat migrants', 'Documented discrimination in rental market'],
    religiousSummary: 'Malta is heavily Catholic. Religious freedom is protected but Catholicism permeates culture. Non-Catholic communities are very small. Recent social liberalization (divorce, same-sex unions).',
    religiousLegal: 'Malta Constitution guarantees religious freedom while recognizing Catholic Church. EU anti-discrimination framework.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Recent social liberalization trend', 'EU protections apply'],
    religiousRisk: ['Strong Catholic cultural dominance', 'Very small non-Catholic communities', 'Catholic Church influence in politics and education'],
    originSummary: 'Malta welcomes foreign retirees with specific residence programs. Large British expat community. English is an official language, making integration easier.',
    originLegal: 'EU anti-discrimination directives, Malta residence permits, Retirement Programme for non-EU nationals.',
    originPositive: ['English as official language eases integration', 'Established British expat community', 'Specific retirement residence programs'],
    originRisk: ['Small island — limited space and growing population tension', 'Property costs rising due to foreign demand', 'Tiny island can feel claustrophobic'],
    languageSummary: 'Maltese and English are both official languages. English is widely spoken in business, government, and daily life. Most Maltese are bilingual. Minimal language barrier for English speakers.',
    languageLegal: 'Maltese and English are both official languages. Government services available in both. Education system bilingual.',
    languagePositive: ['English is an official language', 'Most Maltese speak fluent English', 'Government services available in English', 'English-language media abundant'],
    languageRisk: ['Maltese used in informal social settings — may feel excluded', 'Legal documents sometimes default to Maltese'],
    expatCommunity: 'Large English-speaking expat community. Active social clubs, online groups, and cultural organizations.',
    expatResources: ['Malta Expat Club', 'InterNations Malta', 'Identity Malta Agency (immigration services)', 'English-language newspapers (Times of Malta)'],
    expatSentiment: 'Positive. Praised for English language, climate, safety, and Mediterranean lifestyle. Complaints: small island feeling, construction/development, and traffic.',
  },
  Panama: {
    overall: 7, racial: 7, religious: 8, origin: 8, language: 5,
    group: 'Panama/Uruguay/Chile/Brazil',
    racialSummary: 'Panama is one of Latin America\'s most diverse countries, with a mix of indigenous, Afro-Panamanian, mestizo, and international populations. The Canal Zone history brought global diversity. Generally tolerant.',
    racialLegal: 'Panamanian Constitution prohibits discrimination. Anti-discrimination Law 16 of 2002. Executive Decree against racial discrimination.',
    racialPositive: ['Highly diverse population — one of Latin America\'s most multicultural countries', 'Canal Zone history created cosmopolitan culture', 'Generally tolerant society'],
    racialRisk: ['Socioeconomic stratification often correlates with race', 'Indigenous communities face marginalization', 'Class-based discrimination more common than overt racism'],
    religiousSummary: 'Panama has strong religious freedom. Predominantly Catholic but highly tolerant. Growing Protestant/evangelical communities. Jewish, Muslim, Hindu, and Bahá\'í communities established.',
    religiousLegal: 'Panamanian Constitution guarantees religious freedom. No state religion. Tax exemptions for religious organizations.',
    religiousPositive: ['Strong religious diversity and tolerance', 'Multiple faith communities well-established', 'No state religion'],
    religiousRisk: ['Catholic cultural default in rural areas', 'Limited non-Christian infrastructure outside Panama City'],
    originSummary: 'Panama has one of the world\'s most welcoming retiree visa programs (Pensionado). Large established American and Canadian expat communities. Pensionado visa provides extensive discounts.',
    originLegal: 'Pensionado visa program, Friendly Nations visa, Panama immigration law provides clear frameworks for foreign residents.',
    originPositive: ['World-renowned Pensionado retiree visa with extensive discounts', 'Large American/Canadian expat community', 'USD currency eliminates exchange risk'],
    originRisk: ['Bureaucratic processes can be slow', 'Changes in immigration policy possible', 'Need for lawyer/facilitator adds costs'],
    languageSummary: 'Spanish is the official language and essential for daily life. English is widely spoken in Panama City, especially in banking and tourist areas, but limited outside the capital and expat zones.',
    languageLegal: 'Spanish is the official language. No obligation for English services. Many government websites have English versions.',
    languagePositive: ['English widely spoken in Panama City business district', 'US Dollar currency — English service in banking', 'Expat communities provide English support'],
    languageRisk: ['Spanish essential outside Panama City and expat areas', 'Healthcare appointments usually in Spanish', 'Government bureaucracy in Spanish'],
    expatCommunity: 'Very large and active American/Canadian expat community, especially in Panama City, Coronado, and Boquete. Numerous social organizations and English-language resources.',
    expatResources: ['Panama Expat Facebook groups', 'American Society of Panama', 'International Women\'s Group', 'Panama Relocation Tours'],
    expatSentiment: 'Generally positive. Praised for Pensionado benefits, USD currency, low costs, and warm weather. Complaints: heat/humidity in lowlands, traffic in Panama City, and internet reliability.',
  },
  'Costa Rica': {
    overall: 7, racial: 6, religious: 8, origin: 7, language: 4,
    group: 'Mexico/Costa Rica/Colombia/Ecuador/Peru',
    racialSummary: 'Costa Rica is relatively homogeneous (mestizo majority) but generally tolerant. Expat communities are well-established. Some discrimination against Nicaraguan immigrants exists.',
    racialLegal: 'Costa Rican Constitution prohibits discrimination. Law Against Racial Discrimination 2014. Defensoría de los Habitantes.',
    racialPositive: ['Generally tolerant and peaceful society', '"Pura Vida" culture promotes acceptance', 'Well-established international expat community'],
    racialRisk: ['Discrimination against Nicaraguan immigrants documented', 'Limited diversity outside Central Valley', 'Class/wealth distinctions more prevalent than overt racism'],
    religiousSummary: 'Catholicism is the official state religion but religious freedom is practiced. Growing evangelical community. Very tolerant toward different faiths in practice.',
    religiousLegal: 'Costa Rican Constitution designates Catholicism as state religion but guarantees religious freedom.',
    religiousPositive: ['Religious tolerance in practice', 'Growing faith diversity', 'Peaceful coexistence of religions'],
    religiousRisk: ['Catholicism is official state religion', 'Limited non-Christian infrastructure outside cities'],
    originSummary: 'Costa Rica has a large American expat community, especially in Central Valley and Guanacaste. Pensionado and Rentista visas provide clear legal framework.',
    originLegal: 'Pensionado visa ($1,000/mo pension), Rentista visa ($2,500/mo income), Costa Rica immigration law.',
    originPositive: ['Large established American/Canadian expat community', 'Clear visa pathways for retirees', 'Generally welcoming to foreigners'],
    originRisk: ['Rising cost of living in popular expat areas', 'Bureaucratic processes can be very slow', 'Immigration law changes periodically'],
    languageSummary: 'Spanish is the official language and essential for daily life. English is spoken in tourist areas and some expat communities but government and healthcare services are in Spanish only.',
    languageLegal: 'Spanish is the sole official language. No obligation for English services.',
    languagePositive: ['English spoken in main tourist and expat areas', 'Growing bilingual education', 'Spanish is accessible for English speakers to learn'],
    languageRisk: ['Government and healthcare services in Spanish only', 'Limited English outside tourist/expat zones', 'Social isolation risk without Spanish'],
    expatCommunity: 'Very large American/Canadian community in Central Valley, Guanacaste, and Arenal region. Active social groups, English-language media, and support networks.',
    expatResources: ['Association of Residents of Costa Rica (ARCR)', 'Expat Facebook groups', 'CAJA (public healthcare enrollment)', 'Language schools throughout the country'],
    expatSentiment: 'Very positive. Praised for natural beauty, healthcare system, safety, and "Pura Vida" lifestyle. Complaints: bureaucracy, rising costs, and rainy season.',
  },
  Mexico: {
    overall: 7, racial: 6, religious: 8, origin: 7, language: 5,
    group: 'Mexico/Costa Rica/Colombia/Ecuador/Peru',
    racialSummary: 'Mexico has complex racial dynamics with a spectrum from indigenous to European-descended populations. Colorism exists but overt racism toward expats is rare. Expat communities are well-established.',
    racialLegal: 'Mexican Constitution Article 1, Federal Law to Prevent and Eliminate Discrimination (2003), CONAPRED (National Council to Prevent Discrimination).',
    racialPositive: ['Mixed-race society with less rigid racial categories', 'Expats generally well-received', 'Active federal anti-discrimination agency (CONAPRED)'],
    racialRisk: ['Colorism is prevalent in media and society', 'Indigenous communities face systemic discrimination', 'Class-based discrimination common'],
    religiousSummary: 'Mexico has strong religious freedom despite Catholic cultural dominance. Growing Protestant/evangelical community. Very tolerant toward different faiths. Separation of church and state since Reform War.',
    religiousLegal: 'Mexican Constitution guarantees religious freedom. Strict separation of church and state. Religious associations regulated by law.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Strong church-state separation', 'Diverse and tolerant religious landscape'],
    religiousRisk: ['Catholic cultural default, especially in rural areas', 'Catholic celebrations embedded in social life'],
    originSummary: 'Mexico has the largest American expat community in the world (~1.6 million). Well-established expat infrastructure in Lake Chapala, San Miguel, Mérida, and Pacific coast. Temporary resident visa available.',
    originLegal: 'Temporary Resident visa (4 years), Permanent Resident visa, Mexico immigration law provides clear pathways.',
    originPositive: ['Largest American expat community globally', 'Well-established infrastructure for foreign retirees', 'Close proximity to US for visits'],
    originRisk: ['Security concerns in some regions', 'Immigration policy can change with administration', 'Need for immigration lawyer recommended'],
    languageSummary: 'Spanish is essential for daily life. English is widely spoken in major expat areas and tourist zones. Government services and healthcare are in Spanish. Many expats live comfortably with basic Spanish.',
    languageLegal: 'No official language at federal level, but Spanish is de facto national language. Indigenous languages recognized. No obligation for English services.',
    languagePositive: ['English widely spoken in expat communities', 'Spanish relatively accessible for English speakers', 'Bilingual services in major expat areas'],
    languageRisk: ['Government and healthcare in Spanish only', 'Limited English outside tourist/expat zones', 'Emergency situations require Spanish'],
    expatCommunity: 'Largest and most established American expat community in the world. Social clubs, English-language media, and comprehensive support networks in all major expat areas.',
    expatResources: ['Lake Chapala Society', 'San Miguel de Allende expat organizations', 'Mexico Expat Facebook groups', 'US Embassy citizen services'],
    expatSentiment: 'Overwhelmingly positive. Praised for low costs, culture, food, weather, and established expat infrastructure. Concerns: security in some areas, healthcare quality variation, and distance from family.',
  },
  Colombia: {
    overall: 6, racial: 6, religious: 8, origin: 7, language: 4,
    group: 'Mexico/Costa Rica/Colombia/Ecuador/Peru',
    racialSummary: 'Colombia is racially diverse with indigenous, Afro-Colombian, mestizo, and European-descended populations. Discrimination exists along racial/class lines. Medellín and Bogotá have growing expat communities.',
    racialLegal: 'Colombian Constitution Article 13, Law 1482 of 2011 (anti-discrimination), Afro-Colombian communities protected under Law 70 of 1993.',
    racialPositive: ['Racially diverse and mixed society', 'Growing international community in major cities', 'Constitutional anti-discrimination protections'],
    racialRisk: ['Racial/class stratification (estratificación) embedded in society', 'Afro-Colombian and indigenous communities face marginalization', 'Colorism prevalent'],
    religiousSummary: 'Colombia has strong religious freedom. Predominantly Catholic but very tolerant. Growing Protestant/evangelical community. Jewish and Muslim communities in major cities.',
    religiousLegal: 'Colombian Constitution guarantees religious freedom. Concordat with Vatican. Religious diversity law.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Tolerant religious culture', 'Growing faith diversity'],
    religiousRisk: ['Catholic cultural default, especially in smaller cities', 'Limited non-Christian infrastructure outside Bogotá and Medellín'],
    originSummary: 'Colombia\'s expat community has grown significantly, especially in Medellín. Retirement visa available. Country image has improved dramatically. Digital nomad visa launched 2022.',
    originLegal: 'Retirement visa (Visa M-7), Colombia immigration law, digital nomad visa since 2022.',
    originPositive: ['Growing and welcoming expat community', 'Affordable cost of living', 'Digital nomad visa and retirement visa options', 'Dramatic improvement in safety over past 20 years'],
    originRisk: ['Security concerns in some areas', 'Complex visa renewal process', 'Negative stereotypes about Colombia persist abroad'],
    languageSummary: 'Spanish is the official language and essential for daily life. English is limited, even in major cities. Medellín expat community has some English infrastructure, but Spanish is necessary.',
    languageLegal: 'Spanish is the official language. 65+ indigenous languages recognized. No obligation for English services.',
    languagePositive: ['Colombian Spanish considered clear and easy to learn', 'Growing English education', 'Expat areas have some English infrastructure'],
    languageRisk: ['Very limited English outside expat circles', 'Healthcare almost entirely in Spanish', 'Government bureaucracy in Spanish only', 'Social isolation significant without Spanish'],
    expatCommunity: 'Growing expat community in Medellín (El Poblado, Laureles), Bogotá, and Cartagena. Active social groups and online communities.',
    expatResources: ['Medellín Expat Facebook groups', 'InterNations chapters', 'Migración Colombia offices', 'Spanish language schools (numerous and affordable)'],
    expatSentiment: 'Mostly positive. Praised for climate (Medellín), low costs, friendly people, and improving infrastructure. Concerns: safety, healthcare quality variation, and Spanish requirement.',
  },
  Ecuador: {
    overall: 6, racial: 6, religious: 8, origin: 7, language: 4,
    group: 'Mexico/Costa Rica/Colombia/Ecuador/Peru',
    racialSummary: 'Ecuador is ethnically diverse with mestizo majority, plus indigenous, Afro-Ecuadorian, and European-descended populations. Cuenca has a large American expat community. Discrimination exists along racial lines.',
    racialLegal: 'Ecuadorian Constitution (very progressive, rights-based), Organic Law on Intercultural Education, anti-discrimination provisions.',
    racialPositive: ['Progressive constitution with strong rights framework', 'Multicultural society', 'Large established expat community in Cuenca'],
    racialRisk: ['Indigenous and Afro-Ecuadorian communities face discrimination', 'Class-based stratification', 'Limited diversity awareness outside cities'],
    religiousSummary: 'Ecuador has strong religious freedom. Predominantly Catholic but tolerant. Constitution is notably secular. Growing Protestant community.',
    religiousLegal: 'Ecuadorian Constitution guarantees religious freedom and secular state. Anti-discrimination provisions cover religion.',
    religiousPositive: ['Constitutional guarantee of religious freedom', 'Secular state in law', 'Tolerant religious culture'],
    religiousRisk: ['Catholic cultural default in rural areas', 'Limited non-Christian infrastructure outside Quito and Cuenca'],
    originSummary: 'Ecuador has a large American retiree community, especially in Cuenca. Pensioner visa available with accessible income requirements. Use of USD eliminates exchange risk.',
    originLegal: 'Pensioner visa ($1,375/mo), Ecuador immigration law, USD currency.',
    originPositive: ['Large American retiree community especially in Cuenca', 'USD currency eliminates exchange risk', 'Affordable cost of living', 'Accessible pension visa requirements'],
    originRisk: ['Political instability and protests can disrupt daily life', 'Security concerns in some areas', 'Bureaucratic processes can be unpredictable'],
    languageSummary: 'Spanish is essential for daily life. English is very limited even in cities. Cuenca expat community has some English infrastructure but daily life requires Spanish.',
    languageLegal: 'Spanish is the official language. Kichwa and Shuar recognized as intercultural languages. No obligation for English services.',
    languagePositive: ['Ecuadorian Spanish considered clear and slow — good for learners', 'Expat community in Cuenca provides English support', 'Affordable Spanish classes widely available'],
    languageRisk: ['Very limited English proficiency nationally', 'Healthcare and government entirely in Spanish', 'Social isolation significant without Spanish', 'Emergency situations require Spanish'],
    expatCommunity: 'Large American expat community in Cuenca, growing communities in Quito and coastal areas. Active social groups and support networks.',
    expatResources: ['Cuenca Expat Facebook groups', 'Gringo Tree (Cuenca expat resource)', 'InterNations Ecuador', 'Spanish language schools'],
    expatSentiment: 'Mixed. Praised for low costs, climate (Cuenca), and community. Concerns: political instability, security, healthcare quality, and infrastructure limitations.',
  },
  Uruguay: {
    overall: 7, racial: 7, religious: 8, origin: 8, language: 5,
    group: 'Panama/Uruguay/Chile/Brazil',
    racialSummary: 'Uruguay is one of South America\'s most progressive and egalitarian countries. Predominantly European-descended population with Afro-Uruguayan minority. Anti-discrimination laws are strong for the region.',
    racialLegal: 'Uruguayan Constitution, Law 17.817 against racism and discrimination, Afro-descendant inclusion policies.',
    racialPositive: ['Among South America\'s most progressive societies', 'Strong anti-discrimination legal framework for the region', 'Generally egalitarian culture'],
    racialRisk: ['Limited racial diversity — Afro-Uruguayan minority faces socioeconomic gaps', 'Small population can feel insular', 'Limited multiculturalism compared to larger countries'],
    religiousSummary: 'Uruguay is the most secular country in Latin America. No state religion since 1918. Very tolerant of all faiths. Religious diversity is small but respected.',
    religiousLegal: 'Uruguayan Constitution guarantees religious freedom. Church-state separation since 1918. Anti-discrimination laws cover religion.',
    religiousPositive: ['Most secular country in Latin America', 'Strong church-state separation since 1918', 'Tolerant and progressive culture'],
    religiousRisk: ['Very small non-Christian communities', 'Limited religious infrastructure for minority faiths'],
    originSummary: 'Uruguay welcomes foreign retirees with a clear residency process. Small but growing expat community. Stable democracy and rule of law make it attractive for relocation.',
    originLegal: 'Uruguayan residency law, pension visa, relatively straightforward immigration process.',
    originPositive: ['Stable democracy and strong rule of law', 'Straightforward residency process', 'Welcoming culture toward foreigners', 'No restrictions on foreign property ownership'],
    originRisk: ['Small expat community — less established infrastructure', 'Higher cost of living than some South American alternatives', 'Slower pace — can feel isolated'],
    languageSummary: 'Spanish is the official language and essential for daily life. English proficiency is limited. Expat community is small, so Spanish is more necessary here than in larger expat destinations.',
    languageLegal: 'Spanish is the sole official language. No obligation for English services.',
    languagePositive: ['Rioplatense Spanish similar to Argentine — well-documented for learners', 'Growing English education in schools', 'Small size means immersive learning opportunity'],
    languageRisk: ['Very limited English proficiency', 'Healthcare and government in Spanish only', 'Small expat community means less English support', 'Social integration requires Spanish'],
    expatCommunity: 'Small but growing expat community, mainly in Montevideo and Punta del Este. Active online presence but less in-person infrastructure than larger destinations.',
    expatResources: ['Expat Uruguay Facebook group', 'InterNations Montevideo', 'Dirección Nacional de Migración', 'Spanish language schools in Montevideo'],
    expatSentiment: 'Positive. Praised for safety, stability, progressive policies, and quality of life. Complaints: cost of living higher than expected, small-town feel, weather (Montevideo winters), and limited English.',
  },
};

// ─── Generate inclusion data ─────────────────────────────────────────────────

function generateInclusion(loc: LocationSeed, rng: () => number): InclusionData {
  const profile = countryProfiles[loc.country] || countryProfiles['United States'];

  const racialScore = vary(rng, profile.racial);
  const religiousScore = vary(rng, profile.religious);
  const originScore = vary(rng, profile.origin);
  const languageScore = vary(rng, profile.language);
  const overallScore = Math.round(((racialScore + religiousScore + originScore + languageScore) / 4) * 10) / 10;

  return {
    country: loc.country,
    region: loc.region,
    overallInclusionScore: overallScore,
    lastUpdated: '2025-01',
    categories: {
      racial: {
        score: racialScore,
        summary: profile.racialSummary,
        legalProtections: profile.racialLegal,
        positiveFactors: profile.racialPositive,
        riskFactors: profile.racialRisk,
      },
      religious: {
        score: religiousScore,
        summary: profile.religiousSummary,
        legalProtections: profile.religiousLegal,
        positiveFactors: profile.religiousPositive,
        riskFactors: profile.religiousRisk,
      },
      countryOfOrigin: {
        score: originScore,
        summary: profile.originSummary,
        legalProtections: profile.originLegal,
        positiveFactors: profile.originPositive,
        riskFactors: profile.originRisk,
      },
      language: {
        score: languageScore,
        summary: profile.languageSummary,
        legalProtections: profile.languageLegal,
        positiveFactors: profile.languagePositive,
        riskFactors: profile.languageRisk,
      },
    },
    expat_experience: {
      communitySupport: profile.expatCommunity,
      integrationResources: profile.expatResources,
      socialMediaSentiment: profile.expatSentiment,
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n--- Seed Inclusion for 118 new locations ---`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  // Load seed files
  const files = ['seed-locations-us.json', 'seed-locations-eu.json', 'seed-locations-latam.json'];
  const allLocations: LocationSeed[] = [];

  for (const file of files) {
    const filePath = join(__dirname, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LocationSeed[];
      console.log(`  Loaded ${file}: ${data.length} locations`);
      allLocations.push(...data);
    } catch (err) {
      console.error(`  Failed to read ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n  Total: ${allLocations.length} locations\n`);

  if (dryRun) {
    for (const loc of allLocations) {
      const rng = makeRng(loc.id + '-inclusion');
      const data = generateInclusion(loc, rng);
      console.log(`  ${loc.id}: overall=${data.overallInclusionScore}, racial=${data.categories.racial.score}, religious=${data.categories.religious.score}, origin=${data.categories.countryOfOrigin.score}, language=${data.categories.language.score}`);
    }
    console.log(`\n  Dry run complete.\n`);
    return;
  }

  let upserted = 0;
  let errors = 0;

  for (const loc of allLocations) {
    const rng = makeRng(loc.id + '-inclusion');
    const data = generateInclusion(loc, rng);

    try {
      await prisma.adminLocationSupplement.upsert({
        where: {
          locationId_dataType: {
            locationId: loc.id,
            dataType: 'inclusion',
          },
        },
        create: {
          locationId: loc.id,
          dataType: 'inclusion',
          data: data as unknown as Record<string, unknown>,
        },
        update: {
          data: data as unknown as Record<string, unknown>,
        },
      });
      upserted++;
      console.log(`  [${upserted}/${allLocations.length}] ${loc.id} — overall: ${data.overallInclusionScore}`);
    } catch (err) {
      console.error(`  ERROR ${loc.id}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n  Results: ${upserted} upserted, ${errors} errors`);
  console.log(`  Done.\n`);
}

main()
  .catch((e) => {
    console.error('Seed inclusion failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
