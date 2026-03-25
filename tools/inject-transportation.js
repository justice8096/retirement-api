#!/usr/bin/env node
/**
 * inject-transportation.js
 *
 * Adds detailed transportation cost data to all locations missing it
 * in their detailed-costs.json files. Uses country-specific templates
 * with all costs in USD. Syncs output to packages/dashboard/public/data/locations/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data/locations');
const DASH_DIR = path.join(ROOT, 'packages/dashboard/public/data/locations');

// ────────────────────────────────────────────────────────────────
// Country-specific transportation templates
// All costs in USD
// ────────────────────────────────────────────────────────────────

const COUNTRY_TEMPLATES = {
  'United States': {
    monthlyPass:        { min: 50,  max: 130 },
    seniorDiscount:     0.50,  // 50% off
    singleRide:         2.00,
    uberCrossTown:      { min: 15, typical: 20, max: 25 },
    uberBase:           2.50,
    uberPerKm:          1.20,
    insurance:          { min: 100, typical: 130, max: 150 },
    fuelPerLiter:       0.95,
    fuelMonthly:        { min: 80,  typical: 120, max: 180 },
    parkingMonthly:     { min: 80,  typical: 120, max: 200 },
    parkingHourly:      2.00,
    registration:       { annual: 50, initial: { min: 40, typical: 55, max: 80 } },
    tolls:              20,
    carFree:            { min: 60,  typical: 120, max: 180 },
    withCar:            { min: 280, typical: 400, max: 550 },
    transitCoverage:    'Public bus system covers urban core. Limited suburban coverage typically requires a car for errands.',
    seniorNote:         'Seniors 65+ qualify for half-fare on local transit with valid ID or Medicare card.',
    rideShareAvail:     'Uber and Lyft widely available in urban areas.',
    walkability:        'Moderate walkability in urban core, car-dependent suburbs.',
    insuranceNote:      'Full coverage auto insurance. Senior safe-driver discounts available (5-15%).',
    fuelNote:           'Regular unleaded ~$3.50-3.80/gallon.',
    parkingNote:        'Free parking common in suburban areas. Downtown garages higher.',
    registrationNote:   'Annual state registration and inspection.',
    evAvailable:        true,
  },
  'France': {
    monthlyPass:        { min: 40,  max: 65 },
    seniorDiscount:     0.40,  // 30-50% off, use 40%
    singleRide:         1.70,
    uberCrossTown:      { min: 10, typical: 14, max: 18 },
    uberBase:           3.00,
    uberPerKm:          1.00,
    insurance:          { min: 45, typical: 60, max: 85 },
    fuelPerLiter:       1.80,
    fuelMonthly:        { min: 60,  typical: 90, max: 140 },
    parkingMonthly:     { min: 60,  typical: 85, max: 120 },
    parkingHourly:      1.50,
    registration:       { annual: 0, initial: { min: 200, typical: 300, max: 500 } },
    tolls:              30,
    carFree:            { min: 50,  typical: 100, max: 160 },
    withCar:            { min: 200, typical: 320, max: 450 },
    transitCoverage:    'Well-connected bus and tram network. TGV and regional rail for intercity travel.',
    seniorNote:         'Seniors 65+ eligible for 30-50% reduced fare cards (carte senior). Must register at transit office.',
    rideShareAvail:     'Uber available in cities. Traditional taxis at stands. BlaBlaCar popular for intercity.',
    walkability:        'Good walkability in city centers. Most daily errands manageable on foot.',
    insuranceNote:      'Third-party (au tiers) from ~$45/mo. All-risk (tous risques) $60-85/mo.',
    fuelNote:           'Gazole (diesel) and sans-plomb 95 available. Fuel ~$1.80/L.',
    parkingNote:        'Resident parking (stationnement résidentiel) significantly cheaper with proof of address.',
    registrationNote:   'Carte grise (registration) is one-time. No annual vehicle tax. Contrôle technique (inspection) every 2 years.',
    evAvailable:        false,
  },
  'Spain': {
    monthlyPass:        { min: 35,  max: 50 },
    seniorDiscount:     0.50,
    singleRide:         1.40,
    uberCrossTown:      { min: 8,  typical: 11, max: 14 },
    uberBase:           3.50,
    uberPerKm:          0.95,
    insurance:          { min: 30, typical: 40, max: 70 },
    fuelPerLiter:       1.60,
    fuelMonthly:        { min: 45,  typical: 75, max: 120 },
    parkingMonthly:     { min: 50,  typical: 70, max: 100 },
    parkingHourly:      1.20,
    registration:       { annual: 55, initial: { min: 150, typical: 350, max: 700 } },
    tolls:              15,
    carFree:            { min: 40,  typical: 85, max: 140 },
    withCar:            { min: 180, typical: 280, max: 400 },
    transitCoverage:    'Urban bus network with good city coverage. Metro in larger cities. Cercanías commuter rail for nearby towns.',
    seniorNote:         'Pensionistas and those 65+ eligible for 50% discounts on local transit passes. Registration with tarjeta de transporte required.',
    rideShareAvail:     'Uber and Cabify available in major cities. Taxis regulated and metered.',
    walkability:        'Excellent walkability in most city centers. Compact neighborhoods with shops and services.',
    insuranceNote:      'Third-party (terceros) from ~$30/mo. Comprehensive (todo riesgo) $40-70/mo.',
    fuelNote:           'Gasoline ~$1.55-1.65/L. Diesel ~$1.45-1.55/L.',
    parkingNote:        'Resident parking (zona azul) much cheaper with empadronamiento. Underground garages $50-100/mo.',
    registrationNote:   'Impuesto de circulación (road tax) varies by engine size. Annual inspection (ITV) for vehicles over 4 years.',
    evAvailable:        false,
  },
  'Italy': {
    monthlyPass:        { min: 35,  max: 50 },
    seniorDiscount:     0.40,
    singleRide:         1.50,
    uberCrossTown:      { min: 8,  typical: 12, max: 15 },
    uberBase:           3.50,
    uberPerKm:          1.10,
    insurance:          { min: 40, typical: 55, max: 90 },
    fuelPerLiter:       1.80,
    fuelMonthly:        { min: 55,  typical: 85, max: 130 },
    parkingMonthly:     { min: 60,  typical: 85, max: 120 },
    parkingHourly:      1.50,
    registration:       { annual: 0, initial: { min: 250, typical: 400, max: 700 } },
    tolls:              30,
    carFree:            { min: 45,  typical: 90, max: 150 },
    withCar:            { min: 200, typical: 330, max: 470 },
    transitCoverage:    'Urban bus network in most cities. Metro in Rome, Milan, Naples. Regional train (Trenitalia) connects towns.',
    seniorNote:         'Seniors 65+ eligible for reduced fares (abbonamento agevolato) on local transit. Registration at transit office required.',
    rideShareAvail:     'Uber available in major cities (limited to Uber Black in some). Taxis regulated with meters. FreeNow app for taxis.',
    walkability:        'Excellent walkability in historic centers. Many errands manageable on foot in town cores.',
    insuranceNote:      'RCA (third-party) mandatory, ~$40-55/mo. Kasko (comprehensive) $55-90/mo. Rates vary significantly by region.',
    fuelNote:           'Benzina (gasoline) ~$1.75-1.85/L. Gasolio (diesel) ~$1.65-1.75/L. Self-service (fai da te) cheaper than attended.',
    parkingNote:        'Blue-line (strisce blu) parking metered. White-line free. Resident permits available. ZTL zones restrict car access in city centers.',
    registrationNote:   'Bollo auto (road tax) annual, based on engine power (kW). Revisione (inspection) every 2 years after 4th year.',
    evAvailable:        false,
  },
  'Portugal': {
    monthlyPass:        { min: 30,  max: 45 },
    seniorDiscount:     0.50,
    singleRide:         1.50,
    uberCrossTown:      { min: 6,  typical: 9, max: 12 },
    uberBase:           3.25,
    uberPerKm:          0.80,
    insurance:          { min: 25, typical: 35, max: 60 },
    fuelPerLiter:       1.70,
    fuelMonthly:        { min: 40,  typical: 70, max: 110 },
    parkingMonthly:     { min: 40,  typical: 60, max: 80 },
    parkingHourly:      1.00,
    registration:       { annual: 0, initial: { min: 150, typical: 300, max: 500 } },
    tolls:              20,
    carFree:            { min: 35,  typical: 75, max: 120 },
    withCar:            { min: 160, typical: 250, max: 370 },
    transitCoverage:    'Urban bus and tram network in major cities. Metro in Lisbon and Porto. CP (Comboios de Portugal) rail connects regions.',
    seniorNote:         'Seniors 65+ eligible for passes sub23/+65 with up to 50% discount on municipal transit. Navegante card in Lisbon metro area.',
    rideShareAvail:     'Uber and Bolt widely available and affordable. Taxis regulated with meters.',
    walkability:        'Good walkability in city centers, though hilly terrain in Lisbon and Porto. Compact neighborhoods.',
    insuranceNote:      'Third-party from ~$25/mo. Comprehensive (contra todos os riscos) $35-60/mo. Rates among lowest in Western Europe.',
    fuelNote:           'Gasolina ~$1.65-1.75/L. Gasóleo (diesel) ~$1.55-1.65/L.',
    parkingNote:        'EMEL parking in Lisbon with resident discounts. Underground garages $40-80/mo. Free parking easier outside city cores.',
    registrationNote:   'IUC (Imposto Único de Circulação) annual vehicle tax based on engine and CO2. Inspecção (inspection) required regularly.',
    evAvailable:        false,
  },
  'Ireland': {
    monthlyPass:        { min: 80,  max: 120 },
    seniorDiscount:     1.00,  // free with Free Travel Pass
    singleRide:         2.30,
    uberCrossTown:      { min: 12, typical: 16, max: 20 },
    uberBase:           3.80,
    uberPerKm:          1.30,
    insurance:          { min: 60, typical: 80, max: 120 },
    fuelPerLiter:       1.80,
    fuelMonthly:        { min: 70,  typical: 100, max: 150 },
    parkingMonthly:     { min: 100, typical: 130, max: 180 },
    parkingHourly:      2.50,
    registration:       { annual: 0, initial: { min: 200, typical: 400, max: 600 } },
    tolls:              25,
    carFree:            { min: 60,  typical: 100, max: 160 },
    withCar:            { min: 260, typical: 380, max: 530 },
    transitCoverage:    'Bus Éireann intercity and local routes. Dublin Bus, Luas tram, and DART rail in Dublin. Limited rural transit.',
    seniorNote:         'Irish residents 66+ qualify for Free Travel Pass (unlimited free public transport nationwide). Non-residents may not qualify immediately.',
    rideShareAvail:     'Uber available as taxi booking only (no UberX). FreeNow app for taxis. Traditional taxi ranks.',
    walkability:        'Walkable town centers, especially in smaller cities. Larger cities have good pedestrian infrastructure.',
    insuranceNote:      'Third-party from ~$60/mo. Comprehensive $80-120/mo. Insurance costs are among the highest in Europe.',
    fuelNote:           'Petrol ~$1.75-1.85/L. Diesel ~$1.65-1.80/L.',
    parkingNote:        'Pay-and-display in town centers. Resident permits available in some areas. Multi-story car parks $100-180/mo.',
    registrationNote:   'Annual motor tax based on CO2 emissions. NCT (National Car Test) required every 2 years.',
    evAvailable:        false,
  },
  'Greece': {
    monthlyPass:        { min: 25,  max: 35 },
    seniorDiscount:     0.50,
    singleRide:         1.20,
    uberCrossTown:      { min: 5,  typical: 8, max: 10 },
    uberBase:           3.40,
    uberPerKm:          0.74,
    insurance:          { min: 20, typical: 30, max: 50 },
    fuelPerLiter:       1.70,
    fuelMonthly:        { min: 40,  typical: 65, max: 100 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      1.00,
    registration:       { annual: 0, initial: { min: 150, typical: 300, max: 500 } },
    tolls:              15,
    carFree:            { min: 30,  typical: 60, max: 100 },
    withCar:            { min: 140, typical: 220, max: 320 },
    transitCoverage:    'Athens metro, tram, and bus network. KTEL intercity buses. Island locations rely on ferries and local buses.',
    seniorNote:         'Seniors 65+ eligible for reduced fares (up to 50% off) on OASA transit in Athens. Island transit discounts vary.',
    rideShareAvail:     'Uber available in Athens. BEAT app popular. Taxis with meters throughout. Island taxis may use fixed fares.',
    walkability:        'Excellent walkability in town centers and islands. Compact Greek towns designed for pedestrians.',
    insuranceNote:      'Third-party mandatory, from ~$20/mo. Comprehensive $30-50/mo. Rates among lowest in EU.',
    fuelNote:           'Unleaded ~$1.65-1.75/L. Diesel ~$1.55-1.65/L. Island fuel prices may be 5-10% higher.',
    parkingNote:        'Controlled parking zones in cities. Free parking easier on islands and smaller towns.',
    registrationNote:   'Road tax (teli) annual, based on engine size. KTEO inspection every 2 years.',
    evAvailable:        false,
  },
  'Croatia': {
    monthlyPass:        { min: 25,  max: 35 },
    seniorDiscount:     0.50,
    singleRide:         1.00,
    uberCrossTown:      { min: 5,  typical: 8, max: 10 },
    uberBase:           2.80,
    uberPerKm:          0.80,
    insurance:          { min: 20, typical: 30, max: 50 },
    fuelPerLiter:       1.60,
    fuelMonthly:        { min: 40,  typical: 60, max: 95 },
    parkingMonthly:     { min: 30,  typical: 40, max: 50 },
    parkingHourly:      0.80,
    registration:       { annual: 30, initial: { min: 100, typical: 200, max: 400 } },
    tolls:              15,
    carFree:            { min: 25,  typical: 55, max: 90 },
    withCar:            { min: 130, typical: 210, max: 300 },
    transitCoverage:    'ZET trams and buses in Zagreb. Local bus networks in Split and Dubrovnik. Intercity buses via FlixBus and Croatia Bus.',
    seniorNote:         'Seniors 65+ eligible for 50% reduced transit passes in most cities. Registration at transit office with valid ID.',
    rideShareAvail:     'Uber available in Zagreb, Split, Dubrovnik. Bolt also operates. Taxis regulated with meters.',
    walkability:        'Excellent walkability in old town areas. Compact coastal cities are very pedestrian-friendly.',
    insuranceNote:      'Third-party (AO) mandatory from ~$20/mo. Kasko (comprehensive) $30-50/mo. Croatia adopted EUR in 2023.',
    fuelNote:           'Eurosuper 95 ~$1.55-1.65/L. Eurodiesel ~$1.50-1.60/L.',
    parkingNote:        'Zone-based parking in cities (Zone 1 most expensive). Resident permits available. Coastal areas pricier in summer.',
    registrationNote:   'Annual registration includes road tax based on engine size. Tehnički pregled (inspection) required annually.',
    evAvailable:        false,
  },
  'Mexico': {
    monthlyPass:        { min: 15,  max: 25 },
    seniorDiscount:     0.50,
    singleRide:         0.40,
    uberCrossTown:      { min: 3,  typical: 5, max: 6 },
    uberBase:           1.00,
    uberPerKm:          0.50,
    insurance:          { min: 20, typical: 30, max: 45 },
    fuelPerLiter:       1.10,
    fuelMonthly:        { min: 30,  typical: 50, max: 80 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      0.50,
    registration:       { annual: 20, initial: { min: 50, typical: 100, max: 200 } },
    tolls:              10,
    carFree:            { min: 20,  typical: 50, max: 80 },
    withCar:            { min: 120, typical: 190, max: 280 },
    transitCoverage:    'Local buses (camiones) are the primary transit. Metro in Mexico City and Guadalajara. Colectivos (shared vans) common.',
    seniorNote:         'INAPAM card for adults 60+ provides 50% discounts on public transit, intercity buses, and many services.',
    rideShareAvail:     'Uber widely available in cities. DiDi also popular. Traditional taxis available but negotiate fare or use sitio (stand) taxis.',
    walkability:        'Good walkability in colonial centro areas. Suburban sprawl may require transport for some errands.',
    insuranceNote:      'Full coverage from ~$30/mo. Liability-only from ~$20/mo. Required by law in most states.',
    fuelNote:           'Magna (regular) ~$1.05-1.15/L. Premium ~$1.20-1.30/L.',
    parkingNote:        'Street parking common. Estacionamientos (parking lots) ~$0.50-1.00/hr. Monthly spots $30-60.',
    registrationNote:   'Annual tenencia (vehicle tax) varies by state. Verificación (emissions) required in some states.',
    evAvailable:        false,
  },
  'Colombia': {
    monthlyPass:        { min: 20,  max: 30 },
    seniorDiscount:     0.50,
    singleRide:         0.70,
    uberCrossTown:      { min: 2,  typical: 4, max: 5 },
    uberBase:           1.00,
    uberPerKm:          0.40,
    insurance:          { min: 15, typical: 25, max: 40 },
    fuelPerLiter:       0.90,
    fuelMonthly:        { min: 25,  typical: 40, max: 65 },
    parkingMonthly:     { min: 30,  typical: 40, max: 50 },
    parkingHourly:      0.50,
    registration:       { annual: 25, initial: { min: 50, typical: 100, max: 200 } },
    tolls:              8,
    carFree:            { min: 20,  typical: 45, max: 70 },
    withCar:            { min: 100, typical: 170, max: 250 },
    transitCoverage:    'TransMilenio BRT in Bogotá. Metro in Medellín. Local buses and busetas in all cities. SITP integrated systems.',
    seniorNote:         'Adults 62+ (women) and 57+ (men) eligible for subsidized transit fares with cédula de ciudadanía.',
    rideShareAvail:     'Uber, DiDi, and InDriver widely available. Traditional taxis metered. Ride-hailing very affordable.',
    walkability:        'Good walkability in city centers. Medellín and Bogotá have expanding pedestrian infrastructure.',
    insuranceNote:      'SOAT (mandatory liability) ~$15/mo. Full coverage from $25/mo. Rates very affordable.',
    fuelNote:           'Corriente (regular) ~$0.85-0.95/L. Premium (extra) ~$1.00-1.10/L. Government-subsidized prices.',
    parkingNote:        'Parqueaderos (parking lots) common and inexpensive. Street parking in designated zones.',
    registrationNote:   'Annual impuesto vehicular (vehicle tax) based on assessed value. Técnico-mecánica (inspection) required annually.',
    evAvailable:        false,
  },
  'Costa Rica': {
    monthlyPass:        { min: 20,  max: 30 },
    seniorDiscount:     0.50,
    singleRide:         0.60,
    uberCrossTown:      { min: 3,  typical: 5, max: 7 },
    uberBase:           1.50,
    uberPerKm:          0.55,
    insurance:          { min: 25, typical: 35, max: 50 },
    fuelPerLiter:       1.20,
    fuelMonthly:        { min: 35,  typical: 55, max: 90 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      0.75,
    registration:       { annual: 30, initial: { min: 80, typical: 150, max: 300 } },
    tolls:              5,
    carFree:            { min: 25,  typical: 55, max: 90 },
    withCar:            { min: 130, typical: 210, max: 310 },
    transitCoverage:    'Urban buses operate by route concessions. No metro system. Intercity buses connect major towns. Rural areas have limited service.',
    seniorNote:         'Ciudadano de Oro (Golden Citizen) status for 65+ provides discounted bus fares and other benefits.',
    rideShareAvail:     'Uber available in San José metro area and some tourist areas. Traditional taxis (red, metered) everywhere. Rural areas may have limited options.',
    walkability:        'Moderate walkability in town centers. Many areas lack sidewalks. Car useful outside urban cores.',
    insuranceNote:      'INS (state insurer) mandatory SOA liability ~$25/mo. Full coverage from $35/mo. Only insurer for auto in CR.',
    fuelNote:           'Super (gasoline) ~$1.15-1.25/L. Diesel ~$1.05-1.15/L. Prices set by government monthly.',
    parkingNote:        'Parqueos (lots) common in cities. Street parking informal in many areas. Guarded lots ~$1-2/hr.',
    registrationNote:   'Marchamo (annual vehicle tax/registration) due each December. RTV (inspection) required annually.',
    evAvailable:        false,
  },
  'Panama': {
    monthlyPass:        { min: 15,  max: 25 },
    seniorDiscount:     1.00,  // Free with Jubilado card
    singleRide:         0.35,
    uberCrossTown:      { min: 3,  typical: 5, max: 6 },
    uberBase:           1.50,
    uberPerKm:          0.50,
    insurance:          { min: 20, typical: 30, max: 45 },
    fuelPerLiter:       0.85,
    fuelMonthly:        { min: 25,  typical: 40, max: 65 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      0.50,
    registration:       { annual: 30, initial: { min: 80, typical: 150, max: 300 } },
    tolls:              5,
    carFree:            { min: 15,  typical: 40, max: 65 },
    withCar:            { min: 100, typical: 170, max: 250 },
    transitCoverage:    'Metro Line 1 and 2 in Panama City. MetroBus covers city areas. Mi Bus feeder routes. Rural areas rely on local buses (diablos rojos/coasters).',
    seniorNote:         'Jubilado/Pensionado visa holders get free public transit and 15-25% discounts on many services.',
    rideShareAvail:     'Uber widely used in Panama City. DiDi also available. Traditional yellow taxis use zone-based fares (no meters).',
    walkability:        'Moderate walkability in Panama City neighborhoods (Casco Viejo, El Cangrejo). Rural towns are more car-dependent.',
    insuranceNote:      'Basic liability from ~$20/mo. Full coverage from $30/mo. INS de Panama or private insurers.',
    fuelNote:           'Gasoline ~$0.80-0.90/L. Among the lowest fuel prices in the region. USD is local currency.',
    parkingNote:        'Parking lots common in Panama City $0.50-1.00/hr. Many malls offer free parking. Street parking limited downtown.',
    registrationNote:   'Annual revisado (inspection) required. Registration through ATTT (transit authority).',
    evAvailable:        false,
  },
  'Ecuador': {
    monthlyPass:        { min: 10,  max: 15 },
    seniorDiscount:     0.50,
    singleRide:         0.30,
    uberCrossTown:      { min: 2,  typical: 3, max: 4 },
    uberBase:           0.80,
    uberPerKm:          0.35,
    insurance:          { min: 15, typical: 25, max: 40 },
    fuelPerLiter:       0.65,
    fuelMonthly:        { min: 20,  typical: 30, max: 50 },
    parkingMonthly:     { min: 20,  typical: 30, max: 40 },
    parkingHourly:      0.40,
    registration:       { annual: 20, initial: { min: 40, typical: 80, max: 150 } },
    tolls:              3,
    carFree:            { min: 12,  typical: 30, max: 50 },
    withCar:            { min: 80,  typical: 130, max: 200 },
    transitCoverage:    'Urban buses (ecovia, trolebus) in Quito. Local buses in all cities. Tranvía (tram) in Cuenca. Intercity buses very affordable.',
    seniorNote:         'Tercera edad (65+) get 50% discounts on public transit, domestic flights, and many services by law.',
    rideShareAvail:     'Uber available in Quito and Guayaquil. InDriver popular. Traditional taxis with meters (or negotiated fares in smaller cities).',
    walkability:        'Good walkability in colonial centers. Cuenca especially walkable. Smaller towns compact and pedestrian-friendly.',
    insuranceNote:      'SOAT (mandatory) ~$15/mo. Full coverage from $25/mo. Very affordable by regional standards.',
    fuelNote:           'Gasolina Extra ~$0.60-0.70/L. Super ~$0.85-0.95/L. Government-subsidized prices (USD is official currency).',
    parkingNote:        'SIMERT parking meters in Cuenca. Most towns have cheap lot parking. Free street parking common outside centers.',
    registrationNote:   'Annual matriculación (registration) based on vehicle value. Revisión técnica (inspection) required annually.',
    evAvailable:        false,
  },
  'Uruguay': {
    monthlyPass:        { min: 30,  max: 45 },
    seniorDiscount:     0.50,
    singleRide:         0.90,
    uberCrossTown:      { min: 5,  typical: 8, max: 10 },
    uberBase:           2.00,
    uberPerKm:          0.65,
    insurance:          { min: 25, typical: 35, max: 55 },
    fuelPerLiter:       1.60,
    fuelMonthly:        { min: 45,  typical: 70, max: 110 },
    parkingMonthly:     { min: 40,  typical: 55, max: 70 },
    parkingHourly:      1.00,
    registration:       { annual: 35, initial: { min: 100, typical: 200, max: 400 } },
    tolls:              10,
    carFree:            { min: 30,  typical: 65, max: 100 },
    withCar:            { min: 150, typical: 240, max: 350 },
    transitCoverage:    'Good bus network in Montevideo (STM card). Intercity buses via Tres Cruces terminal. Limited transit in smaller cities.',
    seniorNote:         'Seniors 65+ eligible for discounted transit fares with credencial cívica. Some routes offer free travel for pensionistas.',
    rideShareAvail:     'Uber and Cabify available in Montevideo. Traditional taxis regulated with meters. Limited ride-sharing outside Montevideo.',
    walkability:        'Good walkability in Montevideo (Ciudad Vieja, Pocitos). Smaller cities compact and walkable.',
    insuranceNote:      'SOA (mandatory third-party) from ~$25/mo. Full coverage from $35/mo. BSE (state insurer) or private.',
    fuelNote:           'Nafta Super ~$1.55-1.65/L. Premium ~$1.70-1.80/L. ANCAP (state oil company) sets prices.',
    parkingNote:        'Parking meters in central Montevideo. Garages $40-70/mo. Free parking common in residential areas.',
    registrationNote:   'Patente (annual vehicle tax) based on vehicle value. ITV (inspection) required annually.',
    evAvailable:        false,
  },
  'Cyprus': {
    monthlyPass:        { min: 30,  max: 40 },
    seniorDiscount:     0.50,
    singleRide:         1.50,
    uberCrossTown:      { min: 6,  typical: 9, max: 12 },
    uberBase:           3.50,
    uberPerKm:          0.85,
    insurance:          { min: 25, typical: 35, max: 55 },
    fuelPerLiter:       1.60,
    fuelMonthly:        { min: 40,  typical: 60, max: 95 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      1.00,
    registration:       { annual: 0, initial: { min: 150, typical: 300, max: 500 } },
    tolls:              0,
    carFree:            { min: 30,  typical: 60, max: 100 },
    withCar:            { min: 130, typical: 210, max: 310 },
    transitCoverage:    'Intercity and urban bus routes operated by OSEL (Limassol), OSYPA (Paphos). No rail system. Car is common for daily transport.',
    seniorNote:         'Seniors 65+ eligible for 50% discounts on public buses. Registration at bus company offices with valid ID.',
    rideShareAvail:     'Uber not officially available. Bolt operates in major cities. Traditional taxis regulated with meters.',
    walkability:        'Moderate walkability in coastal towns. Most daily life relies on car travel due to suburban sprawl.',
    insuranceNote:      'Third-party mandatory from ~$25/mo. Comprehensive $35-55/mo. Drive on the left side of the road.',
    fuelNote:           'Unleaded 95 ~$1.55-1.65/L. Diesel ~$1.50-1.60/L.',
    parkingNote:        'Free parking widely available outside city centers. Municipal lots in towns. Malls offer free parking.',
    registrationNote:   'Annual road tax based on CO2 emissions. MOT (inspection) required for vehicles over 4 years.',
    evAvailable:        false,
  },
  'Malta': {
    monthlyPass:        { min: 30,  max: 40 },
    seniorDiscount:     1.00,  // Free for 60+ residents
    singleRide:         1.50,
    uberCrossTown:      { min: 6,  typical: 9, max: 12 },
    uberBase:           3.50,
    uberPerKm:          0.90,
    insurance:          { min: 25, typical: 35, max: 55 },
    fuelPerLiter:       1.60,
    fuelMonthly:        { min: 35,  typical: 55, max: 85 },
    parkingMonthly:     { min: 30,  typical: 45, max: 60 },
    parkingHourly:      1.00,
    registration:       { annual: 0, initial: { min: 200, typical: 350, max: 600 } },
    tolls:              0,
    carFree:            { min: 25,  typical: 55, max: 90 },
    withCar:            { min: 120, typical: 200, max: 290 },
    transitCoverage:    'Malta Public Transport buses cover most of the island. Gozo bus network separate. Ferries between Malta, Gozo, and Comino.',
    seniorNote:         'Residents 60+ ride Malta Public Transport for free with Tallinja personalized card.',
    rideShareAvail:     'Bolt available. Uber not in Malta. Traditional white taxis and eCabs app. Short distances on small island.',
    walkability:        'Good walkability in Valletta, Sliema, St. Julians. Island is small but hilly in parts. Car useful for broader access.',
    insuranceNote:      'Third-party mandatory from ~$25/mo. Comprehensive $35-55/mo. Small island means shorter commutes.',
    fuelNote:           'Unleaded ~$1.55-1.65/L. Diesel ~$1.45-1.55/L. Limited EV charging infrastructure.',
    parkingNote:        'CVA controlled parking in Valletta. Street parking competitive. Some buildings include garage spaces.',
    registrationNote:   'Annual road license fee based on CO2. VRT (vehicle registration tax) on import. Inspection (VRT test) periodically.',
    evAvailable:        false,
  },
};

// ────────────────────────────────────────────────────────────────
// Size/urbanity adjustments based on location characteristics
// ────────────────────────────────────────────────────────────────

// Locations that are major metros (higher costs, better transit)
const MAJOR_METROS = new Set([
  'us-chicago-il', 'us-miami-fl', 'us-denver-co', 'us-dallas-tx',
  'us-austin-tx', 'us-austin', 'us-nashville-tn', 'us-minneapolis-mn',
  'us-milwaukee-wi', 'us-fort-lauderdale-fl', 'us-tampa-fl',
  'us-st-petersburg-fl', 'us-baltimore-md', 'us-pittsburgh-pa',
  'france-paris', 'france-nice', 'france-lyon',
  'spain-barcelona', 'spain-valencia',
  'italy-tuscany', 'italy-lake-region',
  'greece-athens',
  'ireland-cork',
  'croatia-zagreb',
  'portugal-lisbon', 'portugal-porto', 'portugal-cascais',
  'colombia-bogota', 'colombia-medellin',
  'costa-rica-central-valley',
  'panama-city', 'panama-city-bella-vista', 'panama-city-casco-viejo',
  'panama-city-costa-del-este', 'panama-city-el-cangrejo', 'panama-city-punta-pacifica',
  'ecuador-quito',
  'uruguay-montevideo',
  'cyprus-limassol',
  'malta-valletta', 'malta-sliema',
]);

// Locations that are small/rural (lower costs, limited transit)
const SMALL_TOWNS = new Set([
  'us-armstrong-county-pa', 'us-grand-forks-nd', 'us-lapeer-mi',
  'us-lorain-oh', 'us-port-huron-mi', 'us-skowhegan-me',
  'us-williamsport-pa', 'us-quincy-fl', 'us-yulee-fl',
  'us-killeen-tx', 'us-san-marcos-tx', 'us-fort-wayne-in',
  'us-lynchburg-va', 'us-portsmouth-va',
  'france-dordogne', 'france-gascony',
  'costa-rica-arenal', 'costa-rica-grecia', 'costa-rica-puerto-viejo',
  'costa-rica-atenas', 'costa-rica-guanacaste',
  'panama-bocas-del-toro', 'panama-chitre', 'panama-david',
  'panama-el-valle', 'panama-pedasi', 'panama-puerto-armuelles',
  'panama-volcan', 'panama-coronado',
  'panama-boquete',
  'ecuador-cotacachi', 'ecuador-vilcabamba', 'ecuador-salinas',
  'colombia-pereira', 'colombia-santa-marta',
  'uruguay-colonia', 'uruguay-punta-del-este',
  'greece-corfu', 'greece-crete', 'greece-peloponnese', 'greece-rhodes',
  'croatia-dubrovnik', 'croatia-istria',
  'ireland-limerick', 'ireland-galway', 'ireland-wexford',
  'italy-abruzzo', 'italy-puglia', 'italy-sardinia', 'italy-sicily',
  'cyprus-larnaca', 'cyprus-paphos',
  'malta-gozo',
  'portugal-algarve', 'portugal-silver-coast',
  'mexico-lake-chapala', 'mexico-oaxaca', 'mexico-san-miguel-de-allende',
  'france-languedoc', 'france-toulon',
  'spain-canary-islands', 'spain-costa-del-sol',
]);

// ────────────────────────────────────────────────────────────────
// Helper: adjust a range by a multiplier
// ────────────────────────────────────────────────────────────────
function scaleRange(obj, factor) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'number' ? Math.round(v * factor) : v;
  }
  return result;
}

function randomize(val, variance = 0.08) {
  // Add slight deterministic variance based on value itself
  const seed = val * 7 % 13;
  const factor = 1 + (seed - 6.5) / 6.5 * variance;
  return Math.round(val * factor);
}

// ────────────────────────────────────────────────────────────────
// Build transportation data for a location
// ────────────────────────────────────────────────────────────────
function buildTransportation(locId, locationData) {
  const country = locationData.country;
  const name = locationData.name || locId;
  const template = COUNTRY_TEMPLATES[country];

  if (!template) {
    return null;
  }

  // Size adjustment factor
  let sizeFactor = 1.0;
  if (MAJOR_METROS.has(locId)) {
    sizeFactor = 1.15;
  } else if (SMALL_TOWNS.has(locId)) {
    sizeFactor = 0.85;
  }

  // Compute core values
  const passMin = Math.round(template.monthlyPass.min * sizeFactor);
  const passMax = Math.round(template.monthlyPass.max * sizeFactor);
  const passRegular = Math.round((passMin + passMax) / 2);
  const seniorPass = template.seniorDiscount >= 1.0
    ? 0
    : Math.round(passRegular * (1 - template.seniorDiscount));

  const singleRide = +(template.singleRide * sizeFactor).toFixed(2);

  const uberMin = Math.round(template.uberCrossTown.min * sizeFactor);
  const uberTyp = Math.round(template.uberCrossTown.typical * sizeFactor);
  const uberMax = Math.round(template.uberCrossTown.max * sizeFactor);

  const insMin = Math.round(template.insurance.min * sizeFactor);
  const insTyp = Math.round(template.insurance.typical * sizeFactor);
  const insMax = Math.round(template.insurance.max * sizeFactor);

  const fuelPerL = +(template.fuelPerLiter).toFixed(2);
  const fuelMin = Math.round(template.fuelMonthly.min * sizeFactor);
  const fuelTyp = Math.round(template.fuelMonthly.typical * sizeFactor);
  const fuelMax = Math.round(template.fuelMonthly.max * sizeFactor);

  const parkMin = Math.round(template.parkingMonthly.min * sizeFactor);
  const parkTyp = Math.round(template.parkingMonthly.typical * sizeFactor);
  const parkMax = Math.round(template.parkingMonthly.max * sizeFactor);

  const regAnnual = template.registration.annual;
  const regInitMin = Math.round(template.registration.initial.min);
  const regInitTyp = Math.round(template.registration.initial.typical);
  const regInitMax = Math.round(template.registration.initial.max);

  const carFreeMin = Math.round(template.carFree.min * sizeFactor);
  const carFreeTyp = Math.round(template.carFree.typical * sizeFactor);
  const carFreeMax = Math.round(template.carFree.max * sizeFactor);

  const withCarMin = Math.round(template.withCar.min * sizeFactor);
  const withCarTyp = Math.round(template.withCar.typical * sizeFactor);
  const withCarMax = Math.round(template.withCar.max * sizeFactor);

  const seniorNote = template.seniorDiscount >= 1.0
    ? template.seniorNote
    : template.seniorNote;

  const cityShort = name.split(',')[0].split(' — ')[0].split('/')[0].trim();

  const transportation = {
    monthlyBudget: {
      min: carFreeMin,
      typical: carFreeTyp,
      max: withCarTyp,
    },
    publicTransit: {
      monthlyPass: {
        regular: passRegular,
        senior: seniorPass,
        notes: template.seniorDiscount >= 1.0
          ? `${seniorNote}`
          : `${cityShort} transit pass. ${seniorNote}`,
      },
      singleRide,
      coverage: template.transitCoverage,
      seniorDiscount: seniorNote,
    },
    rideShare: {
      baseFare: +(template.uberBase * sizeFactor).toFixed(2),
      perKm: +(template.uberPerKm * sizeFactor).toFixed(2),
      typicalCrossTownTrip: {
        min: uberMin,
        typical: uberTyp,
        max: uberMax,
      },
      availability: template.rideShareAvail,
    },
    carOwnership: {
      registration: {
        annualCost: regAnnual,
        initialRegistration: {
          min: regInitMin,
          typical: regInitTyp,
          max: regInitMax,
        },
        notes: template.registrationNote,
      },
      insurance: {
        monthlyMin: insMin,
        monthlyTypical: insTyp,
        monthlyMax: insMax,
        notes: template.insuranceNote,
      },
      fuel: {
        pricePerLiter: fuelPerL,
        monthlyEstimate: {
          min: fuelMin,
          typical: fuelTyp,
          max: fuelMax,
        },
        notes: template.fuelNote,
      },
      parking: {
        monthlyResident: {
          min: parkMin,
          typical: parkTyp,
          max: parkMax,
        },
        hourlyStreet: +(template.parkingHourly * sizeFactor).toFixed(2),
        notes: template.parkingNote,
      },
      tolls: {
        monthlyEstimate: Math.round(template.tolls * sizeFactor),
        notes: `Estimated monthly toll/highway costs for ${cityShort} area.`,
      },
      seniorDiscounts: template.seniorNote,
    },
    walkability: template.walkability,
    monthlyEstimate: {
      carFree: {
        min: carFreeMin,
        typical: carFreeTyp,
        max: carFreeMax,
        notes: `Transit pass + occasional ride-share. ${SMALL_TOWNS.has(locId) ? 'Limited transit — may need more ride-share trips.' : 'Good for urban core living.'}`,
      },
      withCar: {
        min: withCarMin,
        typical: withCarTyp,
        max: withCarMax,
        notes: `Includes insurance, fuel, parking, maintenance. ${MAJOR_METROS.has(locId) ? 'Higher urban parking and insurance costs.' : 'Moderate suburban costs.'}`,
      },
    },
  };

  // Add EV section for US locations
  if (template.evAvailable) {
    transportation.electricVehicle = {
      purchasePrice: { min: 28000, typical: 35000, max: 52000 },
      purchaseNotes: 'Tesla Model 3 ~$35K, Hyundai Ioniq 5 ~$42K, Chevy Equinox EV ~$28K. Federal tax credit up to $7,500 (income limits apply).',
      federalIncentive: 7500,
      stateIncentive: 0,
      incentiveNotes: 'Federal EV tax credit up to $7,500 under IRA (income < $150K single / $300K joint). Used EV credit up to $4,000.',
      chargingHome: {
        installCost: { min: 500, typical: 1200, max: 2500 },
        monthlyElectricity: { min: 30, typical: 50, max: 80 },
        notes: 'Level 2 (240V) home charger. ~1,000 mi/month = ~300 kWh.',
      },
      chargingPublic: {
        perKwh: { min: 0.30, typical: 0.43, max: 0.60 },
        notes: 'Tesla Supercharger ~$0.40-0.50/kWh. Electrify America ~$0.43/kWh.',
      },
      insurance: {
        monthly: { min: 140, typical: 180, max: 250 },
        notes: 'EV insurance 15-25% higher than comparable ICE vehicle.',
      },
      maintenance: {
        annual: { min: 400, typical: 600, max: 900 },
        notes: 'No oil changes, fewer brake jobs (regen braking). Tires wear faster on heavier EVs.',
      },
      registration: {
        annual: { min: 100, typical: 200, max: 300 },
        notes: 'Many states add EV-specific fees ($100-275/yr) to replace lost gas tax revenue.',
      },
      batteryWarranty: '8 years / 100,000 miles (federal minimum). Most manufacturers cover 70-80% capacity retention.',
      depreciationNotes: 'EVs depreciate 40-50% in first 3 years. Budget ~$3,000-5,000/yr depreciation on $35K vehicle.',
      totalMonthlyOwnership: {
        min: Math.round(250 * sizeFactor),
        typical: Math.round(380 * sizeFactor),
        max: Math.round(550 * sizeFactor),
      },
      totalMonthlyNotes: 'Includes: charging ($50), insurance ($180), maintenance ($50/mo avg), registration ($17/mo). Excludes purchase/loan payment.',
      sources: [
        { title: 'Federal EV Tax Credit - IRS', url: 'https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after' },
        { title: 'EV Maintenance Costs - AAA', url: 'https://www.aaa.com/autorepair/articles/ev-maintenance' },
      ],
    };
  }

  return transportation;
}

// ────────────────────────────────────────────────────────────────
// Main: iterate all locations, inject transportation data
// ────────────────────────────────────────────────────────────────
const dirs = fs.readdirSync(DATA_DIR).filter(d =>
  fs.statSync(path.join(DATA_DIR, d)).isDirectory()
);

let created = 0;
let skipped = 0;
let errors = 0;
let synced = 0;

for (const dir of dirs) {
  const locPath = path.join(DATA_DIR, dir, 'location.json');
  const dcPath = path.join(DATA_DIR, dir, 'detailed-costs.json');

  if (!fs.existsSync(locPath)) {
    console.log(`  - ${dir}: no location.json — skipping`);
    skipped++;
    continue;
  }

  const loc = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
  const country = loc.country;

  // Read or create detailed-costs.json
  let dc = {};
  if (fs.existsSync(dcPath)) {
    dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
    if (dc.transportation) {
      console.log(`  . ${dir}: already has transportation — skipping`);
      skipped++;
      continue;
    }
  }

  // Build transportation data
  const transportation = buildTransportation(dir, loc);
  if (!transportation) {
    console.log(`  ! ${dir}: no template for country "${country}" — skipping`);
    errors++;
    continue;
  }

  dc.transportation = transportation;
  fs.writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');

  const carFreeTyp = transportation.monthlyEstimate.carFree.typical;
  console.log(`  + ${dir}: transportation added (car-free $${carFreeTyp}/mo, ${country})`);
  created++;

  // Sync to dashboard public data
  const dashDcPath = path.join(DASH_DIR, dir, 'detailed-costs.json');
  if (fs.existsSync(path.join(DASH_DIR, dir))) {
    fs.writeFileSync(dashDcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');
    synced++;
  }
}

console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors, ${synced} synced to dashboard`);
