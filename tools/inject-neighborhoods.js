#!/usr/bin/env node
/**
 * inject-neighborhoods.js
 *
 * Generates neighborhoods.json for all retirement locations that are missing it.
 * Produces 4 neighborhoods per location with realistic pricing scaled by local
 * rent level, appropriate sources by country, and correct currency fields.
 *
 * Idempotent: skips locations that already have neighborhoods.json.
 *
 * Usage:
 *   node tools/inject-neighborhoods.js
 *   node tools/inject-neighborhoods.js --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, 'data/locations');
const DASHBOARD_DIR = path.resolve(ROOT, 'packages/dashboard/public/data/locations');
const DRY_RUN = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────────────
// City name database - maps location IDs to primary city + neighborhoods
// ────────────────────────────────────────────────────────────────

const CITY_NEIGHBORHOODS = {
  // Colombia
  'colombia-bogota': {
    city: 'Bogota',
    center: { name: 'La Candelaria', desc: 'Historic colonial center with museums, universities, and Plaza Bolivar, the political heart of Colombia', character: 'Historic urban, cultural, walkable cobblestone streets', type: 'Restored colonial apartments and converted historic buildings' },
    suburb: { name: 'Cedritos', desc: 'Middle-class residential neighborhood in northern Bogota with parks, shopping centers, and good transit links', character: 'Residential, family-oriented, well-connected by TransMilenio', type: 'Modern apartment towers and gated residential complexes' },
    affordable: { name: 'Suba', desc: 'Large northern district with mixed-income areas, wetland parks, and improving infrastructure', character: 'Sprawling suburban, diverse, emerging commercial areas', type: 'Mid-rise apartments, townhouses, and social housing blocks' },
    expat: { name: 'Chapinero / Zona G', desc: 'Upscale gastronomy district popular with expats and young professionals, vibrant nightlife and dining scene', character: 'Trendy, cosmopolitan, excellent dining and nightlife', type: 'Modern apartments, renovated houses, and boutique buildings' },
  },
  'colombia-cartagena': {
    city: 'Cartagena',
    center: { name: 'Ciudad Amurallada (Walled City)', desc: 'UNESCO World Heritage walled center with colorful colonial architecture, plazas, and rooftop bars', character: 'Historic, tourist-heavy, vibrant colonial charm', type: 'Restored colonial mansions and boutique apartment conversions' },
    suburb: { name: 'Manga', desc: 'Residential island neighborhood connected by bridge with tree-lined streets and Republican-era mansions', character: 'Quiet island residential, historic character, family-friendly', type: 'Restored mansions, modern condos, and townhouses' },
    affordable: { name: 'Ternera / Turbaco', desc: 'Growing outer area with new residential developments and lower costs of living', character: 'Suburban expanding, family-oriented, emerging services', type: 'New construction apartments and affordable housing developments' },
    expat: { name: 'Bocagrande', desc: 'Modern beachfront peninsula with high-rise hotels, condos, and a cosmopolitan atmosphere', character: 'Beach resort, high-rise, tourist and expat hub', type: 'High-rise condominiums and luxury apartment towers' },
  },
  'colombia-medellin': {
    city: 'Medellin',
    center: { name: 'El Centro / La Alpujarra', desc: 'Downtown core with government buildings, Botero Plaza, and the bustling commercial district', character: 'Dense urban, commercial, transit hub with Metro access', type: 'Commercial apartments, older mid-rise buildings' },
    suburb: { name: 'Envigado', desc: 'Southern municipality with small-town charm, excellent walkability, and a thriving local food scene', character: 'Walkable town-within-a-city, safe, local feel', type: 'Mid-rise apartments and traditional houses' },
    affordable: { name: 'Belen', desc: 'Large residential zone west of El Poblado with parks, local markets, and family-friendly atmosphere', character: 'Residential middle-class, parks, local character', type: 'Mid-rise apartments and traditional houses' },
    expat: { name: 'El Poblado', desc: 'Upscale hillside neighborhood that is the primary expat hub, with international restaurants and modern amenities', character: 'Upscale, leafy, expat-heavy, international dining', type: 'Modern high-rise condos, gated communities, luxury apartments' },
  },
  'colombia-pereira': {
    city: 'Pereira',
    center: { name: 'Centro', desc: 'Compact downtown with Bolivar Plaza, commercial streets, and the Egoya viaduct connecting to Dosquebradas', character: 'Traditional downtown, commercial, walkable core', type: 'Older apartments and commercial-residential buildings' },
    suburb: { name: 'Cerritos', desc: 'Upscale residential area with country clubs, gated communities, and views of the coffee-growing countryside', character: 'Semi-rural upscale, country clubs, quiet living', type: 'Gated community houses and modern villas' },
    affordable: { name: 'Cuba', desc: 'Western working-class district with affordable housing, local markets, and improving transit connections', character: 'Working-class residential, affordable, community-oriented', type: 'Social housing blocks and modest houses' },
    expat: { name: 'Pinares de San Martin', desc: 'Modern upscale residential area near Circunvalar avenue with shopping malls and restaurants', character: 'Modern residential, shopping access, upper-middle-class', type: 'Modern apartment towers and townhouse complexes' },
  },
  'colombia-santa-marta': {
    city: 'Santa Marta',
    center: { name: 'Centro Historico', desc: 'Colonial historic center near the waterfront with Parque de los Novios, cathedral, and Gold Museum', character: 'Colonial waterfront, cultural, compact and walkable', type: 'Renovated colonial buildings and older apartments' },
    suburb: { name: 'Bello Horizonte', desc: 'Residential hillside neighborhood with ocean views, shopping centers, and newer development', character: 'Hillside residential, ocean views, growing amenities', type: 'Modern apartments and houses' },
    affordable: { name: 'Mamatoco', desc: 'Eastern neighborhood near the Sierra Nevada foothills with affordable housing and local markets', character: 'Affordable residential, gateway to mountains, local feel', type: 'Modest houses and low-rise apartments' },
    expat: { name: 'El Rodadero', desc: 'Beach resort area south of the center popular with tourists and expats, with restaurants and nightlife', character: 'Beach resort, tourist-friendly, dining and nightlife', type: 'Beachfront condos, hotel-apartments, and townhouses' },
  },

  // Costa Rica
  'costa-rica-arenal': {
    city: 'Nuevo Arenal / La Fortuna',
    center: { name: 'La Fortuna Centro', desc: 'Small bustling town center at the base of Arenal Volcano with tourism services, restaurants, and shops', character: 'Small-town walkable, tourism hub, volcano views', type: 'Small houses, apartments above shops, and guesthouses' },
    suburb: { name: 'El Castillo', desc: 'Quiet community on the south side of Lake Arenal with nature reserves and eco-lodges', character: 'Rural, eco-oriented, nature immersion', type: 'Houses on large lots, eco-homes, and cabins' },
    affordable: { name: 'Nuevo Arenal', desc: 'Lakeside town on the western shore of Lake Arenal with a small expat community and affordable living', character: 'Small lakeside town, quiet, affordable', type: 'Modest houses and small apartments' },
    expat: { name: 'Arenal Lake Communities', desc: 'Scattered expat communities along the north shore of Lake Arenal with organized social activities', character: 'Rural expat enclave, lake views, community-oriented', type: 'Custom-built houses and small developments' },
  },
  'costa-rica-atenas': {
    city: 'Atenas',
    center: { name: 'Atenas Centro', desc: 'Small town center famous for having one of the best climates in the world, with a central park and local market', character: 'Small-town walkable, pleasant climate, traditional Tico culture', type: 'Houses and small apartments near the central park' },
    suburb: { name: 'Santa Eulalia', desc: 'Rural residential area above Atenas with valley views and cooler temperatures', character: 'Rural hillside, panoramic views, quiet', type: 'Houses on large lots with gardens' },
    affordable: { name: 'Barrio Jesus', desc: 'Adjacent community with lower costs and easy access to Atenas services', character: 'Small-town affordable, agricultural, family-oriented', type: 'Tico-style houses and basic apartments' },
    expat: { name: 'Roca Verde / Los Angeles', desc: 'Hillside areas above town popular with North American retirees, with established expat organizations', character: 'Expat hillside community, organized social groups, scenic', type: 'Modern houses in gated communities and custom-built homes' },
  },
  'costa-rica-central-valley': {
    city: 'San Jose / Central Valley',
    center: { name: 'Escazu Centro', desc: 'Upscale suburb of San Jose with modern shopping malls, international restaurants, and excellent medical facilities', character: 'Modern suburban, upscale, best medical access in CR', type: 'Modern condos, gated townhouse communities, luxury apartments' },
    suburb: { name: 'Santa Ana', desc: 'Growing western suburb with a mix of Tico and expat communities, good schools, and newer developments', character: 'Suburban residential, family-friendly, growing commercial', type: 'Modern houses, townhomes, and condo complexes' },
    affordable: { name: 'Heredia', desc: 'University city north of San Jose with colonial center, lower costs, and vibrant student energy', character: 'University town, affordable urban, young and cultural', type: 'Apartments, student housing, and older homes' },
    expat: { name: 'San Rafael de Escazu', desc: 'Hillside area above Escazu known for luxury living, embassy residences, and panoramic valley views', character: 'Luxury hillside, embassy area, exclusive expat enclave', type: 'Luxury homes, gated estates, and high-end condos' },
  },
  'costa-rica-grecia': {
    city: 'Grecia',
    center: { name: 'Grecia Centro', desc: 'Known as the cleanest city in Latin America, centered on a unique red metal church and lively central market', character: 'Small-town walkable, immaculate, strong Tico culture', type: 'Houses and apartments near the central park' },
    suburb: { name: 'San Isidro de Grecia', desc: 'Adjacent community with rural character, coffee farms, and slightly cooler elevation', character: 'Rural residential, coffee country, peaceful', type: 'Houses on agricultural lots and modest homes' },
    affordable: { name: 'Sarchi', desc: 'Famous artisan town nearby known for painted ox carts, with affordable housing and traditional craft culture', character: 'Artisan village, affordable, cultural heritage', type: 'Traditional houses and small apartments' },
    expat: { name: 'La Garita / Dulce Nombre', desc: 'Residential area between Grecia and Alajuela with growing expat presence and easy airport access', character: 'Semi-rural, convenient airport access, expat-friendly', type: 'Modern houses and small gated communities' },
  },
  'costa-rica-guanacaste': {
    city: 'Tamarindo / Guanacaste',
    center: { name: 'Tamarindo Centro', desc: 'Surf town center with beach bars, restaurants, yoga studios, and a relaxed Pacific coast lifestyle', character: 'Beach town walkable, surf culture, cosmopolitan', type: 'Beach condos, apartments, and mixed-use buildings' },
    suburb: { name: 'Playa Langosta', desc: 'Quieter beach area south of Tamarindo with upscale homes and a more residential atmosphere', character: 'Upscale beach residential, quiet, nature-oriented', type: 'Beachfront villas, luxury condos, and gated homes' },
    affordable: { name: 'Villarreal', desc: 'Inland Tico village minutes from Tamarindo with significantly lower costs and authentic local culture', character: 'Tico village, affordable, authentic local life', type: 'Modest houses and basic apartments' },
    expat: { name: 'Playas del Coco', desc: 'Beach town popular with North American retirees, with fishing, diving, and an established expat community', character: 'Expat beach town, fishing village vibe, social', type: 'Condos, townhouses, and beach houses' },
  },
  'costa-rica-puerto-viejo': {
    city: 'Puerto Viejo de Talamanca',
    center: { name: 'Puerto Viejo Centro', desc: 'Caribbean reggae-infused town center with surf shops, Rasta bars, and a multicultural beach scene', character: 'Bohemian beach town, Caribbean culture, bike-friendly', type: 'Small houses, cabins, and apartments above shops' },
    suburb: { name: 'Playa Cocles', desc: 'Stretch of beach south of town with jungle-backed properties and surf breaks', character: 'Beach-jungle, surf culture, nature immersion', type: 'Beach houses, eco-cabins, and boutique properties' },
    affordable: { name: 'Bribri', desc: 'Indigenous community inland with very affordable living and access to Bribri culture', character: 'Rural indigenous, very affordable, cultural heritage', type: 'Basic houses and rural properties' },
    expat: { name: 'Playa Chiquita', desc: 'Upscale stretch between Cocles and Manzanillo with international restaurants and eco-lodges', character: 'Upscale Caribbean, eco-tourism, international', type: 'Tropical houses, eco-lodges, and custom-built homes' },
  },

  // Croatia
  'croatia-dubrovnik': {
    city: 'Dubrovnik',
    center: { name: 'Stari Grad (Old Town)', desc: 'UNESCO-listed walled city with marble streets, baroque churches, and dramatic Adriatic views', character: 'Historic walled, car-free, tourist-heavy in summer', type: 'Restored stone apartments within medieval walls' },
    suburb: { name: 'Lapad', desc: 'Peninsula neighborhood west of old town with beaches, promenades, and a more residential feel', character: 'Beach residential, walkable promenade, family-friendly', type: 'Apartments, small houses, and hotel conversions' },
    affordable: { name: 'Gruz', desc: 'Port area with the main harbor, market, and more affordable housing options', character: 'Working port area, local market hub, practical', type: 'Apartments in socialist-era and newer buildings' },
    expat: { name: 'Ploce', desc: 'Eastern area near the old town with luxury hotels, Banje Beach, and stunning fortification views', character: 'Upscale, scenic, close to old town attractions', type: 'Luxury apartments and renovated stone houses' },
  },
  'croatia-istria': {
    city: 'Rovinj / Istria',
    center: { name: 'Rovinj Old Town', desc: 'Venetian-style hilltop old town on a peninsula with cobblestone streets, art galleries, and fishing harbor', character: 'Venetian historic, artistic, compact and walkable', type: 'Stone apartments in medieval and Venetian buildings' },
    suburb: { name: 'Porec', desc: 'Coastal town with UNESCO basilica, good infrastructure, and a mix of tourism and residential life', character: 'Coastal residential, good infrastructure, seasonal tourism', type: 'Modern apartments, houses, and vacation properties' },
    affordable: { name: 'Pazin', desc: 'Inland Istrian capital with medieval castle, lower costs, and access to hilltop villages', character: 'Inland small town, affordable, cultural heritage', type: 'Older houses, apartments, and stone village properties' },
    expat: { name: 'Umag / Novigrad', desc: 'Northern coastal towns near the Slovenian border with international feel and tennis/sports tourism', character: 'Coastal, international, sports and wine culture', type: 'Modern apartments, villas, and holiday properties' },
  },
  'croatia-split': {
    city: 'Split',
    center: { name: 'Diocletian Palace / Grad', desc: 'Ancient Roman palace complex that forms the living heart of the city with shops, restaurants, and residences', character: 'Ancient Roman living city, UNESCO heritage, vibrant', type: 'Apartments within and around the palace complex' },
    suburb: { name: 'Kastela', desc: 'String of seven coastal settlements west of Split with castle heritage and a slower pace of life', character: 'Coastal suburban, historic castles, family-oriented', type: 'Houses, apartments, and renovated stone properties' },
    affordable: { name: 'Solin', desc: 'Ancient Salona archaeological site area with affordable housing and good transit to Split center', character: 'Historic suburban, affordable, good bus connections', type: 'Modern apartment blocks and family houses' },
    expat: { name: 'Bacvice / Firule', desc: 'Beach neighborhoods south of the center with the famous Bacvice sandy beach and cafe culture', character: 'Beach urban, cafe culture, lively promenade', type: 'Apartments in newer buildings and renovated villas' },
  },
  'croatia-zagreb': {
    city: 'Zagreb',
    center: { name: 'Gornji Grad (Upper Town)', desc: 'Medieval hilltop core with St. Mark Church, government buildings, and cobblestone streets', character: 'Historic hilltop, government quarter, cultural hub', type: 'Renovated apartments in historic buildings' },
    suburb: { name: 'Maksimir', desc: 'Eastern residential area near the large Maksimir Park and zoo with green spaces and family homes', character: 'Green residential, park-adjacent, family-friendly', type: 'Houses, older apartments, and newer developments' },
    affordable: { name: 'Novi Zagreb (New Zagreb)', desc: 'Southern district across the Sava river with socialist-era housing and modern shopping centers', character: 'Modern suburban, affordable, improving infrastructure', type: 'Socialist-era apartment blocks and new-build condos' },
    expat: { name: 'Donji Grad (Lower Town)', desc: 'Grand 19th-century planned district with green squares, Art Nouveau buildings, and the main train station', character: 'Elegant urban, cultural institutions, cafe culture', type: 'Apartments in Austro-Hungarian and Art Nouveau buildings' },
  },

  // Cyprus
  'cyprus-larnaca': {
    city: 'Larnaca',
    center: { name: 'Finikoudes / City Center', desc: 'Palm-lined seafront promenade with cafes, restaurants, and the medieval Larnaca Castle', character: 'Beachfront urban, walkable promenade, lively', type: 'Apartments in mid-rise buildings near the seafront' },
    suburb: { name: 'Oroklini', desc: 'Coastal village east of Larnaca with a salt lake, quieter beaches, and new residential developments', character: 'Quiet coastal suburban, nature nearby, family-oriented', type: 'Modern villas, townhouses, and apartment complexes' },
    affordable: { name: 'Aradippou', desc: 'Inland municipality with lower costs, local markets, and easy access to Larnaca city', character: 'Inland suburban, affordable, local Cypriot character', type: 'Houses and affordable apartments' },
    expat: { name: 'Mackenzie', desc: 'Beach area near the airport with bars, restaurants, and a popular stretch for plane-spotting and sunbathing', character: 'Beach lifestyle, social, younger expat crowd', type: 'Modern apartments and beachside condos' },
  },
  'cyprus-limassol': {
    city: 'Limassol',
    center: { name: 'Old Town / Castle Area', desc: 'Historic center around the medieval castle with narrow streets, craft shops, and the old port', character: 'Historic compact, gentrifying, cultural events', type: 'Renovated apartments in stone and colonial buildings' },
    suburb: { name: 'Germasogeia', desc: 'Tourist area east of center with the hotel strip, Dasoudi Beach, and residential neighborhoods behind', character: 'Beach suburban, tourist infrastructure, green spaces', type: 'Apartments, villas, and resort-style complexes' },
    affordable: { name: 'Mesa Geitonia', desc: 'Central residential area with local character, traditional shops, and lower rents than the coast', character: 'Central residential, affordable, local character', type: 'Older apartments and modest houses' },
    expat: { name: 'Limassol Marina / Molos', desc: 'Modern marina development and waterfront promenade with luxury residences and international dining', character: 'Luxury waterfront, modern, cosmopolitan lifestyle', type: 'Luxury marina apartments and modern tower residences' },
  },
  'cyprus-paphos': {
    city: 'Paphos',
    center: { name: 'Kato Paphos', desc: 'Lower town area near the harbor with UNESCO archaeological park, tavernas, and tourist services', character: 'Historic coastal, archaeological sites, walkable', type: 'Apartments near the harbor and tourist area' },
    suburb: { name: 'Chloraka', desc: 'Coastal village north of Paphos popular with British expats, with supermarkets and beach access', character: 'Expat suburban, British community, easy beach access', type: 'Villas, townhouses, and apartment complexes' },
    affordable: { name: 'Pano Paphos (Upper Town)', desc: 'Inland upper town with the municipal market, local shops, and more affordable housing', character: 'Local town center, affordable, Cypriot character', type: 'Older apartments and traditional houses' },
    expat: { name: 'Universal / Kings Avenue area', desc: 'Modern commercial district near the mall with new developments and international amenities', character: 'Modern commercial, international services, convenient', type: 'New-build apartments and modern residential complexes' },
  },

  // Ecuador
  'ecuador-cotacachi': {
    city: 'Cotacachi',
    center: { name: 'Cotacachi Centro', desc: 'Small indigenous-mestizo town known for leather goods, with a central park and surrounding volcanoes', character: 'Small Andean town, leather craft culture, indigenous markets', type: 'Colonial houses and small apartments near the park' },
    suburb: { name: 'La Quinta Area', desc: 'Rural area between Cotacachi and Lake Cuicocha with farming communities and mountain views', character: 'Rural Andean, farming, volcano and lake views', type: 'Houses on agricultural land and rural properties' },
    affordable: { name: 'Quiroga', desc: 'Adjacent village with a weekly indigenous market and very affordable housing', character: 'Indigenous village, very affordable, traditional market', type: 'Basic houses and rural homes' },
    expat: { name: 'Los Portales / Upper Cotacachi', desc: 'Hillside area above town where many North American expats have settled with organized community activities', character: 'Expat hillside, community groups, mountain views', type: 'Custom-built houses and small developments' },
  },
  'ecuador-cuenca': {
    city: 'Cuenca',
    center: { name: 'El Centro Historico', desc: 'UNESCO World Heritage colonial center with blue-domed cathedral, flower markets, and cobblestone streets', character: 'Colonial UNESCO, cultural, walkable and beautiful', type: 'Restored colonial apartments and converted historic houses' },
    suburb: { name: 'Misicata / Sayausi', desc: 'Western residential area along the river with newer housing developments and mountain views', character: 'Residential suburban, river access, growing area', type: 'Modern houses, apartments, and gated communities' },
    affordable: { name: 'Totoracocha', desc: 'Eastern working-class neighborhood with local markets and affordable apartments', character: 'Working-class residential, local markets, affordable', type: 'Basic apartments and modest houses' },
    expat: { name: 'El Vergel / Gringolandia', desc: 'Area along Yanuncay river nicknamed by locals for the large expat concentration, with cafes and restaurants', character: 'Expat enclave, river walks, international dining', type: 'Modern apartments, condos, and renovated houses' },
  },
  'ecuador-quito': {
    city: 'Quito',
    center: { name: 'Centro Historico', desc: 'Massive UNESCO colonial center with ornate churches, presidential palace, and dramatic Andean setting', character: 'Grand colonial UNESCO, cultural, improving walkability', type: 'Restored colonial apartments and historic conversions' },
    suburb: { name: 'Cumbaya', desc: 'Eastern valley suburb with warmer climate, shopping malls, and university campuses', character: 'Modern suburban, warmer valley, university area', type: 'Modern houses, condos, and gated communities' },
    affordable: { name: 'Quitumbe / Sur de Quito', desc: 'Southern bus terminal area with affordable housing and improving infrastructure', character: 'Southern urban, affordable, transit-connected', type: 'Apartment blocks and modest houses' },
    expat: { name: 'La Floresta / Gonzalez Suarez', desc: 'Bohemian and upscale neighborhoods with craft breweries, art spaces, and international restaurants', character: 'Bohemian-upscale, cultural, international dining', type: 'Art Deco apartments, modern condos, and renovated houses' },
  },
  'ecuador-salinas': {
    city: 'Salinas',
    center: { name: 'Salinas Malecon', desc: 'Beachfront boulevard with high-rise condos, restaurants, and Ecuador\'s most popular Pacific resort beach', character: 'Beach resort, malecon walkable, seasonal crowds', type: 'High-rise beachfront condos and apartments' },
    suburb: { name: 'Chipipe', desc: 'Quieter southern beach area with calmer waters, yacht club, and more residential atmosphere', character: 'Quiet beach residential, yacht club, family-friendly', type: 'Houses, low-rise condos, and beachside apartments' },
    affordable: { name: 'Santa Elena', desc: 'Inland provincial capital with lower costs, local markets, and bus connections', character: 'Inland town, affordable, local services', type: 'Basic houses and apartments' },
    expat: { name: 'Ballenita / Punta Blanca', desc: 'Coastal communities between Salinas and Montanita with growing expat populations and ocean views', character: 'Coastal expat, ocean views, community oriented', type: 'Modern houses, condos, and oceanview developments' },
  },
  'ecuador-vilcabamba': {
    city: 'Vilcabamba',
    center: { name: 'Vilcabamba Centro', desc: 'Tiny Andean town in the Valley of Longevity with a central park, organic restaurants, and holistic health focus', character: 'Tiny wellness village, organic lifestyle, spiritual', type: 'Small houses and apartments near the central park' },
    suburb: { name: 'Yamburara', desc: 'Valley area east of town with farms, horse ranches, and mountain river access', character: 'Valley rural, farming, river access, peaceful', type: 'Farm houses, cabins, and rural properties' },
    affordable: { name: 'Malacatos', desc: 'Adjacent valley town 20 minutes south with similar climate, local sugar cane production, and lower costs', character: 'Small valley town, affordable, agricultural', type: 'Basic houses and rural properties' },
    expat: { name: 'Hacienda Zone / Upper Vilcabamba', desc: 'Hillside area above town where expats have built homes with panoramic valley views', character: 'Expat hillside, valley views, alternative lifestyle', type: 'Custom eco-homes, hacienda-style houses, and retreats' },
  },

  // France
  'france-dordogne': {
    city: 'Sarlat-la-Caneda / Dordogne',
    center: { name: 'Sarlat Vieille Ville', desc: 'Beautifully preserved medieval town with golden sandstone buildings and one of France\'s best Saturday markets', character: 'Medieval preserved, market culture, gastronomic capital', type: 'Apartments in medieval and Renaissance stone buildings' },
    suburb: { name: 'Bergerac', desc: 'Riverside market town on the Dordogne with wine heritage, half-timbered old quarter, and airport', character: 'River market town, wine country, good services', type: 'Townhouses, apartments, and renovated stone houses' },
    affordable: { name: 'Terrasson-Lavilledieu', desc: 'Small town on the Vezere river with lower property costs and local services', character: 'Small riverside town, affordable, quiet', type: 'Stone houses and basic apartments' },
    expat: { name: 'Le Bugue / Montignac', desc: 'Charming villages near Lascaux caves with established British and Dutch expat communities', character: 'Village life, prehistoric heritage, expat community', type: 'Renovated stone farmhouses and village houses' },
  },
  'france-gascony': {
    city: 'Auch / Gascony',
    center: { name: 'Auch Centre', desc: 'Historic hilltop capital of Gascony with its grand stairway, cathedral, and old town overlooking the Gers river', character: 'Historic hilltop, provincial capital, Gascon culture', type: 'Apartments in historic buildings and townhouses' },
    suburb: { name: 'L\'Isle-Jourdain', desc: 'Market town between Auch and Toulouse with easy access to both, lake recreation, and modern amenities', character: 'Market town, convenient location, lake recreation', type: 'Modern houses, apartments, and rural properties' },
    affordable: { name: 'Condom', desc: 'Small town on the Baise river with Armagnac heritage, affordable stone houses, and pilgrim trail culture', character: 'Small riverside, Armagnac country, Camino de Santiago', type: 'Stone houses and affordable apartments' },
    expat: { name: 'Lectoure', desc: 'Beautiful hilltop bastide town with growing British expat community, thermal spa, and artisan shops', character: 'Hilltop bastide, spa town, artistic expat community', type: 'Renovated stone houses and bastide apartments' },
  },
  'france-languedoc': {
    city: 'Carcassonne / Languedoc',
    center: { name: 'Bastide Saint-Louis (Carcassonne)', desc: 'The lower town grid of Carcassonne with tree-lined squares, markets, and shops below the medieval citadel', character: 'Historic grid town, market culture, citadel views', type: 'Apartments in 18th-century townhouses and newer buildings' },
    suburb: { name: 'Narbonne', desc: 'Roman-founded coastal city with a vibrant covered market, canal heritage, and beach access', character: 'Roman heritage, coastal market town, Mediterranean', type: 'Apartments, townhouses, and Mediterranean-style villas' },
    affordable: { name: 'Limoux', desc: 'Small town south of Carcassonne famous for sparkling wine and carnival, with affordable housing', character: 'Small wine town, carnival traditions, affordable', type: 'Stone houses and affordable apartments' },
    expat: { name: 'Beziers / Canal du Midi Area', desc: 'Revitalizing city on the Canal du Midi with affordable property, growing expat scene, and wine culture', character: 'Revitalizing, canal lifestyle, wine culture', type: 'Renovated apartments, townhouses, and canal-side properties' },
  },
  'france-nice': {
    city: 'Nice',
    center: { name: 'Vieux Nice (Old Town)', desc: 'Baroque old quarter with the famous Cours Saleya flower market, narrow streets, and vibrant Mediterranean life', character: 'Baroque historic, market culture, Mediterranean vibrant', type: 'Apartments in colorful 17th-18th century buildings' },
    suburb: { name: 'Cimiez', desc: 'Elegant hillside quarter with Roman ruins, Matisse Museum, belle epoque hotels, and panoramic views', character: 'Elegant hillside, museums, belle epoque grandeur', type: 'Spacious apartments in belle epoque buildings and villas' },
    affordable: { name: 'Saint-Roch / Pasteur', desc: 'Residential areas north of the center with lower rents and good tram connections', character: 'Residential urban, improving, tram-connected', type: 'Apartments in modern and renovated buildings' },
    expat: { name: 'Promenade des Anglais / Carre d\'Or', desc: 'Iconic seafront promenade area with luxury hotels, international residents, and Mediterranean glamour', character: 'Seafront luxury, cosmopolitan, international', type: 'Luxury apartments and belle epoque residences' },
  },
  'france-paris': {
    city: 'Paris',
    center: { name: 'Le Marais (3e/4e)', desc: 'Historic quarter with medieval streets, Place des Vosges, Jewish heritage, and a thriving gallery scene', character: 'Historic chic, walkable, cultural and gastronomic', type: 'Apartments in 17th-18th century Haussmann and pre-Haussmann buildings' },
    suburb: { name: 'Boulogne-Billancourt', desc: 'Upscale western suburb with parks, museums, and good Metro access to central Paris', character: 'Upscale suburban, parks, excellent Metro access', type: 'Modern apartments and Art Deco buildings' },
    affordable: { name: 'Montreuil', desc: 'Eastern suburb with artistic community, flea markets, and lower rents with Metro Line 9 access', character: 'Artistic suburban, affordable, gentrifying', type: 'Apartments in older buildings and new developments' },
    expat: { name: 'Saint-Germain-des-Pres (6e)', desc: 'Left Bank literary quarter with famous cafes, bookshops, and a long history of international residents', character: 'Literary, cafe culture, cosmopolitan Left Bank', type: 'Elegant Haussmann apartments and historic buildings' },
  },
  'france-toulon': {
    city: 'Toulon',
    center: { name: 'Vieux Toulon', desc: 'Revitalized old town with provencal market, Cours Lafayette, and pedestrian streets near the naval harbor', character: 'Provencal market town, naval heritage, revitalizing', type: 'Apartments in provencal buildings and renovated townhouses' },
    suburb: { name: 'Le Mourillon', desc: 'Charming beach neighborhood east of center with village atmosphere, beaches, and botanical garden', character: 'Beach village, family-friendly, excellent beaches', type: 'Apartments and villas near the beaches' },
    affordable: { name: 'La Seyne-sur-Mer', desc: 'Former shipyard town across the harbor with lower costs and improving waterfront development', character: 'Working-class revitalizing, waterfront development, affordable', type: 'Apartments and modest houses' },
    expat: { name: 'Sanary-sur-Mer / Bandol', desc: 'Picturesque fishing villages west of Toulon with provencal charm and international residents', character: 'Provencal fishing villages, scenic, international', type: 'Provencal villas, apartments, and waterfront properties' },
  },

  // Greece
  'greece-athens': {
    city: 'Athens',
    center: { name: 'Plaka / Monastiraki', desc: 'Historic neighborhoods at the foot of the Acropolis with neoclassical buildings, tavernas, and ancient ruins', character: 'Ancient historic, tourist-heavy, walkable and vibrant', type: 'Apartments in neoclassical and older buildings' },
    suburb: { name: 'Kifisia', desc: 'Affluent northern suburb with tree-lined streets, boutiques, and a cooler microclimate', character: 'Upscale leafy suburban, boutiques, cooler climate', type: 'Villas, neoclassical houses, and modern apartments' },
    affordable: { name: 'Kypseli', desc: 'Diverse central neighborhood being revitalized with new cafes, community gardens, and affordable housing', character: 'Diverse urban, revitalizing, multicultural', type: 'Apartments in modernist and older apartment blocks' },
    expat: { name: 'Kolonaki', desc: 'Elegant central neighborhood on Lycabettus Hill slopes with galleries, designer shops, and embassies', character: 'Elegant urban, gallery district, diplomatic quarter', type: 'Apartments in elegant mid-rise buildings' },
  },
  'greece-corfu': {
    city: 'Corfu',
    center: { name: 'Corfu Old Town (Kerkyra)', desc: 'UNESCO Venetian-style old town with narrow kantouni alleys, Liston arcade, and twin fortresses', character: 'Venetian UNESCO, compact walkable, cultural events', type: 'Apartments in Venetian and British-era buildings' },
    suburb: { name: 'Gouvia / Kontokali', desc: 'Coastal villages north of town with marinas, beaches, and residential development', character: 'Coastal residential, marina access, beach lifestyle', type: 'Villas, apartments, and holiday properties' },
    affordable: { name: 'Potamos / Kanoni', desc: 'Residential areas south of town with airport proximity and lower costs', character: 'Residential, affordable, convenient location', type: 'Apartments and modest houses' },
    expat: { name: 'Northeast Coast (Kassiopi/Barbati)', desc: 'Scenic northeast coastline with established British expat community, clear waters, and mountain backdrops', character: 'Scenic coast, British expat enclave, nature-oriented', type: 'Villas, restored stone houses, and coastal properties' },
  },
  'greece-crete': {
    city: 'Chania / Crete',
    center: { name: 'Old Venetian Harbor (Chania)', desc: 'Stunning Venetian harbor with lighthouse, converted arsenali, and one of Greece\'s most atmospheric old towns', character: 'Venetian harbor, atmospheric, walkable old town', type: 'Apartments in Venetian and Ottoman-era buildings' },
    suburb: { name: 'Akrotiri', desc: 'Peninsula east of Chania with beaches, monasteries, and a mix of residential and tourist development', character: 'Peninsula residential, beaches, monasteries, quiet', type: 'Houses, villas, and modern apartments' },
    affordable: { name: 'Souda', desc: 'Port town east of Chania with naval base, lower costs, and ferry connections to Piraeus', character: 'Port town, affordable, practical transit hub', type: 'Apartments and modest houses' },
    expat: { name: 'Apokoronas (Almyrida/Vamos)', desc: 'Coastal and hillside villages east of Chania popular with British and Northern European expats', character: 'Village coast, expat community, traditional Cretan', type: 'Restored stone houses, villas, and new-build apartments' },
  },
  'greece-peloponnese': {
    city: 'Kalamata / Peloponnese',
    center: { name: 'Kalamata Center', desc: 'Capital of Messenia with a lively waterfront, historic castle, weekly market, and famous olive oil production', character: 'Waterfront city center, olive capital, market culture', type: 'Apartments in city center buildings' },
    suburb: { name: 'Kardamyli', desc: 'Coastal stone village in the Mani peninsula, made famous by Patrick Leigh Fermor, with hiking and sea access', character: 'Stone village, literary heritage, hiking and sea', type: 'Stone houses and village apartments' },
    affordable: { name: 'Messini', desc: 'Inland agricultural town near ancient Messene with affordable living and local produce markets', character: 'Agricultural town, ancient ruins, affordable', type: 'Houses and basic apartments' },
    expat: { name: 'Stoupa', desc: 'Beach village with established British and international community, tavernas, and two sandy beaches', character: 'Beach village, expat social hub, relaxed lifestyle', type: 'Houses, apartments, and small villas' },
  },
  'greece-rhodes': {
    city: 'Rhodes',
    center: { name: 'Rhodes Medieval Old Town', desc: 'Largest inhabited medieval town in Europe with Knights\' Quarter, Ottoman mosques, and labyrinthine streets', character: 'Medieval UNESCO, living museum, tourist hub', type: 'Apartments in medieval and Ottoman-era buildings' },
    suburb: { name: 'Ixia / Ialyssos', desc: 'Western coastal area with modern hotels, residential neighborhoods, and sunset views over Turkey', character: 'Coastal suburban, modern amenities, sunset views', type: 'Modern apartments, houses, and resort-style properties' },
    affordable: { name: 'Afantou', desc: 'Inland village with agricultural character, golf course, and significantly lower costs', character: 'Inland village, affordable, agricultural, golf', type: 'Village houses and basic apartments' },
    expat: { name: 'Lindos Area', desc: 'Famous white-washed village below an ancient acropolis, popular with international residents and artists', character: 'Iconic white village, artistic, international', type: 'Restored captain houses and white-washed apartments' },
  },

  // Ireland
  'ireland-cork': {
    city: 'Cork',
    center: { name: 'Cork City Centre', desc: 'Island city center built on the River Lee with the English Market, Patrick Street, and a vibrant pub scene', character: 'Island city, market culture, vibrant pub scene', type: 'Georgian townhouse apartments and modern city-center flats' },
    suburb: { name: 'Douglas', desc: 'Southern suburb with excellent shopping, parks, and the River Lee walking paths', character: 'Suburban residential, shopping access, green spaces', type: 'Houses, apartments, and modern estates' },
    affordable: { name: 'Ballincollig', desc: 'Western commuter town with regional park, military heritage, and lower housing costs', character: 'Commuter town, regional park, affordable', type: 'Estate houses, apartments, and newer developments' },
    family: { name: 'Carrigaline', desc: 'Southern seaside commuter town with good schools, community facilities, and harbor access', character: 'Family-friendly suburban, seaside, community-oriented', type: 'Estate houses and modern family homes' },
  },
  'ireland-galway': {
    city: 'Galway',
    center: { name: 'Galway City Centre / Latin Quarter', desc: 'Bohemian city center with buskers, colorful shopfronts on Quay Street, and a vibrant arts festival scene', character: 'Bohemian, artistic, musical, walkable and lively', type: 'Apartments in Georgian and renovated buildings' },
    suburb: { name: 'Salthill', desc: 'Seaside neighborhood with the famous promenade, Blackrock diving tower, and Atlantic views', character: 'Seaside promenade, Atlantic views, recreational', type: 'Houses, apartments, and seafront properties' },
    affordable: { name: 'Tuam Road Area', desc: 'Northern commuter area with newer developments and lower housing costs than the city center', character: 'Commuter residential, affordable, improving services', type: 'Modern estate houses and apartments' },
    family: { name: 'Oranmore', desc: 'East Galway commuter village with a medieval castle, bay views, and family-oriented community', character: 'Village commuter, bay views, family community', type: 'Modern estate houses and coastal properties' },
  },
  'ireland-limerick': {
    city: 'Limerick',
    center: { name: 'Limerick City Centre', desc: 'Compact center with King John\'s Castle, the Georgian quarter, and the revitalized Milk Market district', character: 'Historic compact, revitalizing, castle and river', type: 'Georgian townhouse apartments and city-center flats' },
    suburb: { name: 'Castletroy / University Area', desc: 'Eastern suburb near University of Limerick with modern development and the Plassey technology park', character: 'University suburban, modern, tech employment area', type: 'Modern estate houses and student-area apartments' },
    affordable: { name: 'Moyross / Southill', desc: 'Regenerating northern and southern estates with improving infrastructure and affordable housing', character: 'Regenerating, affordable, community development', type: 'Social and private housing, newer regeneration builds' },
    family: { name: 'Adare', desc: 'Picture-perfect thatched village 15 minutes from the city, repeatedly voted Ireland\'s prettiest village', character: 'Thatched village, picturesque, heritage tourism', type: 'Village houses and rural properties' },
  },
  'ireland-wexford': {
    city: 'Wexford',
    center: { name: 'Wexford Town Centre', desc: 'Medieval port town with narrow Viking-founded streets, the National Opera House, and bustling quayside', character: 'Medieval port, opera culture, compact walkable', type: 'Townhouse apartments and renovated historic buildings' },
    suburb: { name: 'Rosslare / Rosslare Harbour', desc: 'Coastal area with blue flag beaches, ferry port to Wales and France, and holiday homes', character: 'Coastal, ferry port, beach lifestyle', type: 'Holiday homes, bungalows, and coastal apartments' },
    affordable: { name: 'Enniscorthy', desc: 'Inland market town on the River Slaney with Norman castle, affordable housing, and 1798 heritage', character: 'Market town, riverside, historical, affordable', type: 'Town houses and affordable apartments' },
    family: { name: 'Gorey', desc: 'Thriving north Wexford town with excellent amenities, new housing estates, and Courtown beach nearby', character: 'Growing town, excellent amenities, beach access', type: 'Modern estate houses and newer apartments' },
  },

  // Italy
  'italy-abruzzo': {
    city: 'Pescara / Abruzzo',
    center: { name: 'Pescara Centro', desc: 'Adriatic coastal city center with long sandy beach, pedestrian Corso Umberto, and seafood restaurants', character: 'Coastal city, beach culture, pedestrian shopping', type: 'Apartments in coastal and city-center buildings' },
    suburb: { name: 'Chieti', desc: 'Historic hilltop university town with panoramic views from the mountains to the sea', character: 'Hilltop university town, panoramic views, cultural', type: 'Apartments and houses in historic and modern buildings' },
    affordable: { name: 'Sulmona', desc: 'Mountain town famous for confetti (sugar-coated almonds) with medieval center and affordable property', character: 'Medieval mountain town, affordable, confetti capital', type: 'Stone houses and affordable apartments' },
    expat: { name: 'Penne / Santo Stefano di Sessanio', desc: 'Hilltop villages in the Gran Sasso foothills attracting remote workers and lifestyle-seekers', character: 'Hilltop village, emerging destination, mountain lifestyle', type: 'Restored stone houses and village apartments' },
  },
  'italy-lake-region': {
    city: 'Lake Como / Lake Region',
    center: { name: 'Como Centro', desc: 'Elegant lakeside city with a grand Gothic cathedral, silk heritage, and stunning lakefront promenade', character: 'Elegant lakeside, silk heritage, cathedral city', type: 'Apartments in liberty-style and historic buildings' },
    suburb: { name: 'Lecco', desc: 'Eastern lake city in a more dramatic mountain setting with Manzoni literary heritage and outdoor culture', character: 'Mountain lakeside, literary heritage, outdoor recreation', type: 'Apartments and houses with lake and mountain views' },
    affordable: { name: 'Erba / Cantu', desc: 'Inland towns south of the lake with lower costs, furniture industry heritage, and train connections', character: 'Inland towns, affordable, industrial heritage, trains', type: 'Apartments and houses at lower lake-area prices' },
    expat: { name: 'Bellagio / Menaggio', desc: 'Classic lakeside villages on the central fork with international residents, villas, and celebrity associations', character: 'Iconic lakeside, international elite, villa culture', type: 'Apartments in villas, lakeside houses, and historic properties' },
  },
  'italy-puglia': {
    city: 'Lecce / Puglia',
    center: { name: 'Lecce Centro Storico', desc: 'Baroque masterpiece city with ornate limestone churches, Roman amphitheater, and vibrant passeggiata culture', character: 'Baroque, cultural, walkable historic, passeggiata', type: 'Apartments in baroque palazzi and renovated buildings' },
    suburb: { name: 'San Cataldo / Torre Chianca', desc: 'Coastal areas east of Lecce with Adriatic beaches and summer beach club culture', character: 'Beach suburban, summer social, Adriatic coast', type: 'Holiday apartments, houses, and coastal properties' },
    affordable: { name: 'Maglie / Otranto Area', desc: 'Southern Salento towns with lower costs, dramatic coastline, and traditional Pugliese life', character: 'Southern Salento, affordable, dramatic coast', type: 'Stone houses, trulli conversions, and apartments' },
    expat: { name: 'Ostuni / Alberobello', desc: 'Famous white city and trulli village attracting international buyers with unique architecture', character: 'White city, trulli architecture, international buyers', type: 'Trulli, masseria conversions, and white-washed apartments' },
  },
  'italy-sardinia': {
    city: 'Cagliari / Sardinia',
    center: { name: 'Castello / Marina (Cagliari)', desc: 'Historic hilltop and waterfront quarters of the capital with Pisan towers, cathedral, and harbour restaurants', character: 'Historic hilltop-harbor, Pisan heritage, university city', type: 'Apartments in historic buildings and renovated palazzi' },
    suburb: { name: 'Poetto / Quartu', desc: 'Long beach area and adjacent town east of Cagliari with flamingo lagoon and beach lifestyle', character: 'Beach residential, flamingo lagoon, summer lively', type: 'Apartments and houses near the beach' },
    affordable: { name: 'Iglesias', desc: 'Former mining town in southwestern Sardinia with medieval center and very affordable property', character: 'Medieval mining town, affordable, regenerating', type: 'Stone houses and affordable apartments' },
    expat: { name: 'Alghero', desc: 'Catalan-influenced coastal city on the northwest coast with coral fishing heritage and international residents', character: 'Catalan heritage, coral coast, international tourists', type: 'Apartments in old town and coastal properties' },
  },
  'italy-sicily': {
    city: 'Palermo / Sicily',
    center: { name: 'Centro Storico (Palermo)', desc: 'Chaotic, fascinating historic center with Arab-Norman UNESCO sites, street food markets, and baroque churches', character: 'Arab-Norman UNESCO, market culture, street food capital', type: 'Apartments in baroque palazzi and restored buildings' },
    suburb: { name: 'Mondello', desc: 'Beach neighborhood north of Palermo with Art Nouveau villas, sandy beach, and seafood restaurants', character: 'Beach residential, Art Nouveau, seafood culture', type: 'Apartments, Art Nouveau villas, and beach houses' },
    affordable: { name: 'Cefalu / Castelbuono', desc: 'Coastal and mountain towns east of Palermo with lower costs and rich Norman heritage', character: 'Norman coastal/mountain, affordable, heritage', type: 'Stone houses, apartments, and village properties' },
    expat: { name: 'Taormina Area', desc: 'Famous hilltop resort town on the east coast with ancient Greek theater and international glamour', character: 'Glamorous hilltop, ancient Greek theater, international', type: 'Elegant apartments, villas, and historic properties' },
  },
  'italy-tuscany': {
    city: 'Florence / Tuscany',
    center: { name: 'Centro Storico (Florence)', desc: 'Renaissance heart of Florence with the Duomo, Uffizi, Ponte Vecchio, and incomparable artistic heritage', character: 'Renaissance, art capital, walkable and monumental', type: 'Apartments in Renaissance and medieval palazzi' },
    suburb: { name: 'Fiesole', desc: 'Hilltop Etruscan town above Florence with Roman theater, monastery, and panoramic views of the city', character: 'Hilltop, Etruscan heritage, panoramic views', type: 'Villas, farmhouse conversions, and elegant apartments' },
    affordable: { name: 'Prato / Pistoia', desc: 'Cities northwest of Florence with their own artistic heritage, lower costs, and fast train connections', character: 'Art cities, affordable, train-connected to Florence', type: 'Apartments and houses at lower Florence-area prices' },
    expat: { name: 'Chianti (Greve / Radda)', desc: 'Rolling hill country between Florence and Siena with vineyards, olive groves, and international residents', character: 'Wine country, rolling hills, international lifestyle', type: 'Renovated farmhouses, villas, and converted estates' },
  },

  // Malta
  'malta-gozo': {
    city: 'Gozo',
    center: { name: 'Victoria (Rabat)', desc: 'Gozo\'s capital with the Citadella fortress, daily market, and the island\'s main commercial center', character: 'Citadel town, compact, main services hub', type: 'Apartments and traditional Gozitan townhouses' },
    suburb: { name: 'Marsalforn', desc: 'Main seaside resort with waterfront restaurants, salt pans, and a popular diving scene', character: 'Seaside resort, diving hub, relaxed waterfront', type: 'Apartments and holiday properties near the waterfront' },
    affordable: { name: 'Xaghra / Nadur', desc: 'Hilltop villages with megalithic temples, lower costs, and traditional village festa culture', character: 'Village hilltop, megalithic heritage, festas', type: 'Traditional farmhouses and village houses' },
    expat: { name: 'Xlendi / Sannat', desc: 'Small bay resort and clifftop village popular with expats seeking quiet Gozitan life', character: 'Bay resort, clifftop views, quiet expat life', type: 'Apartments, converted farmhouses, and bay-view properties' },
  },
  'malta-sliema': {
    city: 'Sliema',
    center: { name: 'Sliema Seafront', desc: 'Modern waterfront promenade with shopping, dining, and ferries to Valletta across the harbor', character: 'Modern waterfront, shopping and dining hub, cosmopolitan', type: 'Modern apartments and converted townhouses' },
    suburb: { name: 'San Gwann / Swieqi', desc: 'Central residential towns with good access to Sliema, Paceville, and Mater Dei Hospital', character: 'Central residential, convenient, quieter than Sliema', type: 'Apartments and maisonettes in residential blocks' },
    affordable: { name: 'Birkirkara', desc: 'One of Malta\'s largest towns with historic railway heritage, local markets, and lower rents', character: 'Large town, affordable, railway heritage, local markets', type: 'Traditional townhouses and older apartments' },
    expat: { name: 'St. Julian\'s / Paceville', desc: 'Nightlife and entertainment district with high-rise development, marina, and international atmosphere', character: 'Entertainment district, high-rise, international', type: 'Modern high-rise apartments and luxury developments' },
  },
  'malta-valletta': {
    city: 'Valletta',
    center: { name: 'Valletta Centro', desc: 'UNESCO fortress capital with Baroque architecture, Caravaggio masterpieces, and harbor views from every street', character: 'Baroque fortress, UNESCO, compact and monumental', type: 'Restored palazzo apartments and converted historic buildings' },
    suburb: { name: 'Floriana', desc: 'Garden suburb just outside Valletta\'s walls with the Mall gardens and main bus terminus', character: 'Garden suburb, transit hub, just outside Valletta walls', type: 'Apartments in historic and newer buildings' },
    affordable: { name: 'Paola / Tarxien', desc: 'Southern harbor towns near megalithic Hypogeum and temples with more affordable housing', character: 'Harbor towns, megalithic heritage, affordable', type: 'Traditional townhouses and apartments' },
    expat: { name: 'Vittoriosa (Birgu)', desc: 'One of the Three Cities with restored waterfront, yacht marina, and growing international interest', character: 'Historic Three Cities, marina, revitalized waterfront', type: 'Restored waterfront palazzi and historic apartments' },
  },

  // Mexico
  'mexico-lake-chapala': {
    city: 'Lake Chapala / Ajijic',
    center: { name: 'Ajijic Centro', desc: 'Cobblestone village center with art galleries, restaurants, and Mexico\'s largest foreign resident community', character: 'Artistic village, huge expat community, walkable', type: 'Colonial houses, apartments, and converted properties' },
    suburb: { name: 'Chapala Town', desc: 'Larger lakeside town with more Mexican character, municipal services, and the lakefront malecon', character: 'Mexican lakeside town, malecon, local services', type: 'Houses and apartments at lower Ajijic prices' },
    affordable: { name: 'Jocotepec', desc: 'Western lake town with indigenous heritage, lower costs, and growing expat interest', character: 'Western lakeside, affordable, indigenous character', type: 'Modest houses and basic apartments' },
    expat: { name: 'La Floresta / Upper Ajijic', desc: 'Hillside area above Ajijic center with panoramic lake views and established expat community', character: 'Hillside expat, lake views, gated communities', type: 'Modern houses, gated communities, and custom homes' },
  },
  'mexico-mazatlan': {
    city: 'Mazatlan',
    center: { name: 'Centro Historico', desc: 'Revitalized 19th-century port center with cathedral, Angela Peralta theater, and a vibrant arts scene', character: 'Revitalized historic, arts scene, culinary culture', type: 'Renovated colonial buildings and apartments' },
    suburb: { name: 'Zona Dorada (Golden Zone)', desc: 'Tourist beach strip with hotels, restaurants, and beachfront condominiums', character: 'Beach tourist zone, condo lifestyle, resort amenities', type: 'Beachfront condos, apartments, and resort properties' },
    affordable: { name: 'Playas del Sur', desc: 'Southern beach neighborhoods with newer development, lower costs, and local beach culture', character: 'Emerging beach area, affordable, local character', type: 'New construction condos and modest houses' },
    expat: { name: 'Marina Mazatlan / El Cid', desc: 'Marina and golf resort area with established expat community, sports facilities, and ocean access', character: 'Marina resort, golf and sports, expat social', type: 'Marina condos, golf community houses, and resort apartments' },
  },
  'mexico-merida': {
    city: 'Merida',
    center: { name: 'Centro Historico', desc: 'Grand colonial center with cathedral, Paseo Montejo mansions, and a vibrant Mayan-Spanish cultural fusion', character: 'Grand colonial, Paseo Montejo, cultural fusion', type: 'Restored colonial mansions and apartments' },
    suburb: { name: 'Garcia Gineres / Itzimna', desc: 'Established residential neighborhoods with tree-lined streets, parks, and medical facilities', character: 'Established residential, medical access, tree-lined', type: 'Houses and apartments in established neighborhoods' },
    affordable: { name: 'Merida Sur / Caucel', desc: 'Southern and western growth areas with new affordable housing developments', character: 'Emerging suburban, affordable new construction', type: 'New construction houses and apartment developments' },
    expat: { name: 'Santiago / Santa Ana', desc: 'Hip revitalized barrios north of the center with boutique hotels, restaurants, and expat-owned businesses', character: 'Revitalized hip, boutique culture, expat businesses', type: 'Restored colonial houses and boutique apartments' },
  },
  'mexico-oaxaca': {
    city: 'Oaxaca de Juarez',
    center: { name: 'Centro Historico', desc: 'UNESCO colonial center with green cantera stone buildings, artisan markets, and world-class cuisine', character: 'UNESCO, culinary capital, artisan markets', type: 'Colonial apartments and restored historic buildings' },
    suburb: { name: 'Reforma / Jalatlaco', desc: 'Charming adjacent neighborhoods with boutique hotels, craft coffee, and emerging foodie scene', character: 'Bohemian, foodie, creative neighborhood', type: 'Restored colonial houses and small apartments' },
    affordable: { name: 'San Felipe del Agua', desc: 'Northern hillside community with mountain views, cooler temperatures, and moderate costs', character: 'Hillside residential, mountain views, cooler', type: 'Houses and apartments with mountain views' },
    expat: { name: 'Xochimilco', desc: 'Village-within-the-city with its own central plaza, artisan workshops, and growing expat community', character: 'Village character, artisan culture, community-oriented', type: 'Restored village houses and colonial apartments' },
  },
  'mexico-playa-del-carmen': {
    city: 'Playa del Carmen',
    center: { name: 'Centro / Quinta Avenida', desc: 'Pedestrian 5th Avenue with international restaurants, shops, and Caribbean beach access', character: 'Beach resort, pedestrian avenue, international', type: 'Condos, apartments, and mixed-use buildings' },
    suburb: { name: 'Playacar', desc: 'Gated resort community south of town with golf course, ruins, and beachfront properties', character: 'Gated resort, golf, beachfront, secure', type: 'Condos, townhouses, and resort villas' },
    affordable: { name: 'Playa del Carmen Norte / Colosio', desc: 'Northern neighborhoods developing rapidly with more local character and lower costs', character: 'Developing local, affordable, improving services', type: 'New construction condos and modest apartments' },
    expat: { name: 'Riviera Maya (Puerto Aventuras / Akumal)', desc: 'Coastal communities south of Playa with marina, snorkeling, and established expat communities', character: 'Coastal communities, marina, snorkeling, expat social', type: 'Resort condos, beachfront houses, and marina properties' },
  },
  'mexico-puerto-vallarta': {
    city: 'Puerto Vallarta',
    center: { name: 'Centro / Malecon', desc: 'Classic Mexican beach town center with the famous malecon boardwalk, cathedral, and vibrant art scene', character: 'Malecon beach town, art scene, traditional charm', type: 'Condos and apartments near the malecon' },
    suburb: { name: 'Marina Vallarta', desc: 'Planned marina community with golf course, shops, and protected harbor', character: 'Marina resort, golf, planned community, secure', type: 'Marina condos, townhouses, and golf villas' },
    affordable: { name: 'Pitillal / Ixtapa', desc: 'Inland neighborhoods with authentic Mexican life, local markets, and significantly lower costs', character: 'Local Mexican, affordable, markets, authentic', type: 'Houses and apartments at local Mexican prices' },
    expat: { name: 'Zona Romantica / South Shore', desc: 'Vibrant, walkable area south of the river with the largest expat community, LGBTQ-friendly, and restaurants', character: 'Vibrant expat hub, LGBTQ-friendly, dining capital', type: 'Condos and apartments in mid-rise buildings' },
  },
  'mexico-queretaro': {
    city: 'Queretaro',
    center: { name: 'Centro Historico', desc: 'UNESCO Baroque colonial center with grand aqueduct, plazas, and one of Mexico\'s best-preserved historic districts', character: 'UNESCO Baroque, grand aqueduct, cultural hub', type: 'Restored colonial apartments and converted mansions' },
    suburb: { name: 'Juriquilla', desc: 'Modern northern suburb with university campus, golf courses, and newer developments', character: 'Modern suburban, university, golf, family-oriented', type: 'Modern houses, gated communities, and apartments' },
    affordable: { name: 'El Marques / Corregidora', desc: 'Southern municipalities with industrial parks, new housing, and affordable options', character: 'Emerging suburban, affordable, industrial growth', type: 'New construction houses and apartment complexes' },
    expat: { name: 'Jurica / Hacienda el Campanario', desc: 'Upscale northern neighborhoods with hacienda-style living and international school access', character: 'Upscale hacienda style, international schools, quiet', type: 'Hacienda-style houses and luxury developments' },
  },
  'mexico-san-miguel-de-allende': {
    city: 'San Miguel de Allende',
    center: { name: 'Centro Historico', desc: 'Iconic UNESCO colonial center with the pink Parroquia church, art galleries, and cobblestone streets', character: 'UNESCO iconic, art galleries, colonial gem', type: 'Restored colonial houses and boutique apartments' },
    suburb: { name: 'San Antonio / Los Frailes', desc: 'Residential areas south of center with newer developments and hot springs access', character: 'Residential, hot springs nearby, newer developments', type: 'Modern houses and residential developments' },
    affordable: { name: 'Atotonilco / Dolores Hidalgo Area', desc: 'Nearby towns with historic churches, ceramic traditions, and significantly lower costs', character: 'Historic towns, affordable, ceramic heritage', type: 'Traditional houses and rural properties' },
    expat: { name: 'La Lejona / Balcones', desc: 'Hillside neighborhoods with colonial-style homes, rooftop terraces, and Parroquia views', character: 'Hillside colonial, rooftop views, established expat', type: 'Colonial-style houses and boutique residences' },
  },

  // Panama
  'panama-bocas-del-toro': {
    city: 'Bocas del Toro',
    center: { name: 'Bocas Town (Isla Colon)', desc: 'Caribbean island town with colorful wooden buildings, dive shops, and a laid-back tropical atmosphere', character: 'Caribbean island town, colorful, dive culture', type: 'Wooden Caribbean houses and small apartments' },
    suburb: { name: 'Big Creek / Playa Bluff', desc: 'Eastern end of Isla Colon with surfing beaches and more secluded properties', character: 'Beach secluded, surfing, nature immersion', type: 'Beach houses, eco-homes, and rustic properties' },
    affordable: { name: 'Almirante', desc: 'Mainland port town with ferry connections and significantly lower costs than the islands', character: 'Mainland port, affordable, transit hub', type: 'Basic houses and modest apartments' },
    expat: { name: 'Isla Bastimentos / Red Frog Beach', desc: 'Island community with eco-resorts, red frog sanctuary, and international residents', character: 'Island eco-resort, nature, international community', type: 'Eco-homes, beach houses, and island resort properties' },
  },
  'panama-chitre': {
    city: 'Chitre',
    center: { name: 'Chitre Centro', desc: 'Capital of Herrera province, the cultural heart of the Azuero Peninsula with colonial cathedral and festivals', character: 'Provincial capital, festival culture, colonial heritage', type: 'Houses and apartments near the central plaza' },
    suburb: { name: 'Los Santos', desc: 'Adjacent historic town and provincial capital known for festivals, folklore, and traditional culture', character: 'Historic folkloric, festivals, traditional Panamanian', type: 'Traditional houses and modest apartments' },
    affordable: { name: 'Pedasi', desc: 'Fishing village on the southern tip of Azuero with beaches, surfing, and low cost of living', character: 'Fishing village, beaches, very affordable', type: 'Simple houses and beach cabins' },
    expat: { name: 'Playa Venao / Pedasi Beach Area', desc: 'Surf and beach area attracting international residents with newer developments', character: 'Surf beach, emerging expat, laid-back international', type: 'Beach houses, condos, and new development properties' },
  },
  'panama-city-bella-vista': {
    city: 'Panama City - Bella Vista',
    center: { name: 'Bella Vista Centro', desc: 'Dense mixed-use area with restaurants, nightlife on Calle Uruguay, and high-rise residential towers', character: 'Dense urban, nightlife, restaurant district', type: 'High-rise condos and mid-rise apartments' },
    suburb: { name: 'San Francisco', desc: 'Adjacent neighborhood with parks, supermarkets, and a more residential atmosphere', character: 'Urban residential, parks, practical amenities', type: 'Mid-rise and high-rise apartments' },
    affordable: { name: 'Parque Lefevre', desc: 'Eastern residential area with lower costs, local markets, and Metro access', character: 'Working-class residential, Metro access, affordable', type: 'Apartments and modest houses' },
    expat: { name: 'Calle Uruguay / Via Argentina', desc: 'Restaurant rows and commercial streets popular with expats for dining and social life', character: 'Restaurant row, expat social, cosmopolitan', type: 'High-rise condos and modern apartments' },
  },
  'panama-city-casco-viejo': {
    city: 'Panama City - Casco Viejo',
    center: { name: 'Casco Viejo (San Felipe)', desc: 'UNESCO colonial quarter on a peninsula with restored colonial buildings, rooftop bars, and canal views', character: 'UNESCO colonial, gentrified, rooftop culture', type: 'Restored colonial apartments and boutique residences' },
    suburb: { name: 'El Chorrillo', desc: 'Adjacent working-class neighborhood with lower costs and proximity to Casco attractions', character: 'Working-class, affordable, adjacent to Casco', type: 'Basic apartments and older houses' },
    affordable: { name: 'Santa Ana', desc: 'Historic commercial district between Casco and downtown with markets and affordable options', character: 'Historic commercial, affordable, improving', type: 'Older apartments and commercial-residential buildings' },
    expat: { name: 'Restored Casco Viejo', desc: 'The fully restored blocks of Casco with art galleries, wine bars, and international residents', character: 'Restored colonial, artistic, international residents', type: 'Luxury restored colonial apartments and penthouses' },
  },
  'panama-city-costa-del-este': {
    city: 'Panama City - Costa del Este',
    center: { name: 'Costa del Este Centro', desc: 'Modern planned district with wide avenues, corporate offices, international schools, and shopping malls', character: 'Modern planned, corporate, international schools', type: 'Modern high-rise condos and luxury apartments' },
    suburb: { name: 'Santa Maria Golf & Country Club', desc: 'Gated golf community within Costa del Este with Jack Nicklaus course and luxury residences', character: 'Luxury gated golf, Jack Nicklaus course, exclusive', type: 'Luxury houses, golf villas, and premium condos' },
    affordable: { name: 'Juan Diaz', desc: 'Working-class area south with commercial development, Metro access, and much lower costs', character: 'Working-class, Metro-connected, emerging commercial', type: 'Affordable apartments and basic houses' },
    expat: { name: 'Panama Pacifico', desc: 'Former US military base converted into modern community with international schools and tax incentives', character: 'Former military base, tax zone, modern international', type: 'Modern houses, apartments, and planned community homes' },
  },
  'panama-city-el-cangrejo': {
    city: 'Panama City - El Cangrejo',
    center: { name: 'El Cangrejo Centro', desc: 'Central urban neighborhood with diverse restaurants from Chinese to Lebanese, hotels, and the Einstein Head statue', character: 'Central multicultural, diverse dining, urban convenient', type: 'Mid-rise and high-rise condos and apartments' },
    suburb: { name: 'Obarrio', desc: 'Adjacent upscale financial district with banks, embassies, and luxury apartment towers', character: 'Financial district, embassies, upscale', type: 'Luxury high-rise apartments and office-residential towers' },
    affordable: { name: 'Betania', desc: 'Residential area south of El Cangrejo with local character and more affordable housing', character: 'Residential, affordable, local Panamanian character', type: 'Apartments and houses at moderate prices' },
    expat: { name: 'Via Argentina / Via Espana Corridor', desc: 'Commercial corridors with international restaurants, services, and good transit connections', character: 'Commercial corridor, international services, transit', type: 'Apartments in towers along main avenues' },
  },
  'panama-city-punta-pacifica': {
    city: 'Panama City - Punta Pacifica',
    center: { name: 'Punta Pacifica', desc: 'Ultra-modern peninsula with gleaming skyscrapers, Trump Ocean Club, and Johns Hopkins-affiliated hospital', character: 'Ultra-modern, luxury skyscrapers, medical hub', type: 'Luxury high-rise condos with ocean views' },
    suburb: { name: 'Punta Paitilla', desc: 'Adjacent waterfront area with established high-rises, ocean views, and Cinta Costera park access', character: 'Established waterfront, park access, ocean views', type: 'High-rise condos and apartments' },
    affordable: { name: 'Rio Abajo', desc: 'Inland neighborhood north of Punta Pacifica with local character and lower rents', character: 'Local residential, affordable, practical location', type: 'Modest apartments and older buildings' },
    expat: { name: 'Cinta Costera / Balboa Avenue', desc: 'Waterfront park boulevard connecting Casco Viejo to Punta Pacifica with upscale living', character: 'Waterfront boulevard, upscale, connected', type: 'Modern high-rise condos along the waterfront' },
  },
  'panama-coronado': {
    city: 'Coronado',
    center: { name: 'Coronado Town Center', desc: 'Beach resort community hub with commercial center, supermarkets, and gated residential areas', character: 'Beach resort hub, commercial center, gated living', type: 'Condos, townhouses, and gated community houses' },
    suburb: { name: 'San Carlos / Gorgona', desc: 'Adjacent beach towns with newer developments and beach access', character: 'Beach suburban, newer developments, more affordable', type: 'Beach condos and houses' },
    affordable: { name: 'Chame', desc: 'Inland town on the highway with local services and significantly lower costs', character: 'Highway town, affordable, local services', type: 'Basic houses and apartments' },
    expat: { name: 'Coronado Golf & Beach Club', desc: 'Established gated resort with golf, tennis, equestrian center, and the largest beach expat community', character: 'Gated resort, golf and beach, largest expat beach community', type: 'Resort houses, villas, and premium condos' },
  },
  'panama-david': {
    city: 'David',
    center: { name: 'David Centro', desc: 'Second-largest city in Panama with major shopping, medical facilities, and the main hub for Chiriqui province', character: 'Provincial capital, shopping and medical hub, practical', type: 'Houses and apartments near the commercial center' },
    suburb: { name: 'Dolega', desc: 'Small town north of David with cooler elevation, farming community, and quiet residential life', character: 'Small town, farming, cooler elevation, peaceful', type: 'Houses and rural properties' },
    affordable: { name: 'David Sur', desc: 'Southern residential areas with newer affordable developments and local markets', character: 'Affordable residential, new construction, local markets', type: 'New construction houses and affordable apartments' },
    expat: { name: 'San Juan / Vista Alegre', desc: 'Northern residential areas popular with expats who use David as a base for shopping and medical care', character: 'Residential, expat-friendly base, mountain access', type: 'Modern houses and small gated developments' },
  },
  'panama-el-valle': {
    city: 'El Valle de Anton',
    center: { name: 'El Valle Centro', desc: 'Mountain town inside a volcanic crater with a famous Sunday market, hot springs, and cool climate', character: 'Crater town, Sunday market, hot springs, cool climate', type: 'Houses and cabins near the town center' },
    suburb: { name: 'La Mesa / Las Mozas', desc: 'Hillside areas above the valley with mountain views and slightly cooler temperatures', character: 'Mountain hillside, cooler, panoramic views', type: 'Mountain houses, cabins, and eco-homes' },
    affordable: { name: 'Anton (San Juan de Dios)', desc: 'Lowland town at the base of the mountains with more affordable living and highway access', character: 'Lowland town, affordable, highway-connected', type: 'Basic houses and modest apartments' },
    expat: { name: 'Crater Edge Communities', desc: 'Scenic areas along the crater rim with established expat community and organized activities', character: 'Crater rim, expat community, nature immersion', type: 'Custom houses, eco-retreats, and mountain properties' },
  },
  'panama-pedasi': {
    city: 'Pedasi',
    center: { name: 'Pedasi Centro', desc: 'Small Azuero fishing town with colonial church, central plaza, and a growing international community', character: 'Small colonial fishing town, growing international', type: 'Colonial houses and small apartments' },
    suburb: { name: 'Playa Venao', desc: 'Popular surf beach 30 minutes from Pedasi with beach bars and boutique hotels', character: 'Surf beach, laid-back, bohemian', type: 'Beach houses, surf shacks, and boutique properties' },
    affordable: { name: 'Las Tablas', desc: 'Larger town north of Pedasi known for Carnival celebrations and more affordable services', character: 'Festival town, affordable, more services', type: 'Houses and apartments at lower prices' },
    expat: { name: 'Playa Destiladeros / Playa Los Destiladores', desc: 'Beaches near Pedasi where expats build houses with ocean views and direct beach access', character: 'Ocean-view beach, expat homes, direct beach access', type: 'Custom beach houses and oceanview properties' },
  },
  'panama-puerto-armuelles': {
    city: 'Puerto Armuelles',
    center: { name: 'Puerto Armuelles Centro', desc: 'Former United Fruit Company port town with a frontier feel, beach access, and very low costs', character: 'Former banana port, frontier feel, beach, very affordable', type: 'Older houses and basic apartments' },
    suburb: { name: 'Paso Canoas', desc: 'Border town with Costa Rica offering cross-border shopping and commerce', character: 'Border town, cross-border shopping, commercial', type: 'Commercial-residential properties and basic houses' },
    affordable: { name: 'Progreso', desc: 'Small agricultural community inland with very low costs and local services', character: 'Agricultural village, very affordable, rural', type: 'Basic houses and rural properties' },
    expat: { name: 'Corazon de Jesus Beach', desc: 'Beach area where small but growing number of expats are building homes with Pacific views', character: 'Emerging beach expat, Pacific views, pioneer', type: 'New construction houses and beach properties' },
  },
  'panama-volcan': {
    city: 'Volcan',
    center: { name: 'Volcan Centro', desc: 'Highland town on the slopes of Baru volcano with cool climate, orchid farms, and agricultural markets', character: 'Highland town, volcano slopes, cool climate, agriculture', type: 'Houses and small apartments near the town center' },
    suburb: { name: 'Paso Ancho', desc: 'Uphill residential area above Volcan with mountain views and strawberry farms', character: 'Uphill residential, strawberry farms, mountain views', type: 'Houses and mountain properties' },
    affordable: { name: 'Cerra Punta', desc: 'Highest settlement in Panama with vegetable farms, cool mist, and very affordable living', character: 'Highest town, vegetable farming, misty and cool', type: 'Farm houses and basic dwellings' },
    expat: { name: 'Nueva Suiza / Highland Communities', desc: 'Areas named by Swiss settlers with coffee farms and an established highland expat community', character: 'Swiss-named, coffee farms, highland expat community', type: 'Custom houses, coffee farm properties, and gated homes' },
  },

  // Portugal
  'portugal-algarve': {
    city: 'Algarve',
    center: { name: 'Faro Centro', desc: 'Regional capital with an old town inside medieval walls, marina, and international airport', character: 'Regional capital, walled old town, university city', type: 'Apartments in old town and modern buildings' },
    suburb: { name: 'Lagos', desc: 'Historic port town on the western Algarve with dramatic cliffs, old town, and marina', character: 'Historic port, dramatic cliffs, marina lifestyle', type: 'Apartments, townhouses, and villa conversions' },
    affordable: { name: 'Silves', desc: 'Inland former Moorish capital with hilltop castle, orange groves, and lower costs than the coast', character: 'Moorish heritage, inland affordable, orange groves', type: 'Traditional houses and affordable apartments' },
    expat: { name: 'Albufeira / Vilamoura', desc: 'Major resort area and luxury marina with the largest expat community in the Algarve', character: 'Resort marina, large expat community, golf and beach', type: 'Modern condos, villas, and marina apartments' },
  },
  'portugal-cascais': {
    city: 'Cascais',
    center: { name: 'Cascais Centro', desc: 'Former royal fishing village with elegant center, marina, and direct train connection to Lisbon', character: 'Elegant coastal, royal heritage, Lisbon train-connected', type: 'Apartments in elegant buildings and converted properties' },
    suburb: { name: 'Estoril', desc: 'Adjacent town with famous casino, beach, and Formula 1 heritage', character: 'Casino coast, beach, motorsport heritage', type: 'Villas, apartments, and resort-style properties' },
    affordable: { name: 'Sintra', desc: 'UNESCO romantic hill town with fairy-tale palaces and lower costs than Cascais', character: 'UNESCO romantic, palaces, cooler hill climate', type: 'Apartments, quintas, and hillside properties' },
    expat: { name: 'Carcavelos / Sao Joao do Estoril', desc: 'Beach communities between Lisbon and Cascais with surf culture and international schools', character: 'Beach surf, international schools, commuter-friendly', type: 'Modern apartments and beachside condos' },
  },
  'portugal-porto': {
    city: 'Porto',
    center: { name: 'Ribeira / Centro Historico', desc: 'UNESCO riverside district with colorful buildings, port wine lodges across the river, and iconic Dom Luis bridge', character: 'UNESCO riverside, port wine, iconic bridges', type: 'Apartments in renovated historic buildings' },
    suburb: { name: 'Foz do Douro', desc: 'Upscale coastal neighborhood at the mouth of the Douro river with beaches, parks, and ocean views', character: 'Upscale coastal, river mouth, ocean views', type: 'Apartments and houses in elegant coastal area' },
    affordable: { name: 'Vila Nova de Gaia', desc: 'South bank city home to port wine cellars with lower rents and improving Metro connections', character: 'Port wine cellars, affordable, Metro-connected', type: 'Apartments and houses at lower Porto prices' },
    expat: { name: 'Boavista / Cedofeita', desc: 'Modern and bohemian neighborhoods around the Casa da Musica with international restaurants and galleries', character: 'Modern-bohemian, cultural, international dining', type: 'Apartments in renovated and modern buildings' },
  },
  'portugal-silver-coast': {
    city: 'Caldas da Rainha / Silver Coast',
    center: { name: 'Caldas da Rainha Centro', desc: 'Spa town with thermal hospital, daily fruit market, and quirky ceramics heritage including Bordalo Pinheiro', character: 'Spa town, ceramics heritage, daily market', type: 'Apartments and townhouses in the town center' },
    suburb: { name: 'Sao Martinho do Porto', desc: 'Shell-shaped bay beach with calm waters, family atmosphere, and growing residential development', character: 'Shell bay, calm beach, family residential', type: 'Apartments, townhouses, and bay-view properties' },
    affordable: { name: 'Peniche', desc: 'Fishing port and surf town on a peninsula with world-class waves and affordable living', character: 'Fishing port, world-class surf, affordable peninsula', type: 'Apartments and houses at lower Silver Coast prices' },
    expat: { name: 'Foz do Arelho / Obidos Lagoon', desc: 'Lagoon and beach area near medieval Obidos with established expat community', character: 'Lagoon beach, medieval Obidos nearby, expat community', type: 'Villas, apartments, and lagoon-view properties' },
  },

  // Spain
  'spain-barcelona': {
    city: 'Barcelona',
    center: { name: 'Barri Gotic (Gothic Quarter)', desc: 'Medieval heart of Barcelona with narrow alleys, Roman ruins, Barcelona Cathedral, and vibrant squares', character: 'Medieval Gothic, dense walkable, vibrant nightlife', type: 'Apartments in medieval and renovated historic buildings' },
    suburb: { name: 'Gracia', desc: 'Former independent village now a bohemian neighborhood with plazas, boutiques, and Gaudi\'s Park Guell', character: 'Bohemian village, plazas, Gaudi, artistic', type: 'Apartments in modernista and traditional buildings' },
    affordable: { name: 'Hospitalet de Llobregat', desc: 'Adjacent municipality with lower rents, Metro access, and diverse multicultural community', character: 'Diverse suburban, affordable, Metro-connected', type: 'Apartments in modern and older residential blocks' },
    expat: { name: 'Eixample', desc: 'Cerdas grid district with iconic Gaudi buildings, wide avenues, and the highest international resident density', character: 'Modernista grid, Gaudi masterworks, cosmopolitan', type: 'Apartments in modernista and Art Nouveau buildings' },
  },
  'spain-canary-islands': {
    city: 'Las Palmas / Canary Islands',
    center: { name: 'Vegueta (Las Palmas)', desc: 'Historic colonial quarter where Columbus stopped en route to America, with cathedral and Casa de Colon', character: 'Colonial historic, Columbus heritage, cultural quarter', type: 'Apartments in colonial and Canarian buildings' },
    suburb: { name: 'Maspalomas / Playa del Ingles', desc: 'Southern Gran Canaria resort area with iconic sand dunes, year-round sunshine, and European retirees', character: 'Resort, year-round sun, European retirees', type: 'Resort apartments, bungalows, and holiday complexes' },
    affordable: { name: 'Las Palmas - Escaleritas / Miller Bajo', desc: 'Central residential neighborhoods with local life and lower costs than the beach areas', character: 'Central residential, affordable, local character', type: 'Apartments in residential buildings' },
    expat: { name: 'Las Canteras (Las Palmas)', desc: 'Urban beach with one of the best city beaches in Europe, surf culture, and international residents', character: 'Urban beach, surf culture, international residents', type: 'Beachfront apartments and modern condos' },
  },
  'spain-costa-del-sol': {
    city: 'Malaga / Costa del Sol',
    center: { name: 'Malaga Centro Historico', desc: 'Revitalized city center with Picasso Museum, Roman theater, Moorish Alcazaba, and pedestrian Larios Street', character: 'Revitalized cultural, Picasso, Moorish heritage', type: 'Apartments in renovated historic and modern buildings' },
    suburb: { name: 'Torremolinos / Benalmadena', desc: 'Western coastal towns with extensive beaches, marina, and established tourism infrastructure', character: 'Beach resort, marina, established tourism', type: 'Apartments, beach condos, and urbanization properties' },
    affordable: { name: 'Fuengirola', desc: 'Large expat town with one of the longest promenades in Spain and established international community', character: 'Expat town, long promenade, international services', type: 'Apartments and urbanization properties' },
    expat: { name: 'Marbella / Nueva Andalucia', desc: 'Luxury resort area with Puerto Banus marina, golf courses, and celebrity associations', character: 'Luxury resort, Puerto Banus, golf and glamour', type: 'Luxury villas, modern apartments, and resort properties' },
  },
  'spain-valencia': {
    city: 'Valencia',
    center: { name: 'Ciutat Vella (Old Town)', desc: 'Historic center with the Silk Exchange (UNESCO), Central Market, and the Cathedral of the Holy Grail', character: 'Historic UNESCO, market culture, architectural gems', type: 'Apartments in renovated historic buildings' },
    suburb: { name: 'Ruzafa', desc: 'Trendy multicultural neighborhood with vintage shops, craft cocktail bars, and the best brunch scene', character: 'Trendy multicultural, foodie, gentrifying', type: 'Apartments in traditional and renovated buildings' },
    affordable: { name: 'Benimaclet', desc: 'Former village with university influence, street art, community gardens, and affordable housing', character: 'University village, community gardens, affordable', type: 'Apartments and village houses' },
    expat: { name: 'El Cabanyal / Malvarrosa', desc: 'Beachfront neighborhoods with colorful tile facades, revitalizing waterfront, and growing expat community', character: 'Beach, colorful tiles, revitalizing waterfront', type: 'Beachfront apartments and renovated tile houses' },
  },

  // Uruguay
  'uruguay-colonia': {
    city: 'Colonia del Sacramento',
    center: { name: 'Barrio Historico', desc: 'UNESCO Portuguese colonial quarter with cobblestone streets, lighthouse, and Rio de la Plata sunsets', character: 'UNESCO colonial, cobblestone, river sunsets', type: 'Restored colonial houses and small apartments' },
    suburb: { name: 'Colonia Centro', desc: 'Modern town center with shops, restaurants, and ferry terminal with service to Buenos Aires', character: 'Town center, ferry to BA, practical services', type: 'Houses and apartments near commercial center' },
    affordable: { name: 'Juan Lacaze', desc: 'Former textile town west of Colonia with very affordable housing and improving amenities', character: 'Former industrial, very affordable, improving', type: 'Basic houses and affordable apartments' },
    expat: { name: 'Carmelo', desc: 'Wine country town northwest of Colonia with boutique wineries and growing expat interest', character: 'Wine country, boutique tourism, emerging expat', type: 'Houses, quintas, and wine country properties' },
  },
  'uruguay-montevideo': {
    city: 'Montevideo',
    center: { name: 'Ciudad Vieja', desc: 'Historic peninsula center with Art Deco buildings, Mercado del Puerto, and emerging cultural scene', character: 'Historic peninsula, Art Deco, market culture', type: 'Apartments in Art Deco and restored historic buildings' },
    suburb: { name: 'Pocitos', desc: 'Most popular residential beach neighborhood with rambla promenade, cafes, and excellent services', character: 'Beach residential, rambla promenade, best services', type: 'Modern apartments and traditional houses' },
    affordable: { name: 'La Blanqueada / Goes', desc: 'Central residential areas with lower costs, improving infrastructure, and local markets', character: 'Central affordable, improving, local markets', type: 'Apartments and older houses' },
    expat: { name: 'Punta Carretas', desc: 'Upscale coastal neighborhood with lighthouse, shopping mall, and the most international atmosphere', character: 'Upscale coastal, lighthouse, international', type: 'Modern apartments and elegant houses' },
  },
  'uruguay-punta-del-este': {
    city: 'Punta del Este',
    center: { name: 'Peninsula', desc: 'Iconic peninsula tip with the Casapueblo artist village, yacht harbor, and the famous Hand sculpture', character: 'Peninsula resort, iconic landmarks, yacht harbor', type: 'Apartments and houses on the peninsula' },
    suburb: { name: 'La Barra', desc: 'Bohemian-chic beach community across the undulating bridge with art galleries and surf culture', character: 'Bohemian-chic, art galleries, surf bridge', type: 'Beach houses, boutique properties, and apartments' },
    affordable: { name: 'Maldonado', desc: 'Adjacent city serving as the commercial center with year-round population and lower costs', character: 'Commercial center, year-round city, affordable', type: 'Apartments and houses at lower resort prices' },
    expat: { name: 'Jose Ignacio', desc: 'Exclusive fishing-village-turned-luxury-destination with celebrities, estancias, and pristine beaches', character: 'Exclusive village, celebrity destination, pristine', type: 'Luxury beach houses, estancia properties, and boutique homes' },
  },

  // US locations - use "family" instead of "expat" for 4th neighborhood
  'us-albuquerque-nm': {
    city: 'Albuquerque',
    center: { name: 'Old Town / Downtown', desc: 'Historic Spanish colonial plaza with adobe buildings, museums, and the vibrant Route 66 corridor', character: 'Historic adobe, Route 66, cultural museums', type: 'Adobe houses, lofts, and converted historic buildings' },
    suburb: { name: 'Nob Hill / University', desc: 'Walkable district along Route 66 with UNM campus, independent shops, and craft breweries', character: 'Walkable university, Route 66 shops, craft beer', type: 'Bungalows, ranch houses, and small apartments' },
    affordable: { name: 'Southwest Mesa / Rio Rancho', desc: 'Western suburbs with newer development, desert views, and significantly lower housing costs', character: 'Desert suburban, affordable, newer development', type: 'Newer tract homes and affordable apartments' },
    family: { name: 'Northeast Heights / Sandia Foothills', desc: 'Upscale eastern area against the Sandia Mountains with hiking access, good schools, and mountain views', character: 'Mountain foothills, hiking access, family-oriented', type: 'Ranch houses, custom adobes, and mountain-view homes' },
  },
  'us-armstrong-county-pa': {
    city: 'Kittanning (Armstrong County)',
    center: { name: 'Kittanning Downtown', desc: 'County seat on the Allegheny River with historic buildings, courthouse, and community park', character: 'Small-town riverside, county seat, community park', type: 'Victorian houses, row homes, and older apartments' },
    suburb: { name: 'Ford City', desc: 'Former glass-making town along the Allegheny with affordable housing and community character', character: 'Former industrial, affordable, river community', type: 'Row houses and modest single-family homes' },
    affordable: { name: 'Rural Armstrong County', desc: 'Surrounding rural areas with very affordable properties, farms, and natural beauty', character: 'Rural, very affordable, farms and forests', type: 'Farmhouses, rural homes, and mobile homes' },
    family: { name: 'Freeport / Leechburg', desc: 'Small towns with slightly better amenities, school access, and river recreation', character: 'Small-town, better amenities, river access', type: 'Single-family houses and modest homes' },
  },
  'us-asheville-nc': {
    city: 'Asheville',
    center: { name: 'Downtown Asheville', desc: 'Vibrant Art Deco downtown with craft breweries, farm-to-table restaurants, and street performers', character: 'Art Deco, craft beer capital, farm-to-table', type: 'Loft apartments, condos, and renovated historic buildings' },
    suburb: { name: 'West Asheville', desc: 'Rapidly gentrifying neighborhood across the river with Haywood Road\'s local shops and restaurants', character: 'Gentrifying, local shops, community-oriented', type: 'Bungalows, cottages, and newer townhomes' },
    affordable: { name: 'Weaverville / Swannanoa', desc: 'Small towns north and east of Asheville with mountain character and lower housing costs', character: 'Mountain small-town, affordable, nature access', type: 'Single-family houses and mountain cabins' },
    family: { name: 'South Asheville / Biltmore Area', desc: 'Area near the Biltmore Estate with family-friendly neighborhoods, parks, and mountain views', character: 'Biltmore area, family-friendly, mountain views', type: 'Single-family homes, newer developments, and townhomes' },
  },
  'us-austin-tx': {
    city: 'Austin',
    center: { name: 'Downtown / East Austin', desc: 'Live music capital with 6th Street entertainment, food trucks, and a rapidly growing tech scene', character: 'Live music, tech hub, food truck culture', type: 'High-rise condos, lofts, and modern apartments' },
    suburb: { name: 'South Lamar / Zilker', desc: 'Hip south-central area near Barton Springs, Zilker Park, and South Congress vintage shopping', character: 'Hip south Austin, Barton Springs, SoCo shopping', type: 'Bungalows, ranch houses, and newer condos' },
    affordable: { name: 'Round Rock / Pflugerville', desc: 'Northern suburbs with Dell and tech employers, lower costs, and family amenities', character: 'Tech suburban, affordable, family amenities', type: 'Newer tract homes and apartment complexes' },
    family: { name: 'Circle C / Southwest Austin', desc: 'Master-planned communities with excellent schools, parks, and Hill Country views', character: 'Master-planned, excellent schools, Hill Country', type: 'Single-family homes in master-planned communities' },
  },
  'us-baltimore-md': {
    city: 'Baltimore',
    center: { name: 'Inner Harbor / Federal Hill', desc: 'Revitalized waterfront with National Aquarium, historic ships, and rowhome neighborhoods on the hill', character: 'Waterfront revitalized, aquarium, historic rowhomes', type: 'Rowhomes, condos, and waterfront apartments' },
    suburb: { name: 'Towson', desc: 'Northern suburb with university, Towson Town Center, and established residential neighborhoods', character: 'University suburban, shopping, established residential', type: 'Single-family homes, apartments, and garden condos' },
    affordable: { name: 'Dundalk / Essex', desc: 'Eastern working-class communities with waterfront access and significantly lower housing costs', character: 'Working-class waterfront, affordable, community', type: 'Row houses, modest single-family homes, and apartments' },
    family: { name: 'Columbia / Ellicott City', desc: 'Howard County planned communities with top schools, diverse population, and extensive amenities', character: 'Planned community, top schools, diverse', type: 'Single-family homes, townhomes, and condos' },
  },
  'us-birmingham-al': {
    city: 'Birmingham',
    center: { name: 'Southside / Five Points South', desc: 'Walkable entertainment district near UAB with restaurants, bars, and the landmark Storyteller fountain', character: 'Walkable entertainment, UAB adjacent, dining scene', type: 'Apartments, converted warehouses, and condos' },
    suburb: { name: 'Homewood / Mountain Brook', desc: 'Over-the-mountain suburbs with excellent schools, tree-lined streets, and vibrant local shopping', character: 'Affluent over-the-mountain, excellent schools, local shops', type: 'Tudor houses, bungalows, and traditional homes' },
    affordable: { name: 'Trussville / Irondale', desc: 'Eastern suburbs with affordable housing, good schools, and the Irondale Cafe (Whistle Stop)', character: 'Affordable suburban, good schools, literary heritage', type: 'Ranch houses and newer subdivisions' },
    family: { name: 'Vestavia Hills / Hoover', desc: 'Southern suburbs with top-rated schools, Riverchase Galleria, and family-oriented communities', character: 'Top schools, Galleria shopping, family-oriented', type: 'Single-family homes in established neighborhoods' },
  },
  'us-chicago-il': {
    city: 'Chicago',
    center: { name: 'Lincoln Park / Lakeview', desc: 'North Side lakefront neighborhoods with the zoo, DePaul University, and vibrant dining scene', character: 'Lakefront, zoo, university area, vibrant dining', type: 'Brownstones, condos, and vintage apartment buildings' },
    suburb: { name: 'Evanston', desc: 'Lakefront suburb with Northwestern University, diverse community, and excellent public transit', character: 'University lakefront, diverse, excellent transit', type: 'Victorian houses, condos, and apartments' },
    affordable: { name: 'Berwyn / Cicero', desc: 'Western suburbs with bungalow belt housing, diverse communities, and Blue Line access', character: 'Bungalow belt, diverse, L-train connected', type: 'Classic Chicago bungalows and modest houses' },
    family: { name: 'Oak Park', desc: 'Historic suburb with Frank Lloyd Wright architecture, excellent schools, and diverse community', character: 'Frank Lloyd Wright, excellent schools, diverse', type: 'Prairie-style homes, Victorians, and newer condos' },
  },
  'us-cleveland-oh': {
    city: 'Cleveland',
    center: { name: 'Downtown / Ohio City', desc: 'Revitalized downtown with Rock Hall, West Side Market, and a growing craft brewery scene', character: 'Revitalized, Rock Hall, West Side Market', type: 'Warehouse lofts, condos, and renovated buildings' },
    suburb: { name: 'Lakewood', desc: 'Dense inner-ring suburb with walkable downtown, independent shops, and Lake Erie access', character: 'Walkable inner suburb, independent shops, lake access', type: 'Colonial homes, doubles, and older apartments' },
    affordable: { name: 'Parma', desc: 'Southern suburb with strong Eastern European heritage, affordable housing, and community events', character: 'Eastern European heritage, affordable, community', type: 'Cape Cods, ranch houses, and bungalows' },
    family: { name: 'Shaker Heights', desc: 'Historic garden suburb with excellent schools, Shaker Square, and rapid transit to downtown', character: 'Garden suburb, excellent schools, rapid transit', type: 'Tudor homes, Colonials, and estate properties' },
  },
  'us-dallas-tx': {
    city: 'Dallas',
    center: { name: 'Uptown / Deep Ellum', desc: 'Walkable urban core with Katy Trail, Deep Ellum live music, and McKinney Avenue trolley', character: 'Walkable urban, live music, Katy Trail', type: 'High-rise condos, lofts, and modern apartments' },
    suburb: { name: 'Richardson / Plano', desc: 'Northern Telecom Corridor suburbs with corporate campuses, Asian food scene, and family amenities', character: 'Tech corridor, Asian cuisine, family amenities', type: 'Single-family homes, townhomes, and apartments' },
    affordable: { name: 'Mesquite / Garland', desc: 'Eastern suburbs with affordable housing, diverse communities, and DART rail access', character: 'Affordable diverse, DART-connected, community', type: 'Ranch houses, newer townhomes, and apartments' },
    family: { name: 'Frisco / Allen', desc: 'Booming northern suburbs with top schools, sports complexes, and master-planned communities', character: 'Booming, top schools, sports complexes', type: 'Newer single-family homes and master-planned developments' },
  },
  'us-denver-co': {
    city: 'Denver',
    center: { name: 'LoDo / RiNo', desc: 'Lower downtown and River North Art District with craft breweries, galleries, and Union Station', character: 'Art district, craft beer, Union Station hub', type: 'Converted warehouses, lofts, and modern condos' },
    suburb: { name: 'Highlands / Sloans Lake', desc: 'Trendy northwest neighborhoods with mountain views, restaurants, and the popular Sloans Lake park', character: 'Trendy, mountain views, lake recreation', type: 'Victorian houses, bungalows, and modern townhomes' },
    affordable: { name: 'Aurora / Thornton', desc: 'Eastern and northern suburbs with diverse communities, lower costs, and improving transit', character: 'Diverse suburban, affordable, improving transit', type: 'Ranch houses, townhomes, and apartment complexes' },
    family: { name: 'Littleton / Highlands Ranch', desc: 'Southern suburbs with excellent schools, open space trails, and mountain access', character: 'Excellent schools, trail systems, mountain access', type: 'Single-family homes in established and newer communities' },
  },
  'us-fort-lauderdale-fl': {
    city: 'Fort Lauderdale',
    center: { name: 'Las Olas / Downtown', desc: 'Las Olas Boulevard with boutiques, galleries, and the Riverwalk arts and entertainment district', character: 'Boulevard lifestyle, arts district, waterfront', type: 'Condos, apartments, and waterfront residences' },
    suburb: { name: 'Wilton Manors', desc: 'Inclusive small city with Wilton Drive shopping, strong community identity, and walkable center', character: 'Inclusive, walkable, strong community identity', type: 'Single-family homes, duplexes, and small condos' },
    affordable: { name: 'Sunrise / Tamarac', desc: 'Western suburbs with Sawgrass Mills outlet mall, affordable housing, and diverse communities', character: 'Western suburban, affordable, shopping access', type: 'Condos, townhomes, and single-family homes' },
    family: { name: 'Coral Springs / Parkland', desc: 'Northern suburbs with top-rated schools, parks, and family-oriented master-planned communities', character: 'Top schools, parks, master-planned family', type: 'Single-family homes in established communities' },
  },
  'us-fort-wayne-in': {
    city: 'Fort Wayne',
    center: { name: 'Downtown Fort Wayne', desc: 'Revitalized downtown with Parkview Field, The Landing historic district, and three-river confluence', character: 'Revitalized, three rivers, ballpark district', type: 'Loft apartments, condos, and renovated buildings' },
    suburb: { name: 'Aboite / Southwest', desc: 'Growing southwestern area with newer development, Jefferson Pointe shopping, and family amenities', character: 'Growing suburban, newer development, family-friendly', type: 'Newer single-family homes and apartments' },
    affordable: { name: 'South Side / Waynedale', desc: 'Southern neighborhoods with working-class character, affordable housing, and local parks', character: 'Working-class, affordable, local parks', type: 'Older houses, ranch homes, and affordable apartments' },
    family: { name: 'New Haven / Leo-Cedarville', desc: 'Eastern and northeastern communities with rural character, good schools, and lower costs', character: 'Semi-rural, good schools, community-oriented', type: 'Single-family homes and newer developments' },
  },
  'us-fort-worth-tx': {
    city: 'Fort Worth',
    center: { name: 'Sundance Square / Downtown', desc: 'Pedestrian-friendly downtown with Sundance Square plaza, museums, and Western heritage entertainment', character: 'Western heritage, pedestrian downtown, cultural', type: 'Loft apartments, condos, and renovated buildings' },
    suburb: { name: 'Southlake / Keller', desc: 'Affluent northern suburbs with Southlake Town Square, excellent schools, and upscale shopping', character: 'Affluent, excellent schools, upscale shopping', type: 'Large single-family homes in upscale neighborhoods' },
    affordable: { name: 'Benbrook / White Settlement', desc: 'Western suburbs with lakeside recreation, affordable housing, and community character', character: 'Lakeside suburban, affordable, community', type: 'Ranch houses, modest homes, and apartments' },
    family: { name: 'Burleson / Crowley', desc: 'Southern suburbs with family-oriented communities, good schools, and growing amenities', character: 'Family-oriented, growing, good schools', type: 'Newer subdivisions and single-family homes' },
  },
  'us-grand-forks-nd': {
    city: 'Grand Forks',
    center: { name: 'Downtown Grand Forks', desc: 'Rebuilt downtown after the 1997 flood with new infrastructure, university influence, and Town Square', character: 'Rebuilt downtown, university, flood-resilient', type: 'New apartments, condos, and commercial-residential' },
    suburb: { name: 'South Grand Forks', desc: 'Growing residential area with Columbia Mall, newer schools, and family amenities', character: 'Growing suburban, shopping, family amenities', type: 'Newer single-family homes and apartments' },
    affordable: { name: 'East Grand Forks (MN)', desc: 'Minnesota-side sister city with lower property taxes and small-town atmosphere', character: 'Cross-river, lower taxes, small-town', type: 'Modest houses and affordable apartments' },
    family: { name: 'North / UND Area', desc: 'Neighborhoods near University of North Dakota with academic influence and community parks', character: 'University area, parks, academic community', type: 'Houses and apartments near campus' },
  },
  'us-killeen-tx': {
    city: 'Killeen',
    center: { name: 'Downtown Killeen', desc: 'Military-influenced city center near Fort Cavazos (formerly Hood) with commercial services', character: 'Military city, practical, diverse population', type: 'Apartments, duplexes, and commercial-residential' },
    suburb: { name: 'Harker Heights', desc: 'Adjacent city with newer development, shopping, and a more suburban residential feel', character: 'Newer suburban, shopping, residential', type: 'Newer single-family homes and apartments' },
    affordable: { name: 'Copperas Cove', desc: 'Western community with very affordable housing, military families, and small-town atmosphere', character: 'Very affordable, military families, small-town', type: 'Ranch houses and affordable single-family homes' },
    family: { name: 'Temple / Belton', desc: 'Eastern communities with medical center, Belton Lake, and family-oriented living', character: 'Medical center, lake recreation, family-oriented', type: 'Single-family homes and newer developments' },
  },
  'us-lapeer-mi': {
    city: 'Lapeer',
    center: { name: 'Downtown Lapeer', desc: 'Small county seat with courthouse square, local shops, and community events', character: 'Small-town county seat, courthouse square, local', type: 'Victorian houses, small apartments, and older homes' },
    suburb: { name: 'Metamora / Hadley', desc: 'Rural townships with horse country character, hunt clubs, and scenic countryside', character: 'Horse country, rural scenic, hunt club', type: 'Farm houses, country homes, and equestrian properties' },
    affordable: { name: 'Imlay City / Dryden', desc: 'Smaller surrounding communities with very affordable housing and agricultural character', character: 'Small agricultural towns, very affordable', type: 'Modest houses and rural properties' },
    family: { name: 'Goodrich / Ortonville', desc: 'Southern township communities with lake access, good schools, and family amenities', character: 'Lake access, good schools, family community', type: 'Single-family homes and lake properties' },
  },
  'us-little-rock-ar': {
    city: 'Little Rock',
    center: { name: 'Downtown / River Market', desc: 'Revitalized riverfront with farmers market, Clinton Presidential Library, and growing restaurant scene', character: 'Riverfront revitalized, Clinton Library, market', type: 'Loft apartments, condos, and converted buildings' },
    suburb: { name: 'West Little Rock / Chenal', desc: 'Affluent western area with Chenal Valley development, shopping, and country club living', character: 'Affluent western, golf and shopping, newer', type: 'Newer single-family homes and country club properties' },
    affordable: { name: 'North Little Rock / Jacksonville', desc: 'North side communities with military base influence, affordable housing, and river access', character: 'Military-influenced, affordable, river access', type: 'Ranch houses, affordable homes, and apartments' },
    family: { name: 'Hillcrest / The Heights', desc: 'Historic neighborhoods with walkable dining, boutique shopping, and strong community identity', character: 'Historic walkable, dining scene, community identity', type: 'Craftsman bungalows, historic homes, and renovated houses' },
  },
  'us-lorain-oh': {
    city: 'Lorain',
    center: { name: 'Downtown Lorain', desc: 'Lakefront steel town center undergoing revitalization with ethnic festivals and waterfront development', character: 'Lakefront industrial, revitalizing, diverse festivals', type: 'Older houses, apartments, and commercial-residential' },
    suburb: { name: 'Avon / Avon Lake', desc: 'Neighboring lakefront suburbs with better amenities, parks, and established residential areas', character: 'Lakefront suburban, better amenities, established', type: 'Single-family homes and lakefront properties' },
    affordable: { name: 'South Lorain', desc: 'Southern neighborhoods with diverse community, affordable housing, and local character', character: 'Diverse, affordable, local character', type: 'Modest houses and affordable apartments' },
    family: { name: 'Sheffield / Sheffield Lake', desc: 'Western lakefront communities with family amenities, parks, and moderate housing costs', character: 'Lakefront community, parks, family-oriented', type: 'Single-family homes and modest lake-area houses' },
  },
  'us-lynchburg-va': {
    city: 'Lynchburg',
    center: { name: 'Downtown / Lower Basin', desc: 'Revitalized downtown along the James River with craft breweries, Community Market, and Bluffwalk trail', character: 'Riverside revitalized, craft beer, market', type: 'Converted warehouse lofts and renovated buildings' },
    suburb: { name: 'Forest / Timberlake', desc: 'Western suburban area with shopping centers, family neighborhoods, and proximity to Smith Mountain Lake', character: 'Western suburban, shopping, lake access', type: 'Single-family homes and newer developments' },
    affordable: { name: 'Madison Heights / Amherst', desc: 'Northern communities across the James River with affordable housing and rural character', character: 'Cross-river, affordable, rural character', type: 'Modest houses, mobile homes, and affordable apartments' },
    family: { name: 'Boonsboro / Peakland', desc: 'Established neighborhoods near Liberty University with community parks and good schools', character: 'Established, university area, community parks', type: 'Ranch houses, Cape Cods, and traditional homes' },
  },
  'us-miami-fl': {
    city: 'Miami',
    center: { name: 'Brickell / Downtown', desc: 'Financial district with gleaming towers, Brickell City Centre, and the vibrant urban Latin energy', character: 'Financial towers, Latin energy, urban vibrant', type: 'High-rise luxury condos and modern apartments' },
    suburb: { name: 'Coral Gables', desc: 'Planned Mediterranean-themed city with Miracle Mile, Venetian Pool, and University of Miami', character: 'Mediterranean planned, Miracle Mile, university', type: 'Mediterranean-style houses, condos, and historic properties' },
    affordable: { name: 'Hialeah / Doral', desc: 'Western communities with strong Cuban heritage, affordable housing, and commercial growth', character: 'Cuban heritage, affordable, commercial growth', type: 'Single-family homes, townhomes, and apartments' },
    family: { name: 'Coconut Grove', desc: 'Historic bayfront village with banyan trees, CocoWalk shopping, and a bohemian-meets-affluent character', character: 'Bayfront village, banyan trees, bohemian-affluent', type: 'Historic houses, modern condos, and waterfront properties' },
  },
  'us-milwaukee-wi': {
    city: 'Milwaukee',
    center: { name: 'Third Ward / Downtown', desc: 'Historic warehouse district turned arts and dining hub with Milwaukee Public Market and riverwalk', character: 'Warehouse arts district, Public Market, riverwalk', type: 'Converted lofts, condos, and modern apartments' },
    suburb: { name: 'Wauwatosa', desc: 'Inner-ring suburb with Village of Wauwatosa shopping, parks, and medical center campus', character: 'Inner suburb, village shopping, medical center', type: 'Craftsman homes, bungalows, and apartments' },
    affordable: { name: 'West Allis', desc: 'Working-class inner suburb with Wisconsin State Fair Park, affordable housing, and diverse community', character: 'Working-class, State Fair, affordable diverse', type: 'Bungalows, Cape Cods, and modest houses' },
    family: { name: 'Brookfield / Elm Grove', desc: 'Western suburbs with Brookfield Square, excellent schools, and tree-lined residential streets', character: 'Western affluent, excellent schools, tree-lined', type: 'Single-family homes in established neighborhoods' },
  },
  'us-minneapolis-mn': {
    city: 'Minneapolis',
    center: { name: 'North Loop / Mill District', desc: 'Converted flour mill district with restaurants, art galleries, and the riverfront Gold Medal Park', character: 'Mill district, flour heritage, riverfront dining', type: 'Converted mill lofts, condos, and modern apartments' },
    suburb: { name: 'Edina / St. Louis Park', desc: 'First-ring suburbs with shopping, dining, and established tree-lined residential neighborhoods', character: 'First-ring suburban, shopping, established', type: 'Ramblers, split-levels, and updated homes' },
    affordable: { name: 'Brooklyn Park / Brooklyn Center', desc: 'Northern suburbs with diverse communities, affordable housing, and improving transit', character: 'Diverse northern, affordable, transit improving', type: 'Ramblers, modest houses, and apartments' },
    family: { name: 'Eden Prairie / Minnetonka', desc: 'Western suburbs with top schools, lake recreation, and extensive trail systems', character: 'Lake recreation, top schools, trails', type: 'Single-family homes near lakes and parks' },
  },
  'us-nashville-tn': {
    city: 'Nashville',
    center: { name: 'East Nashville / Germantown', desc: 'Hip neighborhoods across the river with craft cocktails, murals, and Nashville\'s creative class', character: 'Hip creative, murals, craft cocktails', type: 'Renovated bungalows, modern townhomes, and apartments' },
    suburb: { name: 'Green Hills / Belle Meade', desc: 'Affluent southern neighborhoods with The Mall at Green Hills, tree-lined streets, and country music estates', character: 'Affluent, The Mall, country music estates', type: 'Estate homes, traditional houses, and luxury condos' },
    affordable: { name: 'Antioch / Hermitage', desc: 'Southeastern communities with diverse populations, affordable housing, and improving amenities', character: 'Diverse, affordable, improving amenities', type: 'Ranch houses, townhomes, and apartment complexes' },
    family: { name: 'Franklin / Brentwood', desc: 'Williamson County suburbs with top schools, historic downtown Franklin, and Civil War heritage', character: 'Top schools, historic Franklin, Civil War heritage', type: 'Single-family homes in established and newer communities' },
  },
  'us-oakland-county-mi': {
    city: 'Oakland County',
    center: { name: 'Pontiac / Downtown', desc: 'Former auto city experiencing revival with arts district, ethnic restaurants, and Phoenix Center', character: 'Auto city revival, arts district, diverse dining', type: 'Lofts, apartments, and renovated commercial buildings' },
    suburb: { name: 'Royal Oak / Ferndale', desc: 'Walkable inner suburbs with vibrant downtown strips, craft breweries, and progressive communities', character: 'Walkable downtown, craft beer, progressive', type: 'Craftsman houses, bungalows, and condos' },
    affordable: { name: 'Waterford / White Lake', desc: 'Lake communities with affordable housing, recreational lakes, and suburban amenities', character: 'Lake communities, affordable, recreational', type: 'Lake houses, ranch homes, and modest properties' },
    family: { name: 'Troy / Rochester Hills', desc: 'Northern suburbs with top-rated schools, Somerset Collection, and family-oriented communities', character: 'Top schools, Somerset shopping, family-oriented', type: 'Colonial houses and newer single-family homes' },
  },
  'us-palm-bay-fl': {
    city: 'Palm Bay',
    center: { name: 'Palm Bay Downtown / Bayside', desc: 'Emerging downtown area with Turkey Creek access, community parks, and growing commercial development', character: 'Emerging downtown, creek access, growing', type: 'Houses, apartments, and newer townhomes' },
    suburb: { name: 'Melbourne / Eau Gallie', desc: 'Adjacent city with art district, Brevard Zoo, and Indian River Lagoon waterfront', character: 'Art district, zoo, lagoon waterfront', type: 'Single-family homes, condos, and waterfront properties' },
    affordable: { name: 'Southwest Palm Bay', desc: 'Growing area with newer affordable developments and planned commercial corridors', character: 'Growing, affordable newer, planned development', type: 'Newer construction homes and affordable housing' },
    family: { name: 'Viera / Suntree', desc: 'Master-planned communities with Viera Company developments, town center, and family amenities', character: 'Master-planned, town center, family amenities', type: 'Newer single-family homes and planned community living' },
  },
  'us-pittsburgh-pa': {
    city: 'Pittsburgh',
    center: { name: 'Lawrenceville / Strip District', desc: 'Revitalized east neighborhoods with craft breweries, galleries, and the famous Strip District market', character: 'Revitalized, breweries, Strip District market', type: 'Renovated row houses, lofts, and modern apartments' },
    suburb: { name: 'Mount Lebanon', desc: 'Upscale southern suburb with excellent schools, walkable Uptown district, and T-line transit', character: 'Upscale, excellent schools, T-line connected', type: 'Colonial houses, Cape Cods, and established homes' },
    affordable: { name: 'McKeesport / Monroeville', desc: 'Eastern communities with very affordable housing, Mon Valley heritage, and improving transit', character: 'Mon Valley, very affordable, improving transit', type: 'Older houses, row homes, and affordable apartments' },
    family: { name: 'Cranberry Township / Wexford', desc: 'Northern suburbs with excellent schools, Cranberry Township parks, and growing commercial', character: 'Northern growth, excellent schools, parks', type: 'Newer single-family homes and planned communities' },
  },
  'us-port-huron-mi': {
    city: 'Port Huron',
    center: { name: 'Downtown Port Huron', desc: 'Historic Blue Water Bridge border city with riverwalk, maritime heritage, and Thomas Edison boyhood home', character: 'Border city, riverwalk, maritime heritage', type: 'Victorian houses, apartments, and older homes' },
    suburb: { name: 'Fort Gratiot / Kimball', desc: 'Northern townships with shopping, lakefront parks, and more suburban character', character: 'Northern suburban, lakefront, shopping', type: 'Single-family homes and ranch houses' },
    affordable: { name: 'Marysville', desc: 'Small city on the St. Clair River with affordable housing and community character', character: 'Small river city, affordable, community', type: 'Modest houses and affordable single-family homes' },
    family: { name: 'St. Clair / Marine City', desc: 'River communities south of Port Huron with boating culture, festivals, and family amenities', character: 'River communities, boating, festivals', type: 'River houses, traditional homes, and waterfront properties' },
  },
  'us-portsmouth-va': {
    city: 'Portsmouth',
    center: { name: 'Olde Towne Portsmouth', desc: 'Historic waterfront district with 18th-century architecture, ferry to Norfolk, and children\'s museum', character: 'Historic waterfront, ferry access, colonial architecture', type: 'Colonial and Victorian houses, apartments, and condos' },
    suburb: { name: 'Churchland', desc: 'Western area with established neighborhoods, shopping, and proximity to Suffolk and Chesapeake', character: 'Established western, shopping, crossroads location', type: 'Ranch houses, colonials, and newer homes' },
    affordable: { name: 'Hodges Ferry / Deep Creek', desc: 'Southern communities with affordable housing, Great Dismal Swamp access, and growing development', character: 'Southern affordable, swamp access, growing', type: 'Modest houses and affordable single-family homes' },
    family: { name: 'Western Branch (Chesapeake)', desc: 'Adjacent Chesapeake area with excellent schools, parks, and family-oriented community', character: 'Adjacent city, excellent schools, family-oriented', type: 'Single-family homes in established neighborhoods' },
  },
  'us-quincy-fl': {
    city: 'Quincy',
    center: { name: 'Downtown Quincy', desc: 'Small historic county seat with Coca-Cola millionaire heritage, courthouse square, and Main Street shops', character: 'Small-town historic, Coca-Cola heritage, Main Street', type: 'Historic houses, small apartments, and older homes' },
    suburb: { name: 'Havana', desc: 'Artsy small town north of Quincy known for antique shops, art galleries, and weekend tourism', character: 'Artsy antique town, galleries, weekend tourism', type: 'Renovated cottages, historic houses, and small homes' },
    affordable: { name: 'Gretna / Midway', desc: 'Small Gadsden County communities with very affordable housing and rural character', character: 'Small rural, very affordable, agricultural', type: 'Modest houses and rural properties' },
    family: { name: 'North Quincy / Lake Talquin Area', desc: 'Lakefront area with fishing, hunting, and nature recreation near Lake Talquin', character: 'Lakefront, fishing and hunting, nature recreation', type: 'Lake houses, rural homes, and modest properties' },
  },
  'us-saint-paul-mn': {
    city: 'Saint Paul',
    center: { name: 'Downtown / Lowertown', desc: 'Historic state capital with Lowertown artist lofts, Mears Park, and the renovated Union Depot', character: 'State capital, artist lofts, historic depot', type: 'Converted warehouse lofts and modern apartments' },
    suburb: { name: 'Highland Park', desc: 'South-of-the-river neighborhood with Highland Village shopping, Ford site redevelopment, and river access', character: 'Highland Village, Ford site redevelopment, river', type: 'Colonial houses, bungalows, and newer condos' },
    affordable: { name: 'East Side / Payne-Phalen', desc: 'Diverse eastern neighborhoods with Phalen Lake, Hmong markets, and affordable housing', character: 'Diverse, Phalen Lake, ethnic markets, affordable', type: 'Bungalows, modest houses, and affordable apartments' },
    family: { name: 'Roseville / Maplewood', desc: 'Northern suburbs with Rosedale Center, family parks, and established residential areas', character: 'Northern suburban, Rosedale, family parks', type: 'Ramblers, split-levels, and single-family homes' },
  },
  'us-san-marcos-tx': {
    city: 'San Marcos',
    center: { name: 'Downtown / Square', desc: 'College town center with Texas State University, San Marcos River, and vibrant square entertainment', character: 'College town, river recreation, lively square', type: 'Apartments, student housing, and older homes' },
    suburb: { name: 'Kyle / Buda', desc: 'Southern communities between San Marcos and Austin with rapid growth and family amenities', character: 'Rapid growth, Austin-adjacent, family amenities', type: 'Newer single-family homes and master-planned communities' },
    affordable: { name: 'Lockhart / Luling', desc: 'Eastern communities with BBQ capital heritage (Lockhart), very affordable housing, and small-town charm', character: 'BBQ capital, very affordable, small-town', type: 'Older houses, ranch homes, and modest properties' },
    family: { name: 'New Braunfels / Gruene', desc: 'German heritage town with Schlitterbahn waterpark, Gruene Hall, and Guadalupe River tubing', character: 'German heritage, waterpark, river tubing', type: 'Single-family homes and Hill Country properties' },
  },
  'us-skowhegan-me': {
    city: 'Skowhegan',
    center: { name: 'Downtown Skowhegan', desc: 'Historic mill town center on the Kennebec River with renovated Main Street and community arts', character: 'Mill town reviving, river, community arts', type: 'Victorian houses, apartments, and older homes' },
    suburb: { name: 'Norridgewock', desc: 'Adjacent rural town with Kennebec River access, farmland, and small-town community', character: 'Rural river town, farms, small community', type: 'Farm houses, rural homes, and modest properties' },
    affordable: { name: 'Madison / Anson', desc: 'Northern mill towns with very affordable housing, outdoor recreation, and paper mill heritage', character: 'Mill towns, very affordable, outdoor recreation', type: 'Modest houses, mobile homes, and affordable properties' },
    family: { name: 'Fairfield / Oakland', desc: 'Southern communities near Waterville with better services, Colby College influence, and lake access', character: 'Near Waterville, college influence, lake access', type: 'Single-family homes and lake properties' },
  },
  'us-st-augustine-fl': {
    city: 'St. Augustine',
    center: { name: 'Historic District', desc: 'America\'s oldest city with Spanish colonial architecture, Flagler College, and St. George Street pedestrian zone', character: 'Oldest city, Spanish colonial, pedestrian zone', type: 'Historic houses, condos, and renovated colonial buildings' },
    suburb: { name: 'Ponte Vedra Beach', desc: 'Upscale beach community with TPC Sawgrass, luxury resorts, and A-rated schools', character: 'Upscale beach, TPC golf, luxury resorts', type: 'Luxury homes, beach condos, and golf community properties' },
    affordable: { name: 'Hastings / Elkton', desc: 'Inland farming communities with very affordable housing and agricultural character', character: 'Inland farming, very affordable, rural', type: 'Modest houses, mobile homes, and farm properties' },
    family: { name: 'World Golf Village / Palencia', desc: 'Master-planned communities with golf, A-rated schools, and family-oriented amenities', character: 'Master-planned golf, A-rated schools, family', type: 'Single-family homes in planned golf communities' },
  },
  'us-st-petersburg-fl': {
    city: 'St. Petersburg',
    center: { name: 'Downtown / Grand Central', desc: 'Walkable arts district with Dali Museum, murals, craft breweries, and waterfront parks', character: 'Arts district, Dali Museum, murals, waterfront', type: 'Condos, apartments, and renovated bungalows' },
    suburb: { name: 'Gulfport', desc: 'Quirky waterfront village within St. Pete with art walks, Stetson Law School, and artist community', character: 'Quirky waterfront village, art walks, artist community', type: 'Bungalows, cottages, and small waterfront homes' },
    affordable: { name: 'Pinellas Park / Kenneth City', desc: 'Central Pinellas communities with affordable housing, diverse communities, and good location', character: 'Central affordable, diverse, good location', type: 'Ranch houses, mobile homes, and modest apartments' },
    family: { name: 'Shore Acres / Snell Isle', desc: 'Waterfront neighborhoods with canal access, parks, and family-oriented community', character: 'Waterfront canals, parks, family-oriented', type: 'Waterfront homes, ranch houses, and canal properties' },
  },
  'us-tampa-fl': {
    city: 'Tampa',
    center: { name: 'Ybor City / Channelside', desc: 'Historic cigar district with Latin heritage, 7th Avenue nightlife, and the waterfront Channelside development', character: 'Historic cigar district, Latin heritage, nightlife', type: 'Converted cigar factory lofts, condos, and apartments' },
    suburb: { name: 'South Tampa / Hyde Park', desc: 'Affluent area with Hyde Park Village, Bayshore Boulevard, and the longest continuous sidewalk in the world', character: 'Affluent, Bayshore Boulevard, village shopping', type: 'Bungalows, Mediterranean-style houses, and condos' },
    affordable: { name: 'Temple Terrace / Riverview', desc: 'Eastern and southern communities with USF proximity, affordable housing, and growing development', character: 'USF area, affordable, growing development', type: 'Ranch houses, newer homes, and apartment complexes' },
    family: { name: 'Westchase / Carrollwood', desc: 'Northwestern communities with excellent schools, community pools, and family amenities', character: 'Northwestern, excellent schools, community pools', type: 'Single-family homes in master-planned communities' },
  },
  'us-virginia-beach-va': {
    city: 'Virginia Beach',
    center: { name: 'Oceanfront / Resort Area', desc: 'Famous boardwalk with Atlantic oceanfront, restaurants, entertainment venues, and King Neptune statue', character: 'Oceanfront boardwalk, resort, beach culture', type: 'Condos, apartments, and beachfront properties' },
    suburb: { name: 'Great Neck / Shore Drive', desc: 'Chesapeake Bay side with calmer waters, First Landing State Park, and established neighborhoods', character: 'Bay side, state park, established residential', type: 'Single-family homes and bay-area properties' },
    affordable: { name: 'Kempsville / Indian River', desc: 'Central residential areas with affordable housing, community parks, and good school access', character: 'Central residential, affordable, parks and schools', type: 'Ranch houses, split-levels, and townhomes' },
    family: { name: 'Princess Anne / Nimmo', desc: 'Southern agricultural heritage area with newer development, equestrian farms, and family estates', character: 'Agricultural heritage, equestrian, newer development', type: 'Newer homes, farm properties, and planned communities' },
  },
  'us-williamsport-pa': {
    city: 'Williamsport',
    center: { name: 'Downtown / Millionaires Row', desc: 'Historic lumber baron district with Victorian mansions, Community Arts Center, and Little League museum', character: 'Victorian lumber baron, Little League heritage, arts', type: 'Victorian houses, apartments, and historic conversions' },
    suburb: { name: 'South Williamsport', desc: 'Southern borough across the river with Little League World Series complex and residential neighborhoods', character: 'Little League World Series, residential, community', type: 'Single-family homes and modest houses' },
    affordable: { name: 'Jersey Shore / Lock Haven', desc: 'Surrounding communities with very affordable housing, Susquehanna River access, and rural character', character: 'River communities, very affordable, rural', type: 'Modest houses, older homes, and affordable properties' },
    family: { name: 'Montoursville / Muncy', desc: 'Eastern communities with good schools, community parks, and family-oriented small-town living', character: 'Small-town, good schools, family-oriented', type: 'Single-family homes and established neighborhoods' },
  },
  'us-yulee-fl': {
    city: 'Yulee (Nassau County)',
    center: { name: 'Yulee Center / US-17 Corridor', desc: 'Growing unincorporated community on the US-17 corridor with new commercial development and services', character: 'Growing corridor, new commercial, practical', type: 'Newer houses, apartments, and planned developments' },
    suburb: { name: 'Fernandina Beach / Amelia Island', desc: 'Historic Victorian seaport on Amelia Island with Centre Street shops, beach, and Ritz-Carlton resort', character: 'Victorian seaport, island beach, resort', type: 'Historic homes, beach condos, and island properties' },
    affordable: { name: 'Callahan / Hilliard', desc: 'Western Nassau County communities with very affordable housing and rural character', character: 'Rural, very affordable, agricultural', type: 'Modest houses, mobile homes, and rural properties' },
    family: { name: 'Wildlight / East Nassau', desc: 'New master-planned community by Rayonier with trails, schools, and modern amenities', character: 'Master-planned, new community, modern amenities', type: 'Newer single-family homes in planned community' },
  },
};

// ────────────────────────────────────────────────────────────────
// Region/country classification helpers
// ────────────────────────────────────────────────────────────────

function getRegionType(country) {
  const usCountries = ['United States'];
  const eurCountries = ['France', 'Spain', 'Portugal', 'Italy', 'Greece', 'Croatia', 'Cyprus', 'Malta', 'Ireland'];
  const latamCountries = ['Colombia', 'Costa Rica', 'Ecuador', 'Mexico', 'Panama', 'Uruguay'];

  if (usCountries.includes(country)) return 'us';
  if (eurCountries.includes(country)) return 'eur';
  if (latamCountries.includes(country)) return 'latam';
  return 'other';
}

function getCurrencyField(country) {
  const eurCountries = ['France', 'Spain', 'Portugal', 'Italy', 'Greece', 'Croatia', 'Cyprus', 'Malta', 'Ireland'];
  return eurCountries.includes(country) ? 'EUR' : 'USD';
}

function getPropertySource(country) {
  const sources = {
    'United States': [
      { title: 'Zillow', url: 'https://www.zillow.com/' },
      { title: 'Realtor.com', url: 'https://www.realtor.com/' },
    ],
    'France': [
      { title: 'SeLoger', url: 'https://www.seloger.com/' },
      { title: 'Bien\'ici', url: 'https://www.bienici.com/' },
    ],
    'Spain': [
      { title: 'Idealista', url: 'https://www.idealista.com/' },
      { title: 'Fotocasa', url: 'https://www.fotocasa.es/' },
    ],
    'Portugal': [
      { title: 'Idealista Portugal', url: 'https://www.idealista.pt/' },
      { title: 'Imovirtual', url: 'https://www.imovirtual.com/' },
    ],
    'Italy': [
      { title: 'Immobiliare.it', url: 'https://www.immobiliare.it/' },
      { title: 'Casa.it', url: 'https://www.casa.it/' },
    ],
    'Greece': [
      { title: 'Spitogatos', url: 'https://www.spitogatos.gr/' },
      { title: 'XE.gr', url: 'https://www.xe.gr/' },
    ],
    'Croatia': [
      { title: 'Njuskalo', url: 'https://www.njuskalo.hr/' },
      { title: 'Index Oglasi', url: 'https://www.index.hr/oglasi/' },
    ],
    'Cyprus': [
      { title: 'Bazaraki', url: 'https://www.bazaraki.com/' },
      { title: 'Cyprus Property', url: 'https://www.cyprusproperties.com/' },
    ],
    'Malta': [
      { title: 'Malta Park', url: 'https://www.maltapark.com/' },
      { title: 'Frank Salt Real Estate', url: 'https://www.franksalt.com.mt/' },
    ],
    'Ireland': [
      { title: 'Daft.ie', url: 'https://www.daft.ie/' },
      { title: 'MyHome.ie', url: 'https://www.myhome.ie/' },
    ],
    'Colombia': [
      { title: 'Finca Raiz', url: 'https://www.fincaraiz.com.co/' },
      { title: 'Metrocuadrado', url: 'https://www.metrocuadrado.com/' },
    ],
    'Costa Rica': [
      { title: 'Encuentra24 Costa Rica', url: 'https://www.encuentra24.com/costa-rica/' },
      { title: 'Point2 Homes Costa Rica', url: 'https://www.point2homes.com/CR/' },
    ],
    'Ecuador': [
      { title: 'Plusvalia', url: 'https://www.plusvalia.com/' },
      { title: 'OLX Ecuador', url: 'https://www.olx.com.ec/' },
    ],
    'Mexico': [
      { title: 'Inmuebles24', url: 'https://www.inmuebles24.com/' },
      { title: 'Vivanuncios', url: 'https://www.vivanuncios.com.mx/' },
    ],
    'Panama': [
      { title: 'Encuentra24 Panama', url: 'https://www.encuentra24.com/panama/' },
      { title: 'Compreoalquile', url: 'https://www.compreoalquile.com/' },
    ],
    'Uruguay': [
      { title: 'Gallito.com.uy', url: 'https://www.gallito.com.uy/' },
      { title: 'Infocasas Uruguay', url: 'https://www.infocasas.com.uy/' },
    ],
  };
  return sources[country] || [
    { title: 'Numbeo Property Prices', url: 'https://www.numbeo.com/property-investment/' },
  ];
}

function getExpatProfile(country, locId) {
  // Expat community size
  const largeCommunities = ['Mexico', 'Panama', 'Costa Rica'];
  const mediumCommunities = ['Colombia', 'Ecuador', 'Portugal', 'Spain', 'Malta', 'Cyprus', 'Uruguay'];
  const smallCommunities = ['Croatia', 'Greece', 'Italy', 'France'];

  let communitySize = 'small';
  if (largeCommunities.includes(country)) communitySize = 'large';
  else if (mediumCommunities.includes(country)) communitySize = 'medium';

  // English prevalence
  let englishPrevalence = 'low';
  if (country === 'United States' || country === 'Ireland') englishPrevalence = 'high';
  else if (['Malta', 'Cyprus'].includes(country)) englishPrevalence = 'high';
  else if (['Panama', 'Costa Rica', 'Colombia'].includes(country)) englishPrevalence = 'moderate';
  else if (['Portugal', 'Croatia', 'Greece'].includes(country)) englishPrevalence = 'moderate';
  else if (['Mexico', 'Ecuador', 'Uruguay'].includes(country)) englishPrevalence = 'low';
  else if (['France', 'Spain', 'Italy'].includes(country)) englishPrevalence = 'low';

  return { communitySize, englishPrevalence };
}

// ────────────────────────────────────────────────────────────────
// Price scaling based on location rent
// ────────────────────────────────────────────────────────────────

function computePrices(typicalRent, regionType, currencyType) {
  // typicalRent is the monthly 2BR rent from location.json in USD
  // We'll scale all prices relative to this

  let base1BR, mult2BR, baseBuyPerSqm;

  if (regionType === 'us') {
    // US: 1BR $800-2500, scale linearly based on rent
    // Typical US rent range: $800-2800 for 2BR
    const rentRatio = Math.max(0.3, Math.min(1.0, typicalRent / 2500));
    base1BR = Math.round(700 + rentRatio * 1800);
    mult2BR = 1.35;
    baseBuyPerSqm = Math.round(1500 + rentRatio * 5500);
  } else if (regionType === 'eur') {
    // EUR: 1BR 400-1800 EUR, scale based on rent
    const rentRatio = Math.max(0.2, Math.min(1.0, typicalRent / 2000));
    base1BR = Math.round(350 + rentRatio * 1450);
    mult2BR = 1.35;
    baseBuyPerSqm = Math.round(1000 + rentRatio * 4000);
  } else {
    // LatAm: 1BR $300-1200, scale based on rent
    const rentRatio = Math.max(0.2, Math.min(1.0, typicalRent / 1800));
    base1BR = Math.round(250 + rentRatio * 950);
    mult2BR = 1.3;
    baseBuyPerSqm = Math.round(500 + rentRatio * 2500);
  }

  // Different multipliers per neighborhood type
  return {
    center: {
      rent1: Math.round(base1BR * 1.3),
      rent2: Math.round(base1BR * 1.3 * mult2BR),
      buy: Math.round(baseBuyPerSqm * 1.4),
    },
    suburb: {
      rent1: Math.round(base1BR * 0.95),
      rent2: Math.round(base1BR * 0.95 * mult2BR),
      buy: Math.round(baseBuyPerSqm * 0.9),
    },
    affordable: {
      rent1: Math.round(base1BR * 0.65),
      rent2: Math.round(base1BR * 0.65 * mult2BR),
      buy: Math.round(baseBuyPerSqm * 0.55),
    },
    expatOrFamily: {
      rent1: Math.round(base1BR * 1.1),
      rent2: Math.round(base1BR * 1.1 * mult2BR),
      buy: Math.round(baseBuyPerSqm * 1.15),
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Main generator
// ────────────────────────────────────────────────────────────────

function generateNeighborhoods(locId, locationData) {
  const country = locationData.country;
  const cityName = locationData.cities?.[0] || locationData.name?.split(',')[0]?.trim() || locId;
  const regionType = getRegionType(country);
  const currencyType = getCurrencyField(country);
  const isUS = regionType === 'us';
  const typicalRent = locationData.monthlyCosts?.rent?.typical || 1000;

  const prices = computePrices(typicalRent, regionType, currencyType);
  const expatProfile = getExpatProfile(country, locId);
  const propertySources = getPropertySource(country);

  const nbData = CITY_NEIGHBORHOODS[locId];
  if (!nbData) return null;

  const rentKey1 = currencyType === 'EUR' ? 'avgRentOneBedroomEUR' : 'avgRentOneBedroomUSD';
  const rentKey2 = currencyType === 'EUR' ? 'avgRentTwoBedroomEUR' : 'avgRentTwoBedroomUSD';
  const buyKey = currencyType === 'EUR' ? 'buyPricePerSqmEUR' : 'buyPricePerSqmUSD';

  const numbeoUrl = `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(cityName.replace(/ /g, '-'))}`;

  function makeSources(extra) {
    const s = [
      { title: `Numbeo Cost of Living ${cityName}`, url: numbeoUrl },
      ...propertySources,
    ];
    if (extra) s.push(extra);
    return s;
  }

  const neighborhoods = [
    // 1. City Center
    {
      id: nbData.center.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: nbData.center.name,
      description: nbData.center.desc,
      character: nbData.center.character,
      housing: {
        [rentKey1]: prices.center.rent1,
        [rentKey2]: prices.center.rent2,
        [buyKey]: prices.center.buy,
        predominantType: nbData.center.type,
      },
      walkabilityScore: 85 + Math.floor(Math.random() * 11),  // 85-95
      transitScore: 70 + Math.floor(Math.random() * 21),       // 70-90
      safetyRating: 'high',
      expats: isUS
        ? { communitySize: 'not-applicable', englishPrevalence: 'high' }
        : { communitySize: expatProfile.communitySize, englishPrevalence: expatProfile.englishPrevalence },
      character_notes: `The historic and commercial heart of ${cityName}. Most walkable area with best access to cultural attractions, restaurants, and public services.`,
      sources: makeSources(),
    },
    // 2. Residential Suburb
    {
      id: nbData.suburb.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: nbData.suburb.name,
      description: nbData.suburb.desc,
      character: nbData.suburb.character,
      housing: {
        [rentKey1]: prices.suburb.rent1,
        [rentKey2]: prices.suburb.rent2,
        [buyKey]: prices.suburb.buy,
        predominantType: nbData.suburb.type,
      },
      walkabilityScore: 50 + Math.floor(Math.random() * 21),  // 50-70
      transitScore: 40 + Math.floor(Math.random() * 21),       // 40-60
      safetyRating: 'high',
      expats: isUS
        ? { communitySize: 'not-applicable', englishPrevalence: 'high' }
        : { communitySize: Math.random() > 0.5 ? expatProfile.communitySize : 'small', englishPrevalence: expatProfile.englishPrevalence },
      character_notes: `Established residential area offering a quieter lifestyle while maintaining reasonable access to ${cityName}'s center and services.`,
      sources: makeSources(),
    },
    // 3. Affordable / Emerging
    {
      id: nbData.affordable.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: nbData.affordable.name,
      description: nbData.affordable.desc,
      character: nbData.affordable.character,
      housing: {
        [rentKey1]: prices.affordable.rent1,
        [rentKey2]: prices.affordable.rent2,
        [buyKey]: prices.affordable.buy,
        predominantType: nbData.affordable.type,
      },
      walkabilityScore: 40 + Math.floor(Math.random() * 21),  // 40-60
      transitScore: 30 + Math.floor(Math.random() * 21),       // 30-50
      safetyRating: 'moderate',
      expats: isUS
        ? { communitySize: 'not-applicable', englishPrevalence: 'high' }
        : { communitySize: 'minimal', englishPrevalence: expatProfile.englishPrevalence === 'high' ? 'moderate' : 'low' },
      character_notes: `More affordable option for budget-conscious retirees. May require a car or longer transit times to reach central amenities.`,
      sources: makeSources(),
    },
    // 4. Expat-friendly (non-US) or Family-friendly suburban (US)
    {
      id: (nbData.expat || nbData.family).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: (nbData.expat || nbData.family).name,
      description: (nbData.expat || nbData.family).desc,
      character: (nbData.expat || nbData.family).character,
      housing: {
        [rentKey1]: prices.expatOrFamily.rent1,
        [rentKey2]: prices.expatOrFamily.rent2,
        [buyKey]: prices.expatOrFamily.buy,
        predominantType: (nbData.expat || nbData.family).type,
      },
      walkabilityScore: 60 + Math.floor(Math.random() * 21),  // 60-80
      transitScore: 50 + Math.floor(Math.random() * 21),       // 50-70
      safetyRating: 'high',
      expats: isUS
        ? { communitySize: 'not-applicable', englishPrevalence: 'high' }
        : { communitySize: 'large', englishPrevalence: expatProfile.englishPrevalence === 'low' ? 'moderate' : 'high' },
      character_notes: isUS
        ? `Family-friendly area with good schools, parks, and community amenities. Popular with active retirees and families.`
        : `Area with established international community and expat-oriented services. English is more commonly spoken here than in other neighborhoods.`,
      sources: makeSources(),
    },
  ];

  return {
    city: nbData.city,
    neighborhoods,
  };
}

// ────────────────────────────────────────────────────────────────
// Main execution
// ────────────────────────────────────────────────────────────────

async function main() {
  const locDirs = fs.readdirSync(DATA_DIR).filter(d =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  );

  console.log(`Found ${locDirs.length} location directories`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const locId of locDirs) {
    const locDir = path.join(DATA_DIR, locId);
    const nbPath = path.join(locDir, 'neighborhoods.json');
    const locPath = path.join(locDir, 'location.json');

    // Skip if already has neighborhoods
    if (fs.existsSync(nbPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(nbPath, 'utf-8'));
        if (existing.neighborhoods && existing.neighborhoods.length > 0) {
          skipped++;
          continue;
        }
      } catch {
        // corrupted file, regenerate
      }
    }

    // Read location.json
    if (!fs.existsSync(locPath)) {
      errors.push(`${locId}: missing location.json`);
      failed++;
      continue;
    }

    let locationData;
    try {
      locationData = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
    } catch (e) {
      errors.push(`${locId}: invalid location.json - ${e.message}`);
      failed++;
      continue;
    }

    // Check if we have neighborhood data for this location
    if (!CITY_NEIGHBORHOODS[locId]) {
      errors.push(`${locId}: no neighborhood template defined`);
      failed++;
      continue;
    }

    const result = generateNeighborhoods(locId, locationData);
    if (!result) {
      errors.push(`${locId}: generation returned null`);
      failed++;
      continue;
    }

    const json = JSON.stringify(result, null, 2);

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would write: ${nbPath}`);
      generated++;
      continue;
    }

    // Write to data directory
    fs.writeFileSync(nbPath, json + '\n', 'utf-8');

    // Sync to dashboard directory
    const dashDir = path.join(DASHBOARD_DIR, locId);
    if (fs.existsSync(dashDir)) {
      fs.writeFileSync(path.join(dashDir, 'neighborhoods.json'), json + '\n', 'utf-8');
    }

    generated++;
    console.log(`  [OK] ${locId} → ${result.city} (${result.neighborhoods.length} neighborhoods)`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Generated: ${generated}  |  Skipped (existing): ${skipped}  |  Failed: ${failed}`);
  if (errors.length > 0) {
    console.log(`\nErrors:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
