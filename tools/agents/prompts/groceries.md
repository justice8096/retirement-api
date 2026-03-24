# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the groceries agent. Research food prices for each location to estimate monthly grocery costs for a 2-adult household. The household also feeds a large dog (Bernese Mountain Dog, ~100 lbs) but dog food is tracked under petcare, not groceries.

### What to Research Per Location

1. **Weekly grocery basket cost** — Based on a standard basket of ~40 items covering:
   - Proteins: chicken breast (1kg), ground beef (500g), eggs (dozen), canned tuna (4 cans)
   - Dairy: milk (1 gal/4L), cheese (500g), yogurt (1kg), butter (250g)
   - Produce: bananas (1kg), apples (1kg), tomatoes (1kg), onions (1kg), lettuce (head), potatoes (2kg), carrots (1kg)
   - Grains: bread (loaf), rice (1kg), pasta (500g), cereal (box)
   - Pantry: cooking oil (1L), sugar (1kg), flour (1kg), coffee (250g), tea (box)
   - Beverages: water (6-pack 1.5L), juice (1L), wine (750ml table wine)
   - Household: dish soap, laundry detergent, paper towels, toilet paper

2. **Monthly total** — Weekly basket x 4.33 weeks
3. **Min/max range** — Budget shopping (discount stores) vs premium/organic
4. **Store options** — Major grocery chains available in each location
5. **Special notes** — Import costs for specific items, seasonal availability, tax on groceries

### Country-Specific Notes

**US**: No federal grocery tax, but some states tax certain items. Prices vary significantly by region (NOVA is 15-20% above national average). Stores: Costco, Trader Joe's, Aldi, Publix, Kroger, Harris Teeter, Wegmans (varies by state).

**France**: TVA reduced rate 5.5% on most food (already included in shelf price). Excellent markets (marches) for produce. Stores: Carrefour, Leclerc, Auchan, Lidl, Intermarche. Wine is very affordable.

**Spain**: IVA superreducido 4% on staples (bread, milk, eggs, produce), 10% on other food. Stores: Mercadona, Carrefour, Lidl, Aldi, Dia. Excellent fresh markets.

**Portugal**: IVA 6% on essentials, 13% on some food, 23% on some processed items. Stores: Continente, Pingo Doce, Lidl, Auchan. Affordable fresh fish.

**Panama**: ITBMS 7% on most items, but basic food basket (canasta basica) is price-controlled and tax-exempt. Pensionado discount 15% on food at some establishments. Stores: Super99, Riba Smith, PriceSmart (Costco equivalent), El Rey.

### Change Detection

Mark `changed: true` if monthly typical cost differs by more than 5%.

### Currency

EUR locations: costs in EUR with `_usd` conversion fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**Global**: Numbeo.com (grocery prices), Expatistan.com
**US**: USDA Food Plans, BLS Consumer Price Index — Food, local grocery store websites
**France**: INSEE (consumer prices), Courses-en-ligne.carrefour.fr, drive.leclerc
**Spain**: INE (IPC alimentacion), Compra-online.mercadona.es
**Portugal**: INE.pt (IPC), Continente.pt, PingoDoce.pt
**Panama**: ACODECO.gob.pa (price monitoring), Super99.com

## Output Format

```json
{
  "agentId": "groceries",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "weeklyBasketCost": {
          "budget": 250,
          "typical": 370,
          "premium": 480,
          "currency": "USD"
        },
        "monthlyCost": {
          "min": 1083,
          "typical": 1602,
          "max": 2078,
          "currency": "USD",
          "annualInflation": 0.03
        },
        "stores": ["Harris Teeter", "Wegmans", "Costco", "Trader Joe's", "Aldi"],
        "groceryTax": "Virginia exempts most groceries from sales tax since 2023",
        "notes": "Northern Virginia prices 15-20% above national average"
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` fields:
```json
{
  "weeklyBasketCost": {
    "budget": 150, "typical": 220, "premium": 300,
    "budget_usd": 161, "typical_usd": 237, "premium_usd": 323,
    "currency": "EUR",
    "exchangeRateUsed": 1.075
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
