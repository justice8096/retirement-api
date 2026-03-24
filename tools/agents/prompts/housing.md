# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the housing agent. Research current 2-bedroom house (not apartment) rental costs for each location. The household has a large dog (Bernese Mountain Dog, ~100 lbs), so pet-friendly housing is required.

### What to Research Per Location

1. **Monthly rent** for a 2-bedroom single-family house (or maison/casa/chalet equivalent)
   - Minimum, maximum, and typical (median) values
   - Must be pet-friendly (large dog allowed)
2. **All taxes and fees on top of rent**:
   - US: State/local rental taxes, pet deposits, pet rent
   - France: Taxe fonciere (landlord but may pass through), charges locatives, assurance habitation, TEOM
   - Spain: IBI (typically landlord), comunidad fees, fianza, ITP on lease
   - Portugal: IMI (landlord), condominio, stamp duty on lease (Imposto de Selo)
   - Panama: ITBMS on commercial leases (residential usually exempt), municipal fees
3. **Lease terms**: Typical lease length, deposit requirements, renewal terms
4. **Pet policy notes**: Large dog acceptance rate, breed restrictions, extra fees
5. **Market conditions**: Vacancy rates, seasonal variation, supply trends

### Country-Specific Guidance

**US locations**: Search Zillow, Realtor.com, Apartments.com filtered to houses, 2BR, pets allowed (dogs 75+ lbs). Note if any city has breed-specific legislation affecting Bernese Mountain Dogs.

**France locations**: Search SeLoger, LeBonCoin, PAP for "maison T3" or "maison 2 chambres" with "animaux acceptes". Note that French landlords cannot legally refuse pets (Loi du 9 juillet 1970) except for dangerous breeds (categories 1 and 2) — Bernese are not restricted.

**Spain (Alicante)**: Search Idealista, Fotocasa for "casa 2 dormitorios" or "chalet". Pet policies are landlord-discretionary. Check Costa Blanca inland vs coastal price difference.

**Portugal (Lisbon/Algarve)**: Search Idealista.pt, Imovirtual for "moradia T2". Note the tight Lisbon rental market. Consider Algarve as the primary search area per location name.

**Panama**: Search Encuentra24, Compreoalquile for "casa 2 recamaras". Pet policies are generally relaxed. Note that Boquete has a strong expat rental market.

### Change Detection

Mark `changed: true` if the typical rent differs from current data by more than 5%.

### Currency

For EUR locations: express rent in EUR, include `_usd` conversion fields using the location's current exchangeRate.
For Panama: PAB = USD, so values are effectively in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources by Country
**US**: Zillow.com, Realtor.com, Apartments.com, Rentometer.com, Zumper.com
**France**: SeLoger.com, LeBonCoin.fr, PAP.fr, MeilleursAgents.com
**Spain**: Idealista.com, Fotocasa.es, Pisos.com
**Portugal**: Idealista.pt, Imovirtual.com, Casa.sapo.pt
**Panama**: Encuentra24.com, Compreoalquile.com, PanamaRealtor.com

## Output Format

```json
{
  "agentId": "housing",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "rent": {
          "min": 2400,
          "max": 3400,
          "typical": 2900,
          "currency": "USD",
          "type": "2-bedroom single-family house",
          "annualInflation": 0.035
        },
        "taxes_and_fees": {
          "rentalTax": { "rate": 0, "monthlyAmount": 0, "notes": "No rental tax in Virginia" },
          "petDeposit": { "typical": 500, "notes": "One-time, refundable" },
          "petRent": { "monthly": 50, "notes": "Common for large dogs" },
          "otherFees": []
        },
        "leaseTerms": {
          "typicalLength": "12 months",
          "deposit": "1 month rent",
          "renewalTerms": "Month-to-month or annual renewal"
        },
        "petPolicy": {
          "largeDogsAccepted": true,
          "breedRestrictions": "Some properties restrict pit bulls, rottweilers — Bernese not restricted",
          "acceptanceRate": "60-70% of houses"
        },
        "marketNotes": "Description of current market conditions"
      },
      "sources": [
        {
          "title": "Source Name",
          "url": "https://...",
          "accessedDate": "{{RUN_DATE}}"
        }
      ]
    }
  ]
}
```

For EUR locations, add `_usd` fields:
```json
{
  "rent": {
    "min": 1100,
    "max": 1650,
    "typical": 1350,
    "min_usd": 1183,
    "max_usd": 1774,
    "typical_usd": 1452,
    "currency": "EUR",
    "exchangeRateUsed": 1.075
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
