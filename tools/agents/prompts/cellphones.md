# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the cellphones agent. Research mobile phone service costs for 2 lines at each location. Minimum requirements: unlimited talk/text, at least 1.5 GB data per line, all taxes and fees included.

### US Locations — What to Research

For all 9 US locations, research the **T-Mobile 55+ plan** (available to customers 55+):
1. Current plan name and tier (e.g., "Essentials 55+", "Go5G 55+")
2. Monthly cost for 2 lines, taxes and fees included
3. Data allowance (unlimited or cap)
4. 5G/LTE coverage quality in each specific metro area
5. Any autopay or loyalty discounts
6. Alternatives: Mint Mobile, Visible, Consumer Cellular (for comparison only — T-Mobile 55+ is the default)

### France Locations — What to Research

Research local carriers for 2 SIM-only lines:
1. **Free Mobile** (best value) — Forfait Free (unlimited calls/texts, large data)
2. **Orange**, **SFR**, **Bouygues** — Comparable plans
3. Monthly cost for 2 lines, TVA included
4. Data allowance (aim for 100GB+ which is standard in France)
5. EU roaming included (required by regulation)
6. Note: France has exceptionally cheap mobile plans compared to US

### Spain (Alicante) — What to Research

1. **Movistar**, **Orange**, **Vodafone**, **Masmovil/Yoigo** — 2 SIM-only lines
2. Monthly cost, IVA included
3. Data (minimum 10GB, ideally unlimited)
4. EU roaming included

### Portugal (Lisbon) — What to Research

1. **MEO**, **NOS**, **Vodafone** — 2 SIM-only lines
2. Monthly cost, IVA included
3. Data (minimum 10GB)
4. EU roaming included

### Panama — What to Research

1. **Tigo (Millicom)**, **Digicel**, **Cable & Wireless (+movil)** — 2 lines
2. Monthly cost, ITBMS included
3. Data (minimum 5GB — networks are less generous)
4. Coverage quality in Panama City vs Boquete (Boquete is rural/mountainous)

### Change Detection

Mark `changed: true` if monthly cost for 2 lines differs by more than 5%.

### Currency

EUR locations: costs in EUR with `_usd` conversion fields.
Panama: costs in USD.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: T-Mobile.com/cell-phone-plans/55-plus, MintMobile.com, Visible.com, ConsumerCellular.com
**France**: Mobile.free.fr, Orange.fr/boutique/forfaits, SFR.fr, Bouygues-telecom.fr
**Spain**: Movistar.es, Orange.es, Vodafone.es, Yoigo.com
**Portugal**: MEO.pt, NOS.pt, Vodafone.pt
**Panama**: Tigo.com.pa, Digicel.com.pa, MasMovil.com.pa

## Output Format

```json
{
  "agentId": "cellphones",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "plan": {
          "carrier": "T-Mobile",
          "planName": "Go5G 55+",
          "lines": 2,
          "monthlyCost": 90,
          "taxesIncluded": true,
          "currency": "USD",
          "dataAllowance": "Unlimited (50GB priority)",
          "talkText": "Unlimited",
          "networkType": "5G/LTE",
          "coverageQuality": "Excellent in Fairfax/NOVA",
          "discounts": "Autopay -$5/line",
          "notes": ""
        },
        "alternative": {
          "carrier": "Mint Mobile",
          "planName": "Unlimited",
          "lines": 2,
          "monthlyCost": 60,
          "currency": "USD",
          "notes": "Prepaid, uses T-Mobile network, 40GB priority"
        }
      },
      "sources": []
    }
  ]
}
```

For EUR locations:
```json
{
  "plan": {
    "carrier": "Free Mobile",
    "planName": "Forfait Free 5G",
    "lines": 2,
    "monthlyCost": 39.98,
    "monthlyCost_usd": 43.00,
    "currency": "EUR",
    "exchangeRateUsed": 1.075,
    "dataAllowance": "300GB 5G",
    "talkText": "Unlimited + 25 destinations",
    "notes": "EUR 19.99/line, TVA included"
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
