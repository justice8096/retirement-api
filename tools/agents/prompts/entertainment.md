# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the entertainment agent. Research current costs for dining, streaming services, cable+internet, gym memberships, and coffee for each location. This data feeds the Entertainment tab and the entertainment line in Overview/Compare.

### Categories to Research (per location)

1. **Dining Out** — Lunch for 2, casual sit-down restaurant, 2x per week. Include tax and typical tip. Report monthly total (8 lunches).
2. **Cable + 1 Gig Internet** — Bundled or separate. 1 Gbps download minimum. Include all taxes/fees. For France, include TNT (free DTT) + fiber. For Spain/Portugal/Panama, include local cable + fiber.
3. **Netflix** — Standard plan (no ads), local pricing in local currency.
4. **Amazon Prime** — Annual price divided by 12 for monthly cost. Local pricing.
5. **Apple TV+** — Current monthly subscription, local pricing.
6. **NFL RedZone** — US: direct subscription or YouTube TV add-on. Non-US: via DAZN or equivalent (if available).
7. **Gym/Fitness** — Basic gym membership for 1 person (couple would be 2x). Large chain or municipal gym.
8. **Coffee/Cafes** — 2 coffees/day (one per person), cafe price, monthly total (~60 coffees).

### Country-Specific Notes

**US**: Tips are 18-20% on dining. Internet via Xfinity, Fios, AT&T, Spectrum depending on region. NFL RedZone via YouTube TV ($10.99/mo add-on) or NFL+ ($14.99/mo).

**France**: No tipping culture (service compris). Internet via Orange, Free, SFR, Bouygues (box triple-play). Netflix/streaming priced in EUR. NFL not widely available — check DAZN France.

**Spain**: Small tips (round up). Internet via Movistar, Vodafone, Orange. DAZN Spain for NFL.

**Portugal**: Similar to Spain. NOS, MEO, Vodafone for internet. DAZN or NFL Game Pass.

**Panama**: Tips 10%. Internet via Cable & Wireless (CWP), Tigo. NFL via DAZN or NFL Game Pass International.

### Change Detection

Mark `changed: true` if any category's monthly cost differs from current by more than 5%.

### Currency

EUR locations: all values in EUR with `_usd` conversion fields.
Panama: values in USD (PAB = USD).

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**Streaming**: netflix.com/pricing, primevideo.com, tv.apple.com, dazn.com, nfl.com/plus
**Internet**: Local ISP websites (Xfinity.com, Orange.fr, Movistar.es, NOS.pt, CWP.com.pa)
**Dining**: Numbeo.com (restaurant prices), TripAdvisor (menu prices), local restaurant websites
**Gym**: PlanetFitness.com, BasicFit.fr/es/pt, local gym chains
**Coffee**: Numbeo.com, local cafe menus

## Output Format

```json
{
  "agentId": "entertainment",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "categories": [
          {
            "name": "Dining Out",
            "monthlyCost": 320,
            "currency": "USD",
            "breakdown": "Lunch for 2 at ~$35 + tax + 20% tip = ~$40/visit x 8 visits",
            "notes": ""
          },
          {
            "name": "Cable + 1 Gig Internet",
            "monthlyCost": 110,
            "currency": "USD",
            "breakdown": "Xfinity 1Gbps $80 + basic cable $20 + fees/taxes $10",
            "notes": "No contract price"
          },
          {
            "name": "Netflix",
            "monthlyCost": 17.99,
            "currency": "USD",
            "breakdown": "Standard plan, no ads",
            "notes": ""
          },
          {
            "name": "Amazon Prime",
            "monthlyCost": 11.58,
            "currency": "USD",
            "breakdown": "$139/year / 12",
            "notes": "Includes Prime Video + shipping"
          },
          {
            "name": "Apple TV+",
            "monthlyCost": 9.99,
            "currency": "USD",
            "breakdown": "",
            "notes": ""
          },
          {
            "name": "NFL RedZone",
            "monthlyCost": 10.99,
            "currency": "USD",
            "breakdown": "YouTube TV Sports Plus add-on, ~5 months active",
            "notes": "Amortized over 12 months: ~$4.58/mo"
          },
          {
            "name": "Gym/Fitness",
            "monthlyCost": 25,
            "currency": "USD",
            "breakdown": "Planet Fitness Classic, per person",
            "notes": "x2 for household = $50"
          },
          {
            "name": "Coffee/Cafes",
            "monthlyCost": 210,
            "currency": "USD",
            "breakdown": "~$3.50/coffee x 60 coffees/month",
            "notes": ""
          }
        ],
        "monthlyTotal": 715.55
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` fields to each category and to `monthlyTotal`:
```json
{
  "name": "Dining Out",
  "monthlyCost": 200,
  "monthlyCost_usd": 215,
  "currency": "EUR",
  "exchangeRateUsed": 1.075
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
