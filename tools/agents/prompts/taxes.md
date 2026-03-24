# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the taxes agent. Research income tax obligations for a retired US couple living in each location. The household's target income is $72K/year composed of: ~$36K Social Security, ~$24K 401(k) withdrawals, ~$12K investment income.

### What to Research Per Location

1. **Federal/national income tax brackets** — Current year rates and brackets
2. **State/regional/local income tax** — Rates and brackets, if applicable
3. **Social Security tax treatment**:
   - US: Which states tax SS benefits? At what thresholds?
   - France: CSG/CRDS on worldwide income; US-France tax treaty provisions
   - Spain: SS benefits taxed as pension income under Spain-US treaty
   - Portugal: Progressive rates; IFICI program (NHR replacement) excludes pensions
   - Panama: Territorial taxation — foreign-source income not taxed
4. **401(k)/retirement account withdrawals** — How taxed in each jurisdiction
5. **Investment income (dividends, capital gains)** — Rates and any special treatment
6. **Standard deduction / personal allowances** — For a married couple filing jointly (US) or equivalent
7. **Tax treaty provisions** — US bilateral tax treaties preventing double taxation
8. **Estimated annual tax liability** — Calculate for the $72K income split above
9. **Property tax implications** — If renting, note whether property tax passes through

### Country-Specific Notes

**US**: Federal brackets + state income tax. Some states (FL, TX) have no income tax. Virginia and NJ have different SS exemptions. Use married-filing-jointly. Standard deduction for 2026 (project from 2025 values + inflation).

**France**: Bareme progressif (0%, 11%, 30%, 41%, 45%). Parts familiales system (2 parts for couple). CSG 9.2% + CRDS 0.5% on worldwide income. US-France tax treaty Article 18 (pensions). Foreign tax credit for US taxes paid.

**Spain**: IRPF has national + regional components. Alicante is in Comunidad Valenciana. US-Spain treaty Article 19 (SS) and Article 18 (pensions). Beckham Law does NOT apply to retirees.

**Portugal**: Progressive IRS rates 12.5-48%. IFICI (ex-NHR) does NOT cover pension income — standard rates apply. US-Portugal treaty. Municipal surcharge (derrama) up to 1.5%.

**Panama**: Territorial taxation — only Panama-source income is taxed. US SS, 401(k), and US investments are all foreign-source and tax-free in Panama. This is a major advantage. Still must file US federal returns.

### Important Reminders

- VAT/IVA/TVA is NOT included here — it is embedded in cost-of-living estimates elsewhere.
- Do NOT compute PIA or SS benefit amounts — that is the ss-benefits agent's job.
- Focus on TAX RATES and BRACKETS, not benefit calculations.
- All amounts in USD for comparability. For non-US, show local currency tax and USD equivalent.

### Change Detection

Mark `changed: true` if any tax bracket rate changed, or if estimated annual liability differs by more than 5%.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US Federal**: IRS.gov (Rev. Proc. for inflation adjustments), Tax Foundation (tax-brackets)
**US State**: State department of revenue websites, Tax Foundation state tax guides
**France**: Impots.gouv.fr, Service-Public.fr (bareme IR), CLEISS.fr (tax treaties)
**Spain**: Agencia Tributaria (AEAT), Comunidad Valenciana portal tributario
**Portugal**: Portal das Financas, AT.gov.pt, IFICI program rules
**Panama**: DGI.gob.pa (Direccion General de Ingresos), MEF.gob.pa
**Treaties**: IRS.gov/businesses/international (tax treaty tables), Treasury.gov

## Output Format

```json
{
  "agentId": "taxes",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "federal": {
          "brackets": [
            { "min": 0, "max": 23850, "rate": 0.10 },
            { "min": 23851, "max": 96950, "rate": 0.12 }
          ],
          "standardDeduction": 30750,
          "filingStatus": "married-filing-jointly",
          "notes": "2026 projected values"
        },
        "stateLocal": {
          "state": "Virginia",
          "brackets": [
            { "min": 0, "max": 3000, "rate": 0.02 },
            { "min": 3001, "max": 5000, "rate": 0.03 },
            { "min": 5001, "max": 17000, "rate": 0.05 },
            { "min": 17001, "max": null, "rate": 0.0575 }
          ],
          "standardDeduction": 16000,
          "ssTaxTreatment": "Virginia does not tax Social Security benefits",
          "localTax": 0,
          "notes": ""
        },
        "ssTaxTreatment": {
          "federalTaxable": true,
          "federalThreshold": "Up to 85% taxable above $44K combined income (MFJ)",
          "stateTaxable": false,
          "notes": ""
        },
        "retirementWithdrawals": {
          "federalTreatment": "Taxed as ordinary income",
          "stateTreatment": "Virginia: age 65+ deduction of $12K per person",
          "notes": ""
        },
        "investmentIncome": {
          "qualifiedDividends": "0%/15%/20% depending on bracket",
          "longTermCapitalGains": "0%/15%/20% depending on bracket",
          "stateRate": 0.0575,
          "notes": ""
        },
        "estimatedAnnualTax": {
          "federal": 3200,
          "stateLocal": 1800,
          "total": 5000,
          "effectiveRate": 0.069,
          "currency": "USD",
          "assumptions": "$36K SS (85% taxable), $24K 401k, $12K investments"
        },
        "taxTreaty": null
      },
      "sources": []
    }
  ]
}
```

For non-US locations, include treaty info and dual obligations:
```json
{
  "taxTreaty": {
    "treaty": "US-France Tax Treaty",
    "ssProvision": "Article 18: SS benefits taxable only in US",
    "pensionProvision": "Article 18: Private pensions may be taxed in both, with credit",
    "notes": "Must file both US 1040 and French declaration. Foreign tax credit prevents double taxation."
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
