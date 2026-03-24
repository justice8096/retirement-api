# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the utilities agent. Research monthly utility costs for a 2-bedroom house at each location. Utilities tracked here are those NOT included in rent: electricity, natural gas, water, sewage, and trash collection. Internet is tracked by the entertainment agent (Cable + 1 Gig Internet).

### What to Research Per Location

For each utility:
1. **Monthly cost** — min, typical (average), max across seasons
2. **Provider** — Name of the utility company/provider
3. **Rate structure** — Per-kWh, per-therm, per-m3, flat rate, tiered
4. **Taxes on utilities** — What tax applies (sales tax, TVA, IVA, etc.)
5. **Notes** — Seasonal variation, subsidy programs, prepayment options

### Utility Breakdown

1. **Electricity** — Heating/cooling load is key driver. Hot-summer locations (FL, GA, TX, Spain, Panama) have high summer A/C. Cold-winter locations (NJ, VA, France) have high winter heating (if electric). Estimate based on ~1,000 sq ft 2BR house.
2. **Natural Gas** — Heating, cooking, water heater. Not all locations use gas (some are all-electric). Panama is typically all-electric.
3. **Water** — Estimate for 2-adult household (~5,000-7,000 gallons/month or ~20-25 m3/month).
4. **Sewage** — Often billed with water. Note if included in water bill or separate.
5. **Trash** — Municipal collection. Note if included in rent, property tax, or billed separately.

### Country-Specific Notes

**US**: Electricity deregulated in some states (TX, PA). Gas via local utility. Water/sewer typically municipal. Trash varies (municipal, private, included in HOA). No federal utility tax; some states exempt residential utilities from sales tax.

**France**: Electricity via EDF or alternative (Engie, Total Energies). Gas via GRDF network. Water via Veolia/Suez. TEOM (trash tax) often included in rent via charges. TVA: 5.5% water, 20% electricity/gas. Tarif reglemente available for small consumers.

**Spain**: Electricity via Iberdrola, Endesa, Naturgy. PVPC (regulated tariff) or free market. Gas via Naturgy. Water is municipal. IVA 21% on electricity, 10% on water. Bono social discount available for low-income/retirees.

**Portugal**: Electricity via EDP or alternatives (Galp, Endesa). Gas via Galp/EDP. Water is municipal. IVA 6% on water, 23% on electricity/gas. Tarifa social available.

**Panama**: Electricity via Naturgy (Panama City), BEP (Boquete area). No natural gas — all-electric with propane for some cooking. Water via IDAAN (very cheap, ~$5-10/mo). No sewage bill in most areas. Trash is municipal. ITBMS 7% on electricity.

### Special Considerations

- For locations where some utilities are included in rent (e.g., TEOM in France, water in some Panama rentals), note this and set the value to 0 with an explanation.
- Seasonal variation matters: provide a note about summer vs winter costs.
- A/C usage is critical for warm-climate locations.

### Change Detection

Mark `changed: true` if total monthly utility cost differs by more than 5%.

### Currency

EUR locations: costs in EUR with `_usd` conversion fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: EIA.gov (electricity rates by state), local utility company websites (Dominion, PSE&G, Duke Energy, Georgia Power, FPL, etc.)
**France**: EDF.fr, Engie.fr, CRE.fr (energy regulator), services-eau.fr
**Spain**: REE.es (Red Electrica), Iberdrola.es, CNMC.es (regulator), Endesa.com
**Portugal**: ERSE.pt (energy regulator), EDP.pt, Pordata.pt (statistics)
**Panama**: ASEP.gob.pa (regulator), Naturgy.com.pa, IDAAN.gob.pa

## Output Format

```json
{
  "agentId": "utilities",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "electricity": {
          "typical": 155,
          "min": 100,
          "max": 220,
          "provider": "Dominion Energy",
          "ratePerKwh": 0.13,
          "currency": "USD",
          "notes": "Avg across seasons — $100 winter, $220 summer A/C"
        },
        "gas": {
          "typical": 65,
          "min": 30,
          "max": 110,
          "provider": "Washington Gas",
          "currency": "USD",
          "notes": "Natural gas heating (Nov-Mar), cooking, water heater"
        },
        "water": {
          "typical": 50,
          "min": 35,
          "max": 65,
          "provider": "Fairfax Water Authority",
          "currency": "USD",
          "notes": "2-adult household, ~6,000 gal/mo"
        },
        "sewage": {
          "typical": 45,
          "min": 35,
          "max": 55,
          "provider": "Fairfax County",
          "currency": "USD",
          "notes": "Billed with water"
        },
        "trash": {
          "typical": 30,
          "min": 25,
          "max": 35,
          "provider": "Fairfax County",
          "currency": "USD",
          "notes": "Billed quarterly (~$90/qtr)"
        },
        "taxes": "Virginia exempts residential utilities from state sales tax.",
        "monthlyTotal": {
          "min": 225,
          "typical": 345,
          "max": 485,
          "currency": "USD",
          "annualInflation": 0.03
        },
        "notes": "Internet is tracked under entertainment (Cable+1Gig). Seasonal swing: summer A/C drives electricity up."
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` fields to each utility and monthlyTotal.

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
