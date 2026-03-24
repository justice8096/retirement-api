# Agent Prompt Template — Canonical Specification

This file documents all {{VARIABLE}} markers used in agent prompts.
It is NOT itself an executable prompt — it is a reference for the orchestrator.

---

## Template Structure

```
# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task
[Agent-specific instructions]

## Sources to Check
{{SOURCES_BLOCK}}

## Output Format
[Agent-specific JSON schema]

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
```

---

## Variable Definitions

### {{AGENT_LABEL}}
Human-readable agent name. Matches the filename without extension.
Example: `exchange-rates`, `housing`, `taxes`

### {{TAB_IDS}}
Comma-separated dashboard tab IDs this agent's data feeds.
Example: `housing, overview, compare`

### {{RUN_DATE}}
ISO 8601 date string for the current run.
Example: `2026-03-17`

### {{LOCATIONS_SCOPE}}
JSON array of location objects this agent should process.
Each object contains:
```json
{
  "id": "france-lyon",
  "name": "Lyon, France",
  "country": "France",
  "currency": "EUR",
  "exchangeRate": 0.93,
  "cities": ["Lyon"]
}
```
Full list of 17 location IDs:
- **US (9)**: us-virginia, us-cherry-hill, us-philadelphia, us-richmond, us-savannah, us-florida, us-atlanta, us-punta-gorda, us-raleigh
- **France (4)**: france-brittany, france-lyon, france-montpellier, france-toulouse
- **Iberia (2)**: spain-alicante, portugal-lisbon
- **Central America (2)**: panama-city, panama-boquete

### {{HOUSEHOLD_PROFILE_BLOCK}}
Injected from `data/index.json` → `householdProfile`. Contains:
- adults: 2
- ages: both 60 (born ~1966)
- pets: 1 Bernese Mountain Dog, born 2022, expected lifespan 11 years
- targetAnnualIncome: $72,000/year
- requirements: gigabit-internet, warm-winters, dog-friendly, expat-community
- planningHorizon: 2027-2045

### {{CURRENT_DATA_BLOCK}}
The existing data for each location relevant to this agent's domain.
Injected from the appropriate JSON files:
- `data/locations/{id}/location.json` — monthlyCosts, taxes, exchangeRates
- `data/locations/{id}/detailed-costs.json` — entertainment, transportation, medicine, vision/dental
- `data/locations/{id}/neighborhoods.json` — neighborhood data
- `data/locations/{id}/services.json` — nearby services
- `data/locations/{id}/inclusion.json` — prejudice assessment
- `data/shared/social-security.json` — SS benefits data

The orchestrator extracts only the fields relevant to each agent.

### {{SOURCES_BLOCK}}
Agent-specific source URLs to check, grouped by country/region.
Each prompt file defines its own source list.

---

## Output Conventions (All Agents)

Every agent returns a JSON object with this wrapper:
```json
{
  "agentId": "exchange-rates",
  "runDate": "2026-03-17",
  "locations": [
    {
      "locationId": "france-lyon",
      "changed": true,
      "confidence": "high",
      "data": { ... },
      "sources": [
        {
          "title": "Source Name",
          "url": "https://...",
          "accessedDate": "2026-03-17"
        }
      ],
      "notes": "Optional free-text note about data quality or caveats"
    }
  ]
}
```

### `changed` Flag
Set to `false` if ALL numeric values are within 5% of the current data.
Set to `true` if ANY value changed by more than 5%, or if non-numeric fields changed.
When `changed` is `false`, the `data` field can be omitted or set to `null`.

### `confidence` Field
- `high` — Multiple authoritative sources agree, data is current
- `medium` — Single source or minor extrapolation required
- `low` — Data is estimated, outdated, or based on informal sources

### Currency Convention for Non-USD Locations
- Express values in LOCAL CURRENCY as the primary value
- Include `_usd` suffixed fields with USD conversion using the location's exchangeRate
- Example: `"typical": 1350` (EUR) with `"typical_usd": 1452` (at 1.075 mid-rate)

### Source Citations
Every `changed: true` location MUST include at least one source.
Sources must include title, URL, and accessedDate.
