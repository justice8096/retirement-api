# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the vision-dental agent. Research eye care and dental costs for each location. Two adults age 60 — both likely need reading glasses/progressives and regular dental care.

### Vision — What to Research Per Location

1. **Annual eye exam** — Cost with and without insurance
2. **Prescription glasses** — Progressive lenses + frames, mid-range
3. **Contact lenses** — Annual supply of daily disposables (if applicable)
4. **Insurance/coverage** — What vision coverage is available for retirees

### Dental — What to Research Per Location

1. **Routine cleaning** — Cost per visit, recommended 2x/year
2. **X-rays** — Panoramic + bitewing, annual
3. **Filling** — Composite (tooth-colored), single surface
4. **Crown** — Porcelain-fused-to-metal, per tooth
5. **Root canal** — Molar, per tooth
6. **Insurance/coverage** — What dental coverage is available for retirees

### Country-Specific Notes

**US**: Medicare does NOT cover routine vision or dental. Standalone dental/vision plans (Delta Dental, VSP) or Medicare Advantage plans with dental/vision riders. Out-of-pocket costs are high.

**France**: Sécurité Sociale covers a portion of dental (70% of base rate for basic care, less for prosthetics). "100% Santé" reform provides fully-covered frames/lenses and dental crowns at regulated prices. Mutuelle covers the rest. Very affordable with mutuelle.

**Spain**: SNS covers basic dental for retirees (extractions, some treatments) but NOT routine cleanings, fillings, or prosthetics — those are private. Vision is fully private. Costs are moderate compared to US.

**Portugal**: SNS covers minimal dental (emergency only). Private dental is affordable. Vision is private. "Cheque dentista" program for some retirees.

**Panama**: Pensionado visa holders get 15-25% medical discounts including dental and vision. Private care is affordable. Dental tourism is common (Panama City has many US-trained dentists).

### Change Detection

Mark `changed: true` if any procedure cost differs by more than 5%.

### Currency

EUR locations: all costs in local EUR with `_usd` fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: VSP.com, DeltaDental.com, FairHealthConsumer.org, CMS.gov (Medicare coverage), NADP.org
**France**: Ameli.fr (remboursements), 100pourcentsante.fr, UFSBD.fr (dental federation)
**Spain**: Sanidad.gob.es, ConsejoDentistas.es, ClinicasBaviera.com (vision)
**Portugal**: SNS.gov.pt, OMD.pt (dental association), Infarmed.pt
**Panama**: CSS.gob.pa, ADP.org.pa (dental association), dental clinic websites

## Output Format

```json
{
  "agentId": "vision-dental",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "vision": {
          "annualExamCost": {
            "withInsurance": 25,
            "withoutInsurance": 200,
            "currency": "USD"
          },
          "progressiveGlasses": {
            "withInsurance": 150,
            "withoutInsurance": 500,
            "currency": "USD",
            "notes": "Mid-range frames + progressive lenses"
          },
          "contactLenses": {
            "annualCost": 400,
            "currency": "USD",
            "notes": "Daily disposables, annual supply"
          },
          "insuranceOptions": "VSP or Medicare Advantage with vision rider"
        },
        "dental": {
          "cleaning": {
            "perVisit": 150,
            "withInsurance": 25,
            "frequency": "2x/year",
            "currency": "USD"
          },
          "xrays": {
            "panoramic": 150,
            "bitewing": 60,
            "withInsurance": 30,
            "currency": "USD"
          },
          "filling": {
            "composite": 250,
            "withInsurance": 75,
            "currency": "USD"
          },
          "crown": {
            "porcelainFusedMetal": 1200,
            "withInsurance": 500,
            "currency": "USD"
          },
          "rootCanal": {
            "molar": 1100,
            "withInsurance": 400,
            "currency": "USD"
          },
          "insuranceOptions": "Delta Dental or Medicare Advantage with dental rider"
        }
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` suffixed fields for all cost values.

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
