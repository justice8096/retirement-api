# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the medicine agent. Research prescription drug costs, pharmacy access, and insurance coverage for each location. The household consists of 2 adults age 60 who will transition to Medicare at 65 (US) or national healthcare systems (abroad).

### What to Research Per Location

1. **Monthly prescription costs** (min, typical, max) for a retired couple with common age-60+ medications:
   - Blood pressure (e.g., Lisinopril, Amlodipine)
   - Cholesterol (e.g., Atorvastatin, Rosuvastatin)
   - Diabetes prevention (e.g., Metformin)
   - Thyroid (e.g., Levothyroxine)
   - OTC pain relief (Acetaminophen, Ibuprofen)
   - OTC allergy (Cetirizine, Loratadine)
2. **Pharmacy access** — Availability, chains, mail-order options, English-speaking pharmacists
3. **Prescription system** — How prescriptions work (insurance coverage, reimbursement, out-of-pocket)
4. **Insurance coverage** — What system covers prescriptions, annual caps, copay structure

### Country-Specific Notes

**US**: Medicare Part D covers prescriptions with tiered copays. Inflation Reduction Act caps out-of-pocket at $2,000/year. Generics are $0-15/month. Insulin capped at $35/month. Coverage gap ("donut hole") eliminated by 2025. Search GoodRx for cash prices as backup.

**France**: Sécurité Sociale reimburses 65-100% of approved medications. Mutuelle (supplemental) covers the rest. Most common generics cost EUR 1-5 with full reimbursement. Pharmacies are ubiquitous and pharmacists are highly trained.

**Spain**: SNS (public healthcare) covers most medications. Retirees with pensions <EUR 18K/yr pay 0%; above that, 10% copay capped at EUR 8-18/month. Generics widely available and mandated.

**Portugal**: SNS covers medications at 15-90% depending on category. Retirees may qualify for higher reimbursement. Pharmacy network is dense. NHR tax status (now IFICI) does NOT affect healthcare access.

**Panama**: Pensionado visa holders get 15-25% discounts on prescriptions. CSS (social security) covers basic medications. Private pharmacies (Farmacias Arrocha, Metro) stock international brands. Many medications available OTC that require prescriptions elsewhere.

### Change Detection

Mark `changed: true` if typical monthly prescription cost differs by more than 5%, or if coverage/system info has materially changed.

### Currency

EUR locations: costs in EUR with `_usd` conversion fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: CMS.gov (Medicare Part D), GoodRx.com, KFF.org (drug pricing analysis)
**France**: Ameli.fr (Sécurité Sociale), Vidal.fr (drug prices), service-public.fr
**Spain**: SanidadExterior.gob.es, Vademecum.es, BotPlusweb.farmaceuticos.com
**Portugal**: SNS.gov.pt, Infarmed.pt (drug authority), PORDATA.pt
**Panama**: CSS.gob.pa, MINSAGob.pa, FarmaciasArrocha.com

## Output Format

```json
{
  "agentId": "medicine",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "monthlyPrescriptionCosts": {
          "min": 50,
          "typical": 150,
          "max": 350,
          "currency": "USD"
        },
        "commonMedications": [
          {
            "name": "Lisinopril (Blood Pressure)",
            "monthlyCost": 10,
            "coverageNote": "Medicare Part D generic tier 1; $0-15 copay"
          }
        ],
        "pharmacyAccess": "Description of pharmacy availability and access",
        "prescriptionSystem": "Description of how the prescription system works",
        "insuranceCoverage": "Description of what insurance covers and copay structure"
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` fields to `monthlyPrescriptionCosts` and each medication's `monthlyCost`:
```json
{
  "monthlyPrescriptionCosts": {
    "min": 20, "typical": 40, "max": 80,
    "min_usd": 22, "typical_usd": 43, "max_usd": 86,
    "currency": "EUR",
    "exchangeRateUsed": 1.075
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
