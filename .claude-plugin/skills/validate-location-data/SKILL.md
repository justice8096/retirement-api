---
name: Validate Location Data
description: >-
  This skill should be used when the user asks to "validate locations",
  "check location data", "verify data consistency", "schema check locations",
  "find data errors", "audit location JSON", "check for missing fields",
  "validate costs", or mentions data quality issues with location files.
  Also trigger after adding or editing location data in data/locations/.
version: 1.0.0
---

# Validate Location Data

Schema-check all location JSON files for consistency, completeness, and correctness. Reports missing fields, invalid values, and cross-location inconsistencies.

## When to Use

- After adding a new location
- After bulk-editing location cost data
- After importing updated exchange rates
- Before seeding the database
- Periodic data quality check

## Validation Rules

### Per-Location Checks

Read each `data/locations/{id}/location.json` and verify:

**Required top-level fields:**
- `id` (string, matches directory name)
- `name`, `country`, `region` (non-empty strings)
- `cities` (array, at least 1 entry)
- `currency` (3-letter ISO code: USD, EUR, GBP, etc.)
- `exchangeRate` (number > 0; USD locations should be 1.0)

**Monthly costs (all 18 categories must exist):**
- `rent`, `groceries`, `utilities`, `healthcare`, `insurance`, `petCare`, `petDaycare`, `petGrooming`, `transportation`, `entertainment`, `clothing`, `personalCare`, `subscriptions`, `phoneCell`, `miscellaneous`, `taxes`, `medicalOOP`, `buffer`
- Each category: `min` >= 0, `typical` >= `min`, `max` >= `typical`
- Each category: `annualInflation` between 0 and 0.15 (0-15%)
- No category should have `typical` = 0 unless it's genuinely free

**Other required sections:**
- `visa` — type, duration, renewalProcess
- `climate` — avgHighSummer, avgLowWinter, rainyDays, humidity
- `taxes` — section present with relevant fields
- `healthcare` — quality rating, public/private info
- `lifestyle` — scores: safety, expat, walkability, costOfLiving (each 1-10)
- `pros` (array, at least 2), `cons` (array, at least 2)

### Cross-Location Checks

Compare across all locations:
- No duplicate `id` values
- Exchange rates: USD locations = 1.0, EUR locations consistent, etc.
- Cost ranges reasonable: rent $300-$5000, groceries $200-$1500
- Lifestyle scores use same 1-10 scale consistently
- All locations have matching supplement files (detailed-costs, neighborhoods, services, inclusion)

### Supplement File Checks

For each location, verify these exist and are valid JSON:
- `data/locations/{id}/detailed-costs.json`
- `data/locations/{id}/neighborhoods.json` (at least 3 neighborhoods)
- `data/locations/{id}/services.json`
- `data/locations/{id}/inclusion.json`

### Index File Check

Verify `data/index.json`:
- Lists all location IDs that exist as directories
- No orphaned entries (ID in index but no directory)
- No missing entries (directory exists but not in index)

## Report Format

```
## PASSED (19/19 locations valid)

## ERRORS (must fix)
- [E1] france-brittany/location.json — Missing field: monthlyCosts.buffer
- [E2] panama-city/location.json — rent.typical (150) < rent.min (200)

## WARNINGS (should review)
- [W1] us-florida/location.json — groceries.typical ($1800) unusually high
- [W2] spain-alicante — missing neighborhoods.json supplement

## SUMMARY
- Locations checked: 19
- Errors: 2
- Warnings: 2
- Supplements missing: 1
```

## Key Paths

- `data/locations/` — All location directories
- `data/index.json` — Location index
- `data/shared/` — Shared data files (exchange rates, grocery defaults)
