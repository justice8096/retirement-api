# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the transportation agent. Research monthly transportation costs for each location. The household has 2 adults and a large dog. They will likely need a car in most locations but also want to understand public transit options.

### Categories to Research (per location)

1. **Public Transit** — Monthly pass cost (senior/retiree discounts if available). Coverage quality (1-10). Dog policy on transit.
2. **Ride-Share** — Uber/Lyft/Bolt/Cabify average cost for a 5-mile urban trip. Estimated monthly spend for 4 trips/month.
3. **Car Ownership** — Monthly cost assuming 1 owned vehicle (paid off):
   - Insurance (liability + comprehensive for retirees, clean record)
   - Fuel (estimate 600 miles/month, local gas price per gallon/liter)
   - Maintenance (oil, tires, general — amortized monthly)
   - Registration/inspection fees (amortized monthly)
   - Parking (if applicable — residential permit or typical monthly)
   - Road tax / vehicle tax (if applicable, e.g., France carte grise, Spain IVTM, Portugal IUC)
4. **Total Monthly Transportation** — Sum of car ownership + estimated transit/ride-share usage.

### Country-Specific Notes

**US**: Car insurance varies enormously by state. Use rates for a 2020 mid-size SUV (for the dog), clean record, retirees. Gas in USD/gallon.

**France**: Carte grise is one-time. Control technique (inspection) every 2 years. Gas in EUR/liter. Vignette Crit'Air required in LEZ cities (Lyon, Montpellier, Toulouse). Senior transit discounts via carte senior.

**Spain**: IVTM (road tax) is municipal, paid annually. ITV inspection. Gas in EUR/liter. Alicante has TRAM light rail.

**Portugal**: IUC (vehicle tax) annual. IPO inspection. Gas in EUR/liter — among highest in Europe. Lisbon has excellent Metro + Navegante pass.

**Panama**: Gas is cheap (government subsidized). No annual vehicle tax on older cars. Ride-share via Uber, InDriver. Boquete has limited transit — car essential.

### Change Detection

Mark `changed: true` if total monthly transportation cost differs by more than 5%.

### Currency

EUR locations: all values in local EUR with `_usd` conversion fields.
Panama: values in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**Insurance**: TheZebra.com, NerdWallet.com (US); LeLynx.fr (France); Rastreator.com (Spain); ComparaJa.pt (Portugal)
**Fuel**: GasBuddy.com (US); prix-carburants.gouv.fr (France); dieselogasolina.com (Spain); precoscombustiveis.dgeg.gov.pt (Portugal)
**Transit**: Local transit authority websites (WMATA, SEPTA, MARTA, TCL Lyon, TRAM Alicante, Navegante Lisbon, MiBus Panama)
**Ride-Share**: Uber.com/estimate, Bolt.eu

## Output Format

```json
{
  "agentId": "transportation",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "publicTransit": {
          "monthlyPass": 100,
          "seniorDiscount": "Half-fare with Senior SmarTrip",
          "seniorPassCost": 50,
          "coverageQuality": 7,
          "dogPolicy": "Service animals only on Metro; no pets on bus",
          "currency": "USD"
        },
        "rideShare": {
          "avgCostPer5Miles": 15,
          "monthlyEstimate4Trips": 60,
          "providers": ["Uber", "Lyft"],
          "currency": "USD"
        },
        "carOwnership": {
          "insurance": 120,
          "fuel": 150,
          "maintenance": 75,
          "registrationInspection": 15,
          "parking": 0,
          "roadTax": 0,
          "monthlyTotal": 360,
          "currency": "USD",
          "assumptions": "2020 mid-size SUV, 600 mi/mo, $3.50/gal, clean record"
        },
        "monthlyTotal": 420,
        "currency": "USD"
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` suffixed fields for all costs and totals.

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
