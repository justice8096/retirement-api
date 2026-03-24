---
name: Audit Financial Calculations
description: >-
  This skill should be used when the user asks to "audit calculations",
  "verify tax brackets", "check SS formula", "validate RMD", "cross-check
  IRS data", "verify financial accuracy", "audit math", "check tax logic",
  "validate social security", "compare to IRS tables", or mentions concerns
  about calculation accuracy in the @retirement/shared package. Also trigger
  when tax law changes or IRS/SSA publishes new data.
version: 1.0.0
---

# Audit Financial Calculations

Cross-check the hardcoded financial calculations in `packages/shared/src/` against authoritative IRS, SSA, and regulatory sources. Flags discrepancies that could cause incorrect retirement projections.

## When to Use

- After modifying any calculation in packages/shared/src/
- When tax year changes (new brackets, standard deduction, thresholds)
- When SSA publishes updated benefit formulas or COLA
- When IRS updates RMD tables or SECURE Act thresholds
- Before production deployment of financial features

## Audit Targets

### 1. Tax Brackets — `packages/shared/src/taxes.js`

Cross-check against IRS Revenue Procedure for the current tax year:

**Federal brackets (2026 values in code):**
| Rate | Single Filer Bracket | Source |
|------|---------------------|--------|
| 10% | $0 – $11,600 | IRS Rev. Proc. |
| 12% | $11,601 – $47,150 | IRS Rev. Proc. |
| 22% | $47,151 – $100,525 | IRS Rev. Proc. |
| 24% | $100,526 – $191,950 | IRS Rev. Proc. |

Verify:
- Standard deduction amount matches IRS (2026: check current value)
- Bracket boundaries are correct for filing status used
- SS taxability thresholds: $25K single / $32K married (provisional income)
- 85% maximum SS taxability rule implemented correctly
- State tax brackets match current law for each location's state

### 2. Social Security — `packages/shared/src/socialSecurity.js`

Cross-check against SSA.gov:

**Early claiming reduction:**
- First 36 months before FRA: 5/9 of 1% per month (= 5/900%)
- Additional months beyond 36: 5/12 of 1% per month (= 5/1200%)
- Maximum at age 62 (60 months early for FRA 67): 30% reduction

**Delayed retirement credits:**
- 8% per year for each year past FRA up to age 70
- Maximum at 70: 24% increase (3 years x 8%)

**Spousal benefits:**
- Up to 50% of higher earner's PIA
- Reduced if claimed before FRA
- Excess method: spousal = max(0, 50% of spouse PIA - own PIA)

**Trust fund:**
- Current SSA projection: trust fund depletion ~2033
- Projected cut: ~23% (verify against latest SSA Trustees Report)

### 3. RMD — `packages/shared/src/rmd.js`

Cross-check against IRS Publication 590-B:

**SECURE 2.0 Act thresholds:**
- Born 1950 or earlier: RMD starts at 72
- Born 1951–1959: RMD starts at 73
- Born 1960 or later: RMD starts at 75

**IRS Uniform Lifetime Table III (spot-check):**
| Age | Divisor | Age | Divisor |
|-----|---------|-----|---------|
| 72 | 27.4 | 85 | 16.0 |
| 73 | 26.5 | 90 | 12.2 |
| 75 | 24.6 | 95 | 8.9 |
| 80 | 20.2 | 100 | 6.4 |

**Penalty:**
- SECURE 2.0 reduced from 50% to 25%
- Correctable to 10% if fixed within 2 years

### 4. Inflation — `packages/shared/src/inflation.js`

Verify default assumptions are reasonable:

| Category | Default Rate | Reasonable Range |
|----------|-------------|-----------------|
| Rent | 3.5% | 3–5% |
| Groceries | 3.0% | 2–4% |
| Healthcare | 5.0% | 4–7% |
| Utilities | 3.0% | 2–4% |
| General | 2.5% | 2–3% |

Check:
- FX drift formula: `cost * (1 + inflation)^y * (1 + fxDrift)^y`
- Compounding is multiplicative (not additive)
- No accumulated precision errors over 35-year projections

## Report Format

```
## VERIFIED CORRECT
- [V1] taxes.js:XX — Federal 10% bracket $0-$11,600 matches IRS Rev. Proc. 2025-XX

## DISCREPANCY FOUND
- [D1] taxes.js:XX — Standard deduction $13,850 but IRS 2026 is $14,600. MUST UPDATE.

## UNABLE TO VERIFY (source data needed)
- [U1] taxes.js:XX — France CSM rate 6.6% — need French tax authority confirmation

## RECOMMENDATIONS
- [R1] Consider externalizing bracket data to a config file for easier annual updates
```

## Key Files

- `packages/shared/src/taxes.js` — Tax bracket calculations
- `packages/shared/src/socialSecurity.js` — SS benefit formulas
- `packages/shared/src/rmd.js` — RMD divisors and thresholds
- `packages/shared/src/inflation.js` — Inflation and FX projection
- `packages/shared/src/constants.js` — Shared constants
