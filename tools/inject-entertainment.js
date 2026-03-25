#!/usr/bin/env node
/**
 * inject-entertainment.js
 *
 * Adds entertainment detailed cost data to all locations missing it.
 * Uses country-specific pricing templates. All prices in USD.
 * Also syncs to packages/dashboard/public/data/locations/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data', 'locations');
const DASHBOARD_DIR = path.resolve(__dirname, '..', 'packages', 'dashboard', 'public', 'data', 'locations');

// ────────────────────────────────────────────────────────────────
// Country-specific entertainment templates
// All prices in USD. Non-US locations include NFL RedZone via DAZN.
// ────────────────────────────────────────────────────────────────

function usTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 355,
      seniorDiscounts: 'Many restaurants offer 10-15% senior discounts. AARP members get discounts at Denny\'s, Outback, and others.',
      notes: `Lunch for 2 at moderate restaurant ~$35 + tax + 20% tip = ~$44/meal, 2x/week (~8.7/mo) = ~$355/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 75,
      seniorDiscounts: 'Some providers offer senior plans. Check for 5-year price lock promotions.',
      notes: 'Gig internet $60-80/mo depending on provider and market. Includes basic cable or streaming bundle.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 18,
      seniorDiscounts: 'T-Mobile 55+ plans include Netflix.',
      notes: '$17.99/mo. 1080p, 2 screens, full library.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 15,
      seniorDiscounts: 'Medicaid recipients qualify for Prime at $6.99/mo.',
      notes: '$14.99/mo includes Prime Video, free shipping, Prime Reading.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 10,
      seniorDiscounts: 'No senior discount. Annual plan $99/yr ($8.25/mo).',
      notes: '$9.99/mo. Original content library.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 30,
      seniorDiscounts: 'SilverSneakers free gym membership through many Medicare Advantage plans.',
      notes: 'Planet Fitness $10-25/mo, YMCA $30-50/mo. SilverSneakers covers many gyms free.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'America the Beautiful Senior Pass $20/year (lifetime $80) for national parks.',
      notes: 'Free parks, trails, and public outdoor spaces.',
    },
    {
      name: 'Books/Library',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free. Many offer senior book clubs and digital lending.',
      notes: 'Libraries free. Kindle Unlimited $11.99/mo optional. Budget for occasional book purchases.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 20,
      seniorDiscounts: 'AARP discounts at Dunkin\'. Some cafes offer senior coffee pricing.',
      notes: 'Coffee ~$4-6/cup. Budget for 1-2 cafe visits/week.',
    },
  ];
  return buildResult(categories);
}

function franceTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 275,
      seniorDiscounts: 'Menu du jour typically includes 2-3 courses. No tipping expected (service compris).',
      notes: `Lunch for 2 at moderate restaurant: menu du jour ~\u20AC28 (service included), 2x/week = ~\u20AC243/mo = ~$275/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 30,
      seniorDiscounts: 'No specific senior discounts. Highly competitive market keeps prices low.',
      notes: 'Free Freebox 1 Gig \u20AC24.99/mo or Orange Livebox Fibre \u20AC29.99/mo. Includes TV channels. ~$28-32/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 16,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC13.49/mo in France. ~$16/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo (\u20AC69.90/yr) includes Prime Video, free delivery. ~$8/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo in France. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season (Sep-Feb). Annualized ~\u20AC13/mo (~$15). Includes RedZone, live games.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 28,
      seniorDiscounts: 'Municipal facilities offer senior rates. Basic Fit from \u20AC19.99/mo.',
      notes: 'Basic Fit \u20AC19.99-29.99/mo, municipal pools and gyms. ~$22-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Most parks and gardens free. Senior transit passes for access.',
      notes: 'Free parks, jardins publics, coastal walks, hiking trails.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 10,
      seniorDiscounts: 'M\u00E9diath\u00E8ques free with carte de r\u00E9sident.',
      notes: 'Libraries (m\u00E9diath\u00E8ques) free. Budget for newspapers, books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 18,
      seniorDiscounts: 'No specific discounts. Caf\u00E9 culture is affordable.',
      notes: 'Caf\u00E9 cr\u00E8me ~\u20AC2.50-3.50. Budget for 2 visits/week. ~$18/mo.',
    },
  ];
  return buildResult(categories);
}

function spainTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 245,
      seniorDiscounts: 'Menu del d\u00EDa widely available \u20AC10-15, includes drink. No tipping expected.',
      notes: `Lunch for 2: men\u00FA del d\u00EDa ~\u20AC25 (drink included), 2x/week = ~\u20AC217/mo = ~$245/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 38,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'Movistar/Vodafone fiber \u20AC30-40/mo. O2 1 Gig \u20AC35/mo. ~$34-45/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo in Spain. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo (\u20AC49.90/yr). Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season (Sep-Feb). Annualized ~\u20AC13/mo (~$15).',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 28,
      seniorDiscounts: 'Municipal polideportivos offer senior rates \u20AC15-25/mo.',
      notes: 'Basic Fit/McFit \u20AC20-30/mo, municipal gyms \u20AC15-25/mo. ~$22-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Free parks and beaches. Senior transit passes available.',
      notes: 'Free beaches, parks, paseos, hiking in sierras.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 8,
      seniorDiscounts: 'Bibliotecas p\u00FAblicas free with resident card.',
      notes: 'Public libraries free. Budget for books, newspapers.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 15,
      seniorDiscounts: 'No specific discounts. Caf\u00E9 con leche very affordable.',
      notes: 'Caf\u00E9 con leche ~\u20AC1.50-2.00. Budget for 2 visits/week. ~$15/mo.',
    },
  ];
  return buildResult(categories);
}

function italyTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 250,
      seniorDiscounts: 'Pranzo (lunch) menus available \u20AC10-15 at trattorie. Coperto (cover charge) \u20AC1-3.',
      notes: `Lunch for 2 at trattoria ~\u20AC28 + coperto, 2x/week = ~\u20AC220/mo = ~$250/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 34,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'TIM/Vodafone/Fastweb fiber 1 Gig \u20AC25-35/mo. ~$28-40/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo in Italy. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo (\u20AC49.90/yr). Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~\u20AC13/mo (~$15).',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 28,
      seniorDiscounts: 'Palestre comunali (municipal gyms) offer senior rates.',
      notes: 'Virgin Active/McFit \u20AC25-40/mo, municipal gyms \u20AC15-25/mo. ~$22-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'EU citizens 65+ get free/reduced museum entry. Parks free.',
      notes: 'Free parks, piazzas, coastal walks, hiking.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 8,
      seniorDiscounts: 'Biblioteche comunali free.',
      notes: 'Public libraries free. Budget for newspapers, books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts. Espresso at the bar is very cheap.',
      notes: 'Espresso \u20AC1-1.50 at the bar, cappuccino \u20AC1.50-2.00. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function portugalTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 225,
      seniorDiscounts: 'Prato do dia (daily dish) \u20AC7-12, includes bread and drink at many restaurants.',
      notes: `Lunch for 2: prato do dia ~\u20AC22-25, 2x/week = ~\u20AC200/mo = ~$225/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 40,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'NOS/MEO/Vodafone fiber 1 Gig \u20AC30-40/mo. ~$34-45/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo in Portugal. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo. Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~\u20AC13/mo (~$15).',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 22,
      seniorDiscounts: 'Gin\u00E1sios municipais offer senior rates \u20AC10-20/mo.',
      notes: 'Fitness Hut/Solinca \u20AC15-30/mo, municipal gyms cheaper. ~$17-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Senior 65+ discounts at monuments and museums. Parks free.',
      notes: 'Free parks, beaches, coastal walks, hiking.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 8,
      seniorDiscounts: 'Bibliotecas municipais free.',
      notes: 'Public libraries free. Budget for books, newspapers.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts. Coffee culture very affordable.',
      notes: 'Caf\u00E9 (espresso) ~\u20AC0.70-1.00, meia de leite ~\u20AC1.20. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function irelandTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 290,
      seniorDiscounts: 'Early bird menus widely available \u20AC15-25 for 2-3 courses.',
      notes: `Lunch for 2 at moderate restaurant ~\u20AC30-35, 2x/week = ~\u20AC260/mo = ~$290/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 62,
      seniorDiscounts: 'No specific senior discounts. Some providers offer loyalty rates.',
      notes: 'Virgin Media/Sky 1 Gig \u20AC45-60/mo. ~$50-68/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo in Ireland. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 10,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC8.99/mo. Includes Prime Video. ~$10/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Sky Sports NFL alternative. Annualized ~$18/mo.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 39,
      seniorDiscounts: 'Some local leisure centres offer over-65 rates.',
      notes: 'Flyefit/Ben Dunne \u20AC30-40/mo, leisure centres \u20AC25-35/mo. ~$34-45/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'OPW Heritage Card \u20AC40/yr (seniors \u20AC30) for all heritage sites.',
      notes: 'Free parks, coastal walks, greenways, national parks.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 8,
      seniorDiscounts: 'Public libraries free with library card.',
      notes: 'Public libraries free. Budget for books, newspapers.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 18,
      seniorDiscounts: 'No specific discounts.',
      notes: 'Coffee ~\u20AC3.50-4.50. Budget for 2 visits/week. ~$18/mo.',
    },
  ];
  return buildResult(categories);
}

function greeceTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 200,
      seniorDiscounts: 'Taverna menus affordable. No tipping expected but 5-10% appreciated.',
      notes: `Lunch for 2 at taverna ~\u20AC20-22, 2x/week = ~\u20AC180/mo = ~$200/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 34,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'Cosmote/Vodafone/Wind fiber \u20AC25-35/mo. ~$28-40/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 13,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC11.99/mo in Greece. ~$13/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo. Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~\u20AC13/mo (~$15).',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 22,
      seniorDiscounts: 'Municipal gyms (dimotiko gymnastirio) offer senior rates.',
      notes: 'Local gyms \u20AC15-25/mo, municipal facilities cheaper. ~$17-28/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'EU citizens 65+ free entry to archaeological sites and museums.',
      notes: 'Free beaches, parks, hiking trails, ancient sites (seniors free).',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Public libraries limited but free. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts. Kafeneio culture affordable.',
      notes: 'Greek coffee/frapp\u00E9 ~\u20AC1.50-3.00. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function croatiaTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 190,
      seniorDiscounts: 'Marenda (set lunch) \u20AC7-10 at konobe. No tipping expected, rounding up common.',
      notes: `Lunch for 2 at konoba ~\u20AC18-20, 2x/week = ~\u20AC170/mo = ~$190/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 28,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'A1/T-Com/Iskon fiber \u20AC20-28/mo. ~$22-32/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 12,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC10.99/mo in Croatia. ~$12/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo. Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~\u20AC13/mo (~$15).',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 20,
      seniorDiscounts: 'Some municipal sports centres offer senior rates.',
      notes: 'Local gyms \u20AC15-25/mo. ~$17-28/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'National park entry fees \u20AC5-15, some senior discounts.',
      notes: 'Free beaches, parks, coastal walks. National parks have entry fees.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries (knji\u017Enica) free.',
      notes: 'Public libraries free. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 10,
      seniorDiscounts: 'No specific discounts. Coffee culture very affordable.',
      notes: 'Kava (coffee) ~\u20AC1.20-2.00. Budget for 2 visits/week. ~$10/mo.',
    },
  ];
  return buildResult(categories);
}

function cyprusTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 220,
      seniorDiscounts: 'Meze platters good value for 2. Service charge often included.',
      notes: `Lunch for 2 at taverna ~\u20AC22-25, 2x/week = ~\u20AC200/mo = ~$220/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 40,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'Cyta/Epic fiber \u20AC30-40/mo. ~$34-45/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo. Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~$15/mo.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 28,
      seniorDiscounts: 'Some municipal facilities offer senior rates.',
      notes: 'Local gyms \u20AC20-30/mo. ~$22-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Some archaeological sites offer senior discounts.',
      notes: 'Free beaches, parks, nature trails, coastal walks.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Public libraries available. Budget for books, English-language press.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 14,
      seniorDiscounts: 'No specific discounts.',
      notes: 'Cyprus coffee/frapp\u00E9 ~\u20AC2.00-3.50. Budget for 2 visits/week. ~$14/mo.',
    },
  ];
  return buildResult(categories);
}

function maltaTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 225,
      seniorDiscounts: 'Set lunch menus \u20AC10-15 at many restaurants.',
      notes: `Lunch for 2 at moderate restaurant ~\u20AC22-25, 2x/week = ~\u20AC200/mo = ~$225/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 40,
      seniorDiscounts: 'GO/Melita offer senior-friendly packages.',
      notes: 'GO/Melita fiber 1 Gig \u20AC30-40/mo. ~$34-45/mo.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 14,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC12.99/mo. ~$14/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 6,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC4.99/mo. Includes Prime Video. ~$6/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 8,
      seniorDiscounts: 'No senior discount.',
      notes: '\u20AC6.99/mo. ~$8/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'DAZN NFL Game Pass \u20AC19.99/mo during season. Annualized ~$15/mo.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 28,
      seniorDiscounts: 'Some local centres offer senior rates.',
      notes: 'Local gyms \u20AC20-30/mo. ~$22-34/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Heritage Malta card offers senior discounts for museums/sites.',
      notes: 'Free coastal walks, public gardens, swimming spots.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Public libraries free. English widely spoken. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 14,
      seniorDiscounts: 'No specific discounts.',
      notes: 'Coffee ~\u20AC2.00-3.50. Budget for 2 visits/week. ~$14/mo.',
    },
  ];
  return buildResult(categories);
}

function mexicoTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 180,
      seniorDiscounts: 'INAPAM senior card (60+) gives 10-25% discounts at restaurants, hotels, transport.',
      notes: `Lunch for 2 at moderate restaurant ~$20-22, 2x/week = ~$180/mo in ${locName}. Comida corrida (set lunch) ~$4-6/person.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 30,
      seniorDiscounts: 'INAPAM discount may apply to Telmex.',
      notes: 'Telmex/Totalplay fiber 200-500 Mbps $20-35/mo. True gig limited to major cities.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~MXN 99/mo. ~$5/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~MXN 99/mo. Includes Prime Video, free shipping. ~$5/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~MXN 99/mo. ~$5/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~MXN 349/mo during season. Annualized ~$18/mo.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 25,
      seniorDiscounts: 'INAPAM discounts at some gyms. Public parks with exercise equipment free.',
      notes: 'Smart Fit/Sport City MXN 400-600/mo (~$22-33). Municipal gyms cheaper.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'INAPAM gives free/reduced entry to national parks and archaeological sites.',
      notes: 'Free parks, plazas, beaches (coastal locations). Archaeological sites ~$4-8.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Public libraries free. English books at expat shops. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'INAPAM discounts at Sanborns, VIPs.',
      notes: 'Caf\u00E9 americano ~MXN 40-60 ($2-3). Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function colombiaTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 130,
      seniorDiscounts: 'Almuerzo ejecutivo (executive lunch) very affordable, ~$3-5/person.',
      notes: `Lunch for 2 at moderate restaurant ~$14-16, 2x/week = ~$130/mo in ${locName}. Set lunch ~$3-5/person.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 25,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'Claro/Movistar/ETB fiber 300-600 Mbps $18-30/mo. Gig available in major cities.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 4,
      seniorDiscounts: 'No senior discount.',
      notes: '~COP 17,000/mo. ~$4/mo.',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 3,
      seniorDiscounts: 'No senior discount.',
      notes: '~COP 14,900/mo. Includes Prime Video. ~$3/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 4,
      seniorDiscounts: 'No senior discount.',
      notes: '~COP 14,900/mo. ~$4/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 15,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~$15/mo annualized.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 20,
      seniorDiscounts: 'Cajas de compensaci\u00F3n offer subsidized gym access.',
      notes: 'Bodytech/Smart Fit COP 80,000-120,000/mo (~$18-28). Municipal options cheaper.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Seniors 62+ pay reduced fees at national parks.',
      notes: 'Free parks, plazas, hiking trails. National parks ~$5-15 entry.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries (Biblioteca P\u00FAblica) free.',
      notes: 'Libraries free. English books in expat bookshops. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 8,
      seniorDiscounts: 'No specific discounts. Coffee origin country, very affordable.',
      notes: 'Tinto (black coffee) ~COP 2,000-4,000 ($0.50-1). Specialty coffee $2-3. ~$8/mo.',
    },
  ];
  return buildResult(categories);
}

function costaRicaTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 170,
      seniorDiscounts: 'Ciudadano de oro (golden citizen, 65+) gets discounts at some restaurants.',
      notes: `Lunch for 2 at soda/moderate restaurant ~$18-22, 2x/week = ~$170/mo in ${locName}. Casado (set lunch) ~$5-8/person.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 40,
      seniorDiscounts: 'Kolbi (ICE) may offer senior rates.',
      notes: 'Kolbi/Tigo/Liberty fiber 100-300 Mbps $30-50/mo. True gig limited.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo (CRC pricing).',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo. Includes Prime Video. ~$5/mo.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~$18/mo annualized.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 30,
      seniorDiscounts: 'Some gyms offer senior rates.',
      notes: 'MultiSpa/local gyms CRC 15,000-25,000/mo (~$28-48). Municipal facilities cheaper.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Ciudadano de oro may get reduced national park entry.',
      notes: 'Free beaches, parks. National parks $10-18 entry for foreigners.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Libraries free. English books in expat shops. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts. Coffee origin country.',
      notes: 'Coffee ~$2-4 at cafes. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function ecuadorTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 120,
      seniorDiscounts: 'Tercera edad (65+) card gives 50% discounts at restaurants, flights, events.',
      notes: `Lunch for 2 at moderate restaurant ~$12-15, 2x/week = ~$120/mo in ${locName}. Almuerzo (set lunch) ~$2.50-4/person.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 35,
      seniorDiscounts: 'Tercera edad discounts may apply to CNT.',
      notes: 'CNT/Netlife fiber 100-300 Mbps $25-40/mo. Gig limited to Quito/Guayaquil.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo (local pricing).',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 4,
      seniorDiscounts: 'No senior discount.',
      notes: '~$4/mo. Includes Prime Video.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~$18/mo annualized.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 25,
      seniorDiscounts: 'Tercera edad discounts at municipal facilities.',
      notes: 'Local gyms $15-30/mo. Municipal facilities cheaper with senior card.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Tercera edad 50% off national park entry.',
      notes: 'Free parks, plazas. National parks $5-15 (50% senior discount).',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Libraries free. English books in expat bookshops. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 8,
      seniorDiscounts: 'Tercera edad discounts may apply.',
      notes: 'Coffee ~$1-2 at local cafes. Budget for 2 visits/week. ~$8/mo.',
    },
  ];
  return buildResult(categories);
}

function panamaTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 200,
      seniorDiscounts: 'Jubilado/pensionado card (women 55+, men 60+) gives 15-25% restaurant discounts.',
      notes: `Lunch for 2 at moderate restaurant ~$22-25, 2x/week = ~$200/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 45,
      seniorDiscounts: 'Jubilado 25% discount on utilities.',
      notes: 'Cable Onda/Tigo fiber 300 Mbps-1 Gig $35-55/mo. Jubilado discount applies.',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo (Latin America pricing).',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo. Includes Prime Video.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~$18/mo annualized.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 30,
      seniorDiscounts: 'Jubilado discounts at some gyms.',
      notes: 'PowerClub/local gyms $25-40/mo.',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Jubilado 25% off domestic flights, 50% off entertainment.',
      notes: 'Free parks, beaches, hiking. National parks $5-20 entry.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Libraries limited. English books in expat shops. Budget for books.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts.',
      notes: 'Coffee ~$2-4 at cafes. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

function uruguayTemplate(locName) {
  const categories = [
    {
      name: 'Dining Out',
      monthlyCost: 210,
      seniorDiscounts: 'Some restaurants offer senior menus. Parrilla (grill) culture, generous portions.',
      notes: `Lunch for 2 at moderate restaurant ~$24-26, 2x/week = ~$210/mo in ${locName}.`,
    },
    {
      name: 'Cable + 1 Gig Internet',
      monthlyCost: 40,
      seniorDiscounts: 'No specific senior discounts.',
      notes: 'Antel fiber 300 Mbps-1 Gig UYU 1,500-2,500/mo (~$35-55).',
    },
    {
      name: 'Netflix (Standard, no ads)',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo (Latin America pricing).',
    },
    {
      name: 'Amazon Prime',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo. Includes Prime Video.',
    },
    {
      name: 'Apple TV+',
      monthlyCost: 5,
      seniorDiscounts: 'No senior discount.',
      notes: '~$5/mo.',
    },
    {
      name: 'NFL RedZone',
      monthlyCost: 18,
      seniorDiscounts: 'No senior discount.',
      notes: 'NFL Game Pass International via DAZN ~$18/mo annualized.',
    },
    {
      name: 'Gym/Fitness',
      monthlyCost: 30,
      seniorDiscounts: 'Some municipal facilities offer senior rates.',
      notes: 'Local gyms UYU 1,500-3,000/mo (~$25-55).',
    },
    {
      name: 'Parks/Outdoors',
      monthlyCost: 0,
      seniorDiscounts: 'Free rambla (waterfront walk), parks.',
      notes: 'Free beaches, rambla, parks, plazas.',
    },
    {
      name: 'Books/Media',
      monthlyCost: 5,
      seniorDiscounts: 'Public libraries free.',
      notes: 'Public libraries free. Budget for books, English-language media.',
    },
    {
      name: 'Coffee/Cafes',
      monthlyCost: 12,
      seniorDiscounts: 'No specific discounts. Caf\u00E9 culture important.',
      notes: 'Caf\u00E9 con leche ~$2-3. Budget for 2 visits/week. ~$12/mo.',
    },
  ];
  return buildResult(categories);
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function buildResult(categories) {
  const typical = categories.reduce((sum, c) => sum + c.monthlyCost, 0);
  return {
    monthlyBudget: {
      min: Math.round(typical * 0.8),
      typical,
      max: Math.round(typical * 1.25),
    },
    categories,
  };
}

function getTemplate(country) {
  const map = {
    'United States': usTemplate,
    'France': franceTemplate,
    'Spain': spainTemplate,
    'Italy': italyTemplate,
    'Portugal': portugalTemplate,
    'Ireland': irelandTemplate,
    'Greece': greeceTemplate,
    'Croatia': croatiaTemplate,
    'Cyprus': cyprusTemplate,
    'Malta': maltaTemplate,
    'Mexico': mexicoTemplate,
    'Colombia': colombiaTemplate,
    'Costa Rica': costaRicaTemplate,
    'Ecuador': ecuadorTemplate,
    'Panama': panamaTemplate,
    'Uruguay': uruguayTemplate,
  };
  return map[country] || null;
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function main() {
  const locDirs = fs.readdirSync(DATA_DIR).filter(d =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  );

  let injected = 0;
  let skipped = 0;
  let errors = 0;

  for (const locId of locDirs) {
    const locJsonPath = path.join(DATA_DIR, locId, 'location.json');
    const detailedPath = path.join(DATA_DIR, locId, 'detailed-costs.json');

    if (!fs.existsSync(locJsonPath)) {
      console.log(`  SKIP ${locId}: no location.json`);
      skipped++;
      continue;
    }

    const locData = JSON.parse(fs.readFileSync(locJsonPath, 'utf8'));
    const country = locData.country;
    const locName = locData.name || locId;

    // Read or create detailed-costs.json
    let detailed = {};
    if (fs.existsSync(detailedPath)) {
      detailed = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
    }

    // Skip if already has entertainment
    if (detailed.entertainment && detailed.entertainment.categories && detailed.entertainment.categories.length > 0) {
      console.log(`  SKIP ${locId}: already has entertainment data`);
      skipped++;
      continue;
    }

    const templateFn = getTemplate(country);
    if (!templateFn) {
      console.log(`  ERROR ${locId}: no template for country "${country}"`);
      errors++;
      continue;
    }

    detailed.entertainment = templateFn(locName);
    fs.writeFileSync(detailedPath, JSON.stringify(detailed, null, 2) + '\n', 'utf8');
    console.log(`  INJECTED ${locId} (${country}): typical $${detailed.entertainment.monthlyBudget.typical}/mo`);
    injected++;

    // Sync to dashboard public dir
    const dashLocDir = path.join(DASHBOARD_DIR, locId);
    if (fs.existsSync(dashLocDir)) {
      const dashDetailedPath = path.join(dashLocDir, 'detailed-costs.json');
      // Read existing dashboard file to merge
      let dashDetailed = {};
      if (fs.existsSync(dashDetailedPath)) {
        dashDetailed = JSON.parse(fs.readFileSync(dashDetailedPath, 'utf8'));
      }
      dashDetailed.entertainment = detailed.entertainment;
      fs.writeFileSync(dashDetailedPath, JSON.stringify(dashDetailed, null, 2) + '\n', 'utf8');
    }
  }

  console.log(`\nDone: ${injected} injected, ${skipped} skipped, ${errors} errors (of ${locDirs.length} total locations)`);
}

main();
