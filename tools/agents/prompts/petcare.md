# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the petcare agent. Research pet care costs for a Bernese Mountain Dog (~100 lbs, large breed) at each location. The dog was born in 2022 and has an expected lifespan of 11 years.

### What to Research Per Location

1. **Daycare / Pet Sitting (2 days per week)**:
   - **US locations**: Commercial dog daycare, 2 days/week. Large dog rate. Research major chains (Camp Bow Wow, PetSmart Doggie Day Camp, Dogtopia) and local facilities.
   - **Non-US locations**: Hired pet sitter, 2 days/week (~6-8 hours per visit). Commercial daycare is limited or unavailable in most non-US locations.
2. **Veterinary care** — Annual wellness exam, vaccinations, heartworm/flea/tick prevention
3. **Grooming** — Bernese are double-coated, need regular grooming. Professional groom every 6-8 weeks.
4. **Dog food** — Premium large-breed dog food, monthly cost (~30-40 lbs/month for a 100-lb dog)
5. **Pet insurance** — Monthly premium for a large breed age 4+ (if available in that country)
6. **Registration/licensing** — Annual dog license fees
7. **Import requirements** — For non-US locations: what is needed to bring a dog from the US? (microchip, rabies titer, health certificate, quarantine?)

### Country-Specific Notes

**US**: Commercial daycare is widely available. Rates vary $25-60/day for large dogs. Banfield/VCA for vet chains. Pet insurance via Trupanion, Pets Best, Nationwide. State/county dog licenses $10-25/year.

**France**: Pet sitters via Animaute, Rover.fr. Vets are affordable (consultation EUR 30-60). No mandatory dog insurance but recommended for large breeds. Identification (puce electronique) required. EU Pet Passport needed for travel.

**Spain**: Pet sitters via Gudog, Rover.es. Vet consultation EUR 30-50. PPP (Potentially Dangerous Dog) license NOT required for Bernese Mountain Dogs. Microchip + EU Pet Passport required.

**Portugal**: Pet sitters via Rover.pt or local contacts. Vet costs similar to Spain. DGV (food/vet authority) registration. EU Pet Passport.

**Panama**: Pet sitters via expat community or local hire. Vet care is very affordable ($15-30 consultation). Import requires AUPSA permit, health certificate within 14 days, rabies vaccination. No quarantine for US dogs with proper paperwork.

### Change Detection

Mark `changed: true` if monthly total pet care cost differs by more than 5%.

### Currency

EUR locations: costs in EUR with `_usd` conversion fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: CampBowWow.com, Dogtopia.com, Rover.com, BLS Pet Care CPI, AVMA.org (vet cost survey)
**France**: Animaute.fr, Rover.fr, 30MillionsDamis.fr, SPA.asso.fr, OrdreDesVeterinaires.fr
**Spain**: Gudog.com, Rover.es, ColVet.es (vet association), RSCE.es
**Portugal**: Rover.pt, OMV.pt (vet order), DGV.pt
**Panama**: AUPSA.gob.pa (import rules), local vet clinic websites, expat forums (Boquete.ning.com)

## Output Format

```json
{
  "agentId": "petcare",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "daycareOrSitter": {
          "type": "commercial-daycare",
          "daysPerWeek": 2,
          "costPerDay": 45,
          "monthlyEstimate": 390,
          "currency": "USD",
          "provider": "Camp Bow Wow / local facility",
          "notes": "Large dog surcharge typical ($5-10/day extra)"
        },
        "veterinary": {
          "annualWellness": 350,
          "vaccinations": 200,
          "heartwormFleaTick": 75,
          "monthlyEstimate": 52,
          "currency": "USD",
          "notes": "Annual costs amortized monthly"
        },
        "grooming": {
          "costPerVisit": 85,
          "frequencyWeeks": 6,
          "monthlyEstimate": 57,
          "currency": "USD",
          "notes": "Double-coat breed, full groom every 6 weeks"
        },
        "food": {
          "monthlyEstimate": 120,
          "brand": "Premium large-breed (Royal Canin, Purina Pro Plan)",
          "currency": "USD"
        },
        "insurance": {
          "monthlyPremium": 95,
          "provider": "Trupanion / Pets Best",
          "currency": "USD",
          "notes": "Large breed age 4+, 80% reimbursement, $500 deductible"
        },
        "registration": {
          "annualFee": 20,
          "monthlyEstimate": 2,
          "currency": "USD"
        },
        "importRequirements": null,
        "monthlyTotal": 716,
        "currency": "USD",
        "annualInflation": 0.04
      },
      "sources": []
    }
  ]
}
```

For non-US locations, replace `daycareOrSitter.type` with `"hired-pet-sitter"` and add `importRequirements`:
```json
{
  "importRequirements": {
    "microchip": true,
    "rabiesVaccination": true,
    "rabiesTiter": false,
    "healthCertificate": "USDA-endorsed, within 10 days of travel",
    "euPetPassport": true,
    "quarantine": false,
    "otherRequirements": [],
    "estimatedCost": 300,
    "currency": "USD",
    "notes": "One-time cost for international move"
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
