import { readFileSync, writeFileSync } from 'fs';

// Entertainment data per location
// Dining Out: lunch for 2, 2x/week (8.67 lunches/mo), moderate restaurant, incl tax+tip
// Cable + 1 Gig Internet: local provider rates
// Netflix Standard (no ads): regional pricing
// Amazon Prime: regional pricing (includes Prime Video)
// Apple TV+: regional pricing
// Removed: Theater/Concerts, Museums/Galleries

var entertainmentData = {
  "us-virginia": {
    monthlyBudget: { min: 440, typical: 530, max: 650 },
    categories: [
      { name: "Dining Out", monthlyCost: 355, seniorDiscounts: "Many restaurants offer 10-15% senior discounts. AARP members get discounts at Denny's, Outback, and others.",
        notes: "Lunch for 2 at moderate restaurant ~$35 + 6% tax + 20% tip = ~$44/meal, 2x/week (~8.7/mo) = ~$355/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 75, seniorDiscounts: "Some providers offer senior plans. Xfinity 5-year price lock at $60/mo available.",
        notes: "Xfinity 1 Gig $60-70/mo or Verizon FiOS $75/mo. No data caps." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.",
        notes: "$17.99/mo. 1080p, 2 screens, full library." },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.",
        notes: "$14.99/mo includes Prime Video, free shipping, Prime Reading." },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount. Annual plan $99/yr ($8.25/mo).",
        notes: "$12.99/mo. Original content library." },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "SilverSneakers free gym membership through many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "America the Beautiful Senior Pass $20/year (lifetime $80) for national parks." },
      { name: "Books/Library", monthlyCost: 10, seniorDiscounts: "Fairfax County Library system free. Senior book clubs and digital resources." },
      { name: "Coffee/Cafes", monthlyCost: 25, seniorDiscounts: "McDonald's and Dunkin' offer senior coffee discounts in some locations." }
    ],
    sources: [
      { title: "Xfinity 1 Gig Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" },
      { title: "AARP Member Discounts", url: "https://www.aarp.org/membership/benefits/discounts/" }
    ]
  },
  "us-florida": {
    monthlyBudget: { min: 400, typical: 500, max: 620 },
    categories: [
      { name: "Dining Out", monthlyCost: 330, seniorDiscounts: "Early bird specials common in FL. AARP restaurant discounts widely accepted.",
        notes: "Lunch for 2 at moderate restaurant ~$32 + 6% tax + 20% tip = ~$40/meal, 2x/week = ~$330/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 70, seniorDiscounts: "AT&T and Xfinity offer senior/AARP discounts on select plans.",
        notes: "Xfinity 1 Gig $60-70/mo or AT&T Fiber $80/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.", notes: "$17.99/mo" },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.", notes: "$14.99/mo" },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount.", notes: "$12.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "SilverSneakers free with many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "FL state parks senior discount. National parks Senior Pass." },
      { name: "Books/Library", monthlyCost: 10, seniorDiscounts: "Free library system." },
      { name: "Coffee/Cafes", monthlyCost: 20, seniorDiscounts: "Senior coffee discounts at major chains." }
    ],
    sources: [
      { title: "Xfinity Florida Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" }
    ]
  },
  "us-savannah": {
    monthlyBudget: { min: 380, typical: 480, max: 600 },
    categories: [
      { name: "Dining Out", monthlyCost: 310, seniorDiscounts: "Southern restaurants often have lunch specials. AARP discounts at chains.",
        notes: "Lunch for 2 at moderate restaurant ~$30 + 7% tax + 20% tip = ~$38/meal, 2x/week = ~$310/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 70, seniorDiscounts: "Xfinity and AT&T serve Savannah area.",
        notes: "Xfinity 1 Gig $60-70/mo or AT&T Fiber $80/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.", notes: "$17.99/mo" },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.", notes: "$14.99/mo" },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount.", notes: "$12.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 20, seniorDiscounts: "SilverSneakers free with many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "Savannah has many free parks and squares." },
      { name: "Books/Library", monthlyCost: 8, seniorDiscounts: "Live Oak Public Libraries free." },
      { name: "Coffee/Cafes", monthlyCost: 20, seniorDiscounts: "Senior coffee discounts at major chains." }
    ],
    sources: [
      { title: "Xfinity Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" }
    ]
  },
  "us-richmond": {
    monthlyBudget: { min: 400, typical: 500, max: 620 },
    categories: [
      { name: "Dining Out", monthlyCost: 330, seniorDiscounts: "AARP restaurant discounts available at many chains.",
        notes: "Lunch for 2 at moderate restaurant ~$32 + 5.3% tax + 20% tip = ~$40/meal, 2x/week = ~$330/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 70, seniorDiscounts: "Xfinity and Verizon FiOS available in Richmond.",
        notes: "Xfinity 1 Gig $60-70/mo or Verizon FiOS $75/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.", notes: "$17.99/mo" },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.", notes: "$14.99/mo" },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount.", notes: "$12.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "SilverSneakers free with many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "James River Park System free. VA state parks senior discount." },
      { name: "Books/Library", monthlyCost: 10, seniorDiscounts: "Richmond Public Library free." },
      { name: "Coffee/Cafes", monthlyCost: 20, seniorDiscounts: "Senior coffee discounts at major chains." }
    ],
    sources: [
      { title: "Xfinity Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" }
    ]
  },
  "us-philadelphia": {
    monthlyBudget: { min: 420, typical: 530, max: 660 },
    categories: [
      { name: "Dining Out", monthlyCost: 355, seniorDiscounts: "AARP restaurant discounts. Many Philly restaurants offer lunch specials.",
        notes: "Lunch for 2 at moderate restaurant ~$34 + 8% tax + 20% tip = ~$44/meal, 2x/week = ~$355/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 70, seniorDiscounts: "Xfinity headquartered in Philadelphia, competitive pricing.",
        notes: "Xfinity 1 Gig $60-70/mo or Verizon FiOS $75/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.", notes: "$17.99/mo" },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.", notes: "$14.99/mo" },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount.", notes: "$12.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "SilverSneakers free with many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "Fairmount Park free. National parks Senior Pass." },
      { name: "Books/Library", monthlyCost: 10, seniorDiscounts: "Free Library of Philadelphia." },
      { name: "Coffee/Cafes", monthlyCost: 25, seniorDiscounts: "Senior coffee discounts at major chains." }
    ],
    sources: [
      { title: "Xfinity Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" }
    ]
  },
  "us-cherry-hill": {
    monthlyBudget: { min: 420, typical: 520, max: 640 },
    categories: [
      { name: "Dining Out", monthlyCost: 345, seniorDiscounts: "AARP restaurant discounts. Cherry Hill Mall area dining options.",
        notes: "Lunch for 2 at moderate restaurant ~$33 + 6.625% tax + 20% tip = ~$42/meal, 2x/week = ~$345/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 70, seniorDiscounts: "Xfinity and Verizon FiOS available.",
        notes: "Xfinity 1 Gig $60-70/mo or Verizon FiOS $75/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 18, seniorDiscounts: "T-Mobile 55+ plans include Netflix.", notes: "$17.99/mo" },
      { name: "Amazon Prime", monthlyCost: 15, seniorDiscounts: "Medicaid recipients qualify for Prime at $6.99/mo.", notes: "$14.99/mo" },
      { name: "Apple TV+", monthlyCost: 13, seniorDiscounts: "No senior discount.", notes: "$12.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "SilverSneakers free with many Medicare Advantage plans." },
      { name: "Parks/Outdoors", monthlyCost: 10, seniorDiscounts: "NJ state parks. Cooper River Park free." },
      { name: "Books/Library", monthlyCost: 8, seniorDiscounts: "Camden County Library system free." },
      { name: "Coffee/Cafes", monthlyCost: 20, seniorDiscounts: "Senior coffee discounts at major chains." }
    ],
    sources: [
      { title: "Xfinity Plans", url: "https://www.xfinity.com/gig" },
      { title: "Netflix Pricing", url: "https://help.netflix.com/en/node/24926" }
    ]
  },
  // France: EUR prices converted at ~1.08 USD/EUR
  // Dining: Menu du jour lunch for 2 ~€28-32 (service included, no tip expected) = ~$32/meal
  // Internet: Free/Orange 1 Gig fiber ~€30/mo = ~$32/mo
  // Netflix Standard: €14.99 = ~$16/mo
  // Amazon Prime: €6.99/mo = ~$8/mo
  // Apple TV+: €9.99/mo = ~$11/mo
  "france-brittany": {
    monthlyBudget: { min: 310, typical: 380, max: 480 },
    categories: [
      { name: "Dining Out", monthlyCost: 275, seniorDiscounts: "Menu du jour typically includes 2-3 courses. No tipping expected (service compris).",
        notes: "Lunch for 2 at moderate restaurant: menu du jour ~€28 (service included), 2x/week = ~€243/mo = ~$275/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 32, seniorDiscounts: "No specific senior discounts. Highly competitive market keeps prices low.",
        notes: "Free Freebox 1 Gig €24.99/mo or Orange Livebox Fibre €29.99/mo. Includes TV channels." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 16, seniorDiscounts: "No senior discount.", notes: "€14.99/mo in France." },
      { name: "Amazon Prime", monthlyCost: 8, seniorDiscounts: "No senior discount.", notes: "€6.99/mo (€69.90/yr) includes Prime Video, free delivery." },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo in Eurozone." },
      { name: "Gym/Fitness", monthlyCost: 30, seniorDiscounts: "Municipal facilities offer senior rates. Basic Fit from €19.99/mo.",
        notes: "Basic Fit, municipal pools and gyms." },
      { name: "Books/Media", monthlyCost: 15, seniorDiscounts: "Médiathèques free with carte de résident.",
        notes: "Libraries free. Books, newspapers." },
      { name: "Coffee/Cafes", monthlyCost: 20, seniorDiscounts: "No specific discounts. Café culture is affordable.", notes: "Café crème ~€2.50-3.50." }
    ],
    sources: [
      { title: "Free Freebox Fibre", url: "https://www.free.fr/freebox" },
      { title: "Netflix France", url: "https://help.netflix.com/fr/node/24926" },
      { title: "Orange Internet France", url: "https://en.selectra.info/broadband-phone-france/providers/orange/internet" }
    ]
  },
  "france-lyon": {
    monthlyBudget: { min: 340, typical: 410, max: 520 },
    categories: [
      { name: "Dining Out", monthlyCost: 300, seniorDiscounts: "Bouchons lyonnais offer excellent value prix fixe menus. No tipping expected.",
        notes: "Lunch for 2 at moderate restaurant/bouchon: ~€30 (service included), 2x/week = ~€260/mo = ~$300/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 32, seniorDiscounts: "Competitive market.",
        notes: "Free/Orange/SFR 1 Gig fibre €25-30/mo. Includes TV." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 16, seniorDiscounts: "No senior discount.", notes: "€14.99/mo" },
      { name: "Amazon Prime", monthlyCost: 8, seniorDiscounts: "No senior discount.", notes: "€6.99/mo" },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 30, seniorDiscounts: "Municipal facilities offer senior rates." },
      { name: "Books/Media", monthlyCost: 15, seniorDiscounts: "Bibliothèque municipale free." },
      { name: "Coffee/Cafes", monthlyCost: 22, seniorDiscounts: "No specific discounts.", notes: "Lyon café scene slightly pricier than rural Brittany." }
    ],
    sources: [
      { title: "Free Freebox Fibre", url: "https://www.free.fr/freebox" },
      { title: "Netflix France", url: "https://help.netflix.com/fr/node/24926" }
    ]
  },
  "france-montpellier": {
    monthlyBudget: { min: 310, typical: 380, max: 480 },
    categories: [
      { name: "Dining Out", monthlyCost: 275, seniorDiscounts: "Menu du jour widely available. No tipping expected.",
        notes: "Lunch for 2 at moderate restaurant: ~€28 (service included), 2x/week = ~€243/mo = ~$275/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 32, seniorDiscounts: "Competitive market.",
        notes: "Free/Orange/SFR 1 Gig fibre €25-30/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 16, seniorDiscounts: "No senior discount.", notes: "€14.99/mo" },
      { name: "Amazon Prime", monthlyCost: 8, seniorDiscounts: "No senior discount.", notes: "€6.99/mo" },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "Municipal facilities offer senior rates." },
      { name: "Books/Media", monthlyCost: 15, seniorDiscounts: "Médiathèques free." },
      { name: "Coffee/Cafes", monthlyCost: 18, seniorDiscounts: "No specific discounts.", notes: "Affordable café culture." }
    ],
    sources: [
      { title: "Free Freebox Fibre", url: "https://www.free.fr/freebox" },
      { title: "Netflix France", url: "https://help.netflix.com/fr/node/24926" }
    ]
  },
  "france-toulouse": {
    monthlyBudget: { min: 310, typical: 380, max: 480 },
    categories: [
      { name: "Dining Out", monthlyCost: 275, seniorDiscounts: "Excellent lunch menus throughout the city. No tipping expected.",
        notes: "Lunch for 2 at moderate restaurant: ~€28 (service included), 2x/week = ~€243/mo = ~$275/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 32, seniorDiscounts: "Competitive market.",
        notes: "Free/Orange/SFR 1 Gig fibre €25-30/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 16, seniorDiscounts: "No senior discount.", notes: "€14.99/mo" },
      { name: "Amazon Prime", monthlyCost: 8, seniorDiscounts: "No senior discount.", notes: "€6.99/mo" },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo" },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "Municipal facilities offer senior rates." },
      { name: "Books/Media", monthlyCost: 15, seniorDiscounts: "Médiathèques free." },
      { name: "Coffee/Cafes", monthlyCost: 18, seniorDiscounts: "No specific discounts." }
    ],
    sources: [
      { title: "Free Freebox Fibre", url: "https://www.free.fr/freebox" },
      { title: "Netflix France", url: "https://help.netflix.com/fr/node/24926" }
    ]
  },
  // Spain: EUR prices, moderate lunch ~€24 for 2 (IVA included, small tip ~5%)
  "spain-alicante": {
    monthlyBudget: { min: 280, typical: 350, max: 440 },
    categories: [
      { name: "Dining Out", monthlyCost: 245, seniorDiscounts: "Menu del día excellent value (€10-14 for 3 courses). Small tip 5-10% customary.",
        notes: "Lunch for 2: menú del día ~€24 + 5% tip = ~€25, 2x/week = ~€217/mo = ~$245/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 38, seniorDiscounts: "No specific senior discounts.",
        notes: "Movistar/Orange/MásMóvil 1 Gig fibre €30-40/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 14, seniorDiscounts: "No senior discount.", notes: "€12.99/mo in Spain." },
      { name: "Amazon Prime", monthlyCost: 5, seniorDiscounts: "No senior discount.", notes: "€4.99/mo (€49.90/yr) in Spain." },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo in Eurozone." },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "Municipal gyms offer senior rates." },
      { name: "Books/Media", monthlyCost: 12, seniorDiscounts: "Public libraries free." },
      { name: "Coffee/Cafes", monthlyCost: 15, seniorDiscounts: "Café con leche ~€1.50-2.50." }
    ],
    sources: [
      { title: "Movistar Internet", url: "https://www.movistar.es/internet/" },
      { title: "Netflix Spain", url: "https://help.netflix.com/es/node/24926" }
    ]
  },
  // Portugal: EUR prices, moderate lunch ~€22 for 2 (IVA included, small tip ~5-10%)
  "portugal-lisbon": {
    monthlyBudget: { min: 280, typical: 350, max: 440 },
    categories: [
      { name: "Dining Out", monthlyCost: 240, seniorDiscounts: "Prato do dia (dish of the day) excellent value. Small tip 5-10% customary.",
        notes: "Lunch for 2 at moderate restaurant: ~€22 + 10% tip = ~€24, 2x/week = ~€209/mo = ~$240/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 38, seniorDiscounts: "No specific senior discounts.",
        notes: "MEO/NOS/Vodafone 1 Gig fibre €30-40/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 15, seniorDiscounts: "No senior discount.", notes: "€13.99/mo in Portugal." },
      { name: "Amazon Prime", monthlyCost: 5, seniorDiscounts: "No senior discount.", notes: "€4.99/mo in Portugal." },
      { name: "Apple TV+", monthlyCost: 11, seniorDiscounts: "No senior discount.", notes: "€9.99/mo in Eurozone." },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "Municipal gyms offer senior rates." },
      { name: "Books/Media", monthlyCost: 12, seniorDiscounts: "Public libraries free." },
      { name: "Coffee/Cafes", monthlyCost: 15, seniorDiscounts: "Pastel de nata + café ~€2-3. Very affordable.", notes: "Coffee culture is a way of life." }
    ],
    sources: [
      { title: "MEO Internet", url: "https://www.meo.pt/internet" },
      { title: "Netflix Portugal", url: "https://help.netflix.com/pt/node/24926" }
    ]
  },
  // Panama: USD prices, moderate lunch ~$18-22 for 2, tip 10%
  "panama-city": {
    monthlyBudget: { min: 300, typical: 370, max: 470 },
    categories: [
      { name: "Dining Out", monthlyCost: 235, seniorDiscounts: "Jubilado (retiree) discounts 10-25% at many restaurants by law.",
        notes: "Lunch for 2 at moderate restaurant: ~$22 + 7% ITBMS + 10% tip = ~$27, 2x/week = ~$235/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 65, seniorDiscounts: "Jubilado discount 25% on utilities including internet.",
        notes: "Cable Onda/+Movil 100-300 Mbps $40-60/mo. True 1 Gig ~$65-80/mo." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 14, seniorDiscounts: "No senior discount.", notes: "~$13.99/mo in Panama (USD pricing)." },
      { name: "Amazon Prime", monthlyCost: 7, seniorDiscounts: "No senior discount.", notes: "~$6.99/mo (Prime Video standalone)." },
      { name: "Apple TV+", monthlyCost: 10, seniorDiscounts: "No senior discount.", notes: "~$9.99/mo." },
      { name: "Gym/Fitness", monthlyCost: 25, seniorDiscounts: "Jubilado discounts at many gyms." },
      { name: "Books/Media", monthlyCost: 8, seniorDiscounts: "Limited English-language libraries." },
      { name: "Coffee/Cafes", monthlyCost: 15, seniorDiscounts: "Jubilado discounts 15-25% at cafes." }
    ],
    sources: [
      { title: "Cable Onda Internet", url: "https://www.cableonda.com" },
      { title: "Panama Jubilado Discounts", url: "https://www.visitpanama.com" }
    ]
  },
  "panama-boquete": {
    monthlyBudget: { min: 260, typical: 330, max: 420 },
    categories: [
      { name: "Dining Out", monthlyCost: 200, seniorDiscounts: "Jubilado discounts 10-25% at restaurants by law. Smaller town = lower prices.",
        notes: "Lunch for 2 at moderate restaurant: ~$18 + 7% ITBMS + 10% tip = ~$23, 2x/week = ~$200/mo" },
      { name: "Cable + 1 Gig Internet", monthlyCost: 55, seniorDiscounts: "Jubilado discount 25% on utilities.",
        notes: "Cable Onda in Boquete. 100-300 Mbps ~$35-55/mo. True gigabit limited availability." },
      { name: "Netflix (Standard, no ads)", monthlyCost: 14, seniorDiscounts: "No senior discount.", notes: "~$13.99/mo." },
      { name: "Amazon Prime", monthlyCost: 7, seniorDiscounts: "No senior discount.", notes: "~$6.99/mo." },
      { name: "Apple TV+", monthlyCost: 10, seniorDiscounts: "No senior discount.", notes: "~$9.99/mo." },
      { name: "Gym/Fitness", monthlyCost: 20, seniorDiscounts: "Jubilado discounts. Smaller selection than Panama City." },
      { name: "Books/Media", monthlyCost: 8, seniorDiscounts: "Boquete Library has English section." },
      { name: "Coffee/Cafes", monthlyCost: 15, seniorDiscounts: "Jubilado discounts. World-class Geisha coffee.", notes: "Boquete is famous for its coffee." }
    ],
    sources: [
      { title: "Cable Onda Internet", url: "https://www.cableonda.com" },
      { title: "Panama Jubilado Discounts", url: "https://www.visitpanama.com" }
    ]
  }
};

var idx = JSON.parse(readFileSync('data/index.json'));

idx.locations.forEach(function(entry) {
  var id = entry.id;
  var entData = entertainmentData[id];
  if (!entData) { console.log('No entertainment data for: ' + id); return; }

  // Update detailed-costs.json
  var dcPath = 'data/locations/' + id + '/detailed-costs.json';
  try {
    var dc = JSON.parse(readFileSync(dcPath));
    dc.entertainment = entData;
    writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n');
    console.log('Updated detailed-costs: ' + id);
  } catch (e) {
    console.log('No detailed-costs.json for: ' + id + ' (' + e.message + ')');
  }

  // Update location.json entertainment in monthlyCosts
  var locPath = 'data/locations/' + id + '/location.json';
  var loc = JSON.parse(readFileSync(locPath));
  if (loc.monthlyCosts && loc.monthlyCosts.entertainment) {
    loc.monthlyCosts.entertainment.min = entData.monthlyBudget.min;
    loc.monthlyCosts.entertainment.typical = entData.monthlyBudget.typical;
    loc.monthlyCosts.entertainment.max = entData.monthlyBudget.max;
    loc.monthlyCosts.entertainment.notes = 'Incl cable+1Gig internet, Netflix, Amazon Prime, Apple TV+, dining out (lunch for 2 2x/week w/ tax+tip)';
    writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n');
    console.log('Updated location.json: ' + id + ' → typical $' + entData.monthlyBudget.typical + '/mo');
  }
});

console.log('Done.');
