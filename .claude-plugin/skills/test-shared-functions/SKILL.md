---
name: Test Shared Financial Functions
description: >-
  This skill should be used when the user asks to "generate tests", "write tests
  for shared", "test financial calculations", "test shared functions", "add unit
  tests", "increase test coverage", "vitest shared", "test taxes", "test social
  security", "test RMD", "test inflation", "test formatting", "test
  calcTaxesForLocation", "test calcSSBenefit", "test calcRMD", "test
  projectCosts", "financial calculation tests", or mentions improving test
  coverage for the @retirement/shared package.
version: 1.1.0
---

# Test Shared Financial Functions

Generate comprehensive Vitest test suites for the @retirement/shared package -- pure JavaScript financial calculation libraries used for retirement planning. Target 95%+ code coverage with edge cases specific to financial calculations.

## When to Use

- When test coverage is needed for the shared calculation library
- After modifying any function in `packages/shared/src/`
- Before deploying changes that affect financial calculations
- When validating calculation accuracy against IRS/SSA official data

## Pre-requisites

**IMPORTANT: Read the source files before generating tests** to match exact function signatures, parameter names, and return shapes. The source is the truth, not this spec.

```
packages/shared/src/taxes.js          -- calcBracketTax, calcTaxesForLocation
packages/shared/src/socialSecurity.js -- calcSSBenefit, calcSpousalBenefit
packages/shared/src/rmd.js            -- getRMDStartAge, getDistributionPeriod, calcRMD, calcCoupleRMD, RMD_PENALTY_RATE, RMD_PENALTY_RATE_CORRECTED
packages/shared/src/inflation.js      -- getFxMultiplier, getInflationMultiplier, getInflationFxMultiplier, getAvgInflationMultiplier, getTypicalMonthly, getProjectedMonthly, projectCosts
packages/shared/src/formatting.js     -- fmt, fmtK, pct
packages/shared/src/constants.js      -- CURRENT_YEAR, COST_CATEGORIES
packages/shared/src/index.js          -- All exports
```

Coverage requires `@vitest/coverage-v8` -- install if not present:
```bash
npm install -D @vitest/coverage-v8 --workspace=packages/shared
```

## Test File Locations

Place test files alongside source or in a `__tests__` directory:

```
packages/shared/src/__tests__/taxes.test.js
packages/shared/src/__tests__/socialSecurity.test.js
packages/shared/src/__tests__/rmd.test.js
packages/shared/src/__tests__/inflation.test.js
packages/shared/src/__tests__/formatting.test.js
```

## Test Specifications by Module

### 1. taxes.test.js

#### `calcBracketTax(income, brackets)`

Standalone pure function -- test independently before testing `calcTaxesForLocation`.

- Zero income -> $0 tax
- Income within first bracket only -> income * rate
- Income spanning two brackets -> correct split calculation
- Income above all bracket maxes -> correct total
- Empty brackets array -> $0

#### `calcTaxesForLocation(loc, ssIncome, iraIncome, investIncome)`

**Federal bracket boundaries (2025 MFJ -- use `test.each`):**
Brackets as coded in source:
- $0 -- $23,850 at 10%
- $23,850 -- $96,950 at 12%
- $96,950 -- $206,700 at 22%
- $206,700 -- $394,600 at 24%

Standard deduction: `loc.taxes.federalIncomeTax.standardDeduction` or default $30,000.

**Core scenarios:**
- Zero income (all three sources = 0) -> all taxes = $0
- SS taxability: 85% of SS income is treated as taxable (hardcoded, no provisional income threshold logic)
- Federal AGI = (ssIncome * 0.85 + iraIncome + investIncome) - standardDeduction
- Negative AGI (deduction > income) -> $0 federal tax (Math.max 0)
- Very high income ($1M+) -> correct marginal rate across all brackets

**State/country tax scenarios:**
- Location with no state brackets -> state = $0
- Location with `ssExempt: true` -> SS excluded from state income
- Location with `retirementExempt: true` -> only investment income taxed at state level
- Foreign tax credit: `Math.min(stateTax, federalTax)` credited; federal reduced accordingly
- France social charges (CSM): applied when `loc.taxes.socialCharges` exists
- Vehicle tax: `loc.taxes.vehicleTax` added to total

**Return shape:**
- `{ federal, state, socialCharges, salesVat, vehicleTax, total, details[] }`
- `details` array: each entry has `{ label, amount, note }`
- `total` = sum of all components

### 2. socialSecurity.test.js

#### `calcSSBenefit(pia, fra, claimAge)`

**Core claiming scenarios (use `test.each`):**
- Claim at FRA -> returns exactly PIA (no rounding)
- Claim at 62 with FRA 67 (60 months early):
  - First 36 months: 5/900 per month = 20%
  - Next 24 months: 5/1200 per month = 10%
  - Total reduction: 30% -> benefit = `Math.round(pia * 0.70)`
- Claim at 63 (48 months early): 36*(5/900) + 12*(5/1200) = 25% reduction
- Claim at 64 (36 months early): 36*(5/900) = 20% reduction
- Claim at 65 (24 months early): 24*(5/900) = 13.33% reduction
- Claim at 66 (12 months early): 12*(5/900) = 6.67% reduction
- Claim at 68 (1 year late): 8% delayed credit -> `Math.round(pia * 1.08)`
- Claim at 70 (3 years late): 24% delayed credit -> `Math.round(pia * 1.24)`

**NOTE:** Source has NO cap at age 70 -- delayed credits continue for claimAge > 70. Tests should verify this behavior (e.g., age 72 -> 40% credit). If this is a bug to fix later, document it but test current behavior.

**Edge cases:**
- PIA = $0 -> benefit = $0
- PIA = $1 -> benefit rounds correctly
- claimAge = fra -> exact PIA (no reduction or credit)

#### `calcSpousalBenefit(spousePIA, ownPIA, ownFRA, claimAge)`

**Separate function** -- test independently from `calcSSBenefit`.

- Spouse PIA = $2400, own PIA = $800 -> spousal excess = $2400*0.5 - $800 = $400
- Spouse PIA = $2400, own PIA = $1400 -> maxSpousal ($1200) <= ownPIA -> returns $0
- Early claiming reduction: claimAge < ownFRA -> `monthsEarly * (25/36/100)` capped at 0.30
- Claim at ownFRA -> no reduction on spousal excess
- Both negative edge: returns $0 (Math.max 0)

### 3. rmd.test.js

#### `getRMDStartAge(birthYear)` -- test independently

**SECURE 2.0 thresholds (use `test.each`):**
- Born 1950 -> RMD age 72 (birthYear <= 1950)
- Born 1951 -> RMD age 73
- Born 1959 -> RMD age 73
- Born 1960 -> RMD age 75
- Born 1970 -> RMD age 75

#### `getDistributionPeriod(age)` -- test independently

**IRS Uniform Lifetime Table III spot checks:**
- Age < 72 -> returns 0
- Age 72 -> 27.4
- Age 73 -> 26.5
- Age 75 -> 24.6
- Age 80 -> 20.2
- Age 85 -> 16.0
- Age 90 -> 12.2
- Age 100 -> 6.4
- Age 115 -> 2.9
- Age 120 -> 2.0
- Age > 120 -> returns 2.0 (value at key 120)

#### `calcRMD(priorYearBalance, age, birthYear)`

- Age < startAge -> `{ rmd: 0, divisor: 0, required: false }`
- Age = startAge -> `{ rmd: balance/divisor, required: true }`
- Balance = $0 -> rmd = $0
- Balance = $10,000,000, age 75 -> rmd = 10000000 / 24.6
- Balance negative -> rmd = $0 (priorYearBalance <= 0 guard)
- Return shape: `{ rmd, divisor, required, startAge }`

#### `calcCoupleRMD(priorYearBalance, hAge, wAge, hBirthYear, wBirthYear, hAlive, wAlive)`

- Both alive: uses older spouse's age and birthYear
- Only husband alive: uses husband's age/birthYear
- Only wife alive: uses wife's age/birthYear
- Neither alive: returns `{ rmd: 0, required: false }`
- Balance = $0: returns rmd = $0
- Return shape adds `rmdAge` field

#### Constants

- `RMD_PENALTY_RATE` = 0.25
- `RMD_PENALTY_RATE_CORRECTED` = 0.10
- Test that both are exported and have correct values

### 4. inflation.test.js

Create a mock location object for tests:
```js
const mockLoc = {
  currency: 'USD',
  monthlyCosts: {
    rent: { typical: 2000, annualInflation: 0.035 },
    groceries: { typical: 600, annualInflation: 0.03 },
    healthcare: { typical: 500, annualInflation: 0.05 },
  }
};
```

#### `getFxMultiplier(loc, yearsOut, fxDrift)`

- USD location -> always returns 1
- Foreign location, fxDrift = 0 -> returns 1
- Foreign location, fxDrift = 0.01, 5 years -> `Math.pow(1.01, 5)`
- fxDrift null/undefined -> returns 1

#### `getInflationMultiplier(loc, category, targetYear)`

- targetYear <= CURRENT_YEAR -> returns 1
- Category with annualInflation 0.035, 10 years -> `Math.pow(1.035, 10)`
- Category without annualInflation -> uses default 0.025
- Category not in loc.monthlyCosts -> uses default 0.025

#### `getInflationFxMultiplier(loc, category, targetYear, fxDrift)`

- Combines inflation * FX multipliers
- Verify: `getInflationMultiplier * getFxMultiplier`

#### `getAvgInflationMultiplier(loc, targetYear)`

- Averages all category inflation rates, then compounds
- Empty monthlyCosts -> uses default 0.025

#### `getTypicalMonthly(loc)`

- Sums all `typical` values across categories
- mockLoc above -> 2000 + 600 + 500 = 3100

#### `getProjectedMonthly(loc, targetYear, fxDrift)`

- targetYear <= CURRENT_YEAR -> same as getTypicalMonthly
- Projects each category independently, then multiplies by FX

#### `projectCosts(loc, startYear, years, fxDrift)`

- Returns array of `years` rows
- Each row: `{ year, [category], total, annual, fxMultiplier, cumulative }`
- Year 0 (startYear): costs = base typical (no inflation applied, `Math.pow(1+infl, 0) = 1`)
- Year 1: each category inflated by its rate
- Cumulative: running sum of annual values
- Zero years -> empty array
- FX drift compounds on top of inflation for foreign locations

**Precision:**
- Use `toBeCloseTo(expected, 2)` for all floating point comparisons

### 5. formatting.test.js

#### `fmt(n)` (NOT `formatCurrency`)

- `fmt(1234)` -> `'$1,234'` (rounds to integer, no decimals)
- `fmt(0)` -> `'$0'`
- `fmt(1234.56)` -> `'$1,235'` (Math.round)
- `fmt(1234.49)` -> `'$1,234'`
- `fmt(1000000)` -> `'$1,000,000'`
- `fmt(-500)` -> `'$-500'` (or locale-dependent negative)
- `fmt(NaN)` -> graceful handling (test actual behavior)

#### `fmtK(n)`

- `fmtK(72000)` -> `'$72K'`
- `fmtK(1500000)` -> `'$1500K'`
- `fmtK(500)` -> `'$1K'` (500/1000 = 0.5, toFixed(0) = '1')
- `fmtK(0)` -> `'$0K'`

#### `pct(n)` (NOT `formatPercent`)

- `pct(0.125)` -> `'12.5%'`
- `pct(0)` -> `'0.0%'`
- `pct(1)` -> `'100.0%'`
- `pct(1.5)` -> `'150.0%'`
- `pct(-0.05)` -> `'-5.0%'`
- `pct(0.001)` -> `'0.1%'`

## Running Tests

```bash
# Run all shared tests (from monorepo root)
npx vitest run packages/shared

# Or via workspace script
npm run test:shared

# Run with coverage (requires @vitest/coverage-v8)
npx vitest run packages/shared --coverage

# Run specific test file
npx vitest run packages/shared/src/__tests__/taxes.test.js

# Watch mode during development
npx vitest packages/shared
```

## After Generating Tests

1. **Run the tests** to verify they pass: `npx vitest run packages/shared`
2. **Check coverage**: `npx vitest run packages/shared --coverage`
3. **Fix any failures** -- if a test fails, read the source function to understand the actual behavior and adjust the test expectation (the source is the truth, not the spec above)
4. **Report** coverage percentage and any functions not fully covered

## Important Notes

- These are **pure functions** with zero external dependencies -- no mocking needed (except for mock location objects as test fixtures)
- Use `toBeCloseTo(expected, 2)` for all financial comparisons (floating point)
- Read the actual source files first to match exact function signatures, parameter names, and return shapes
- Cross-reference IRS/SSA official values where noted
- Use `describe` blocks grouped by function, then by scenario category
- Use `test.each` for parametric tests (bracket boundaries, age thresholds, divisor tables)
- Keep test names descriptive: `"calcSSBenefit returns 70% of PIA when claiming at age 62 (60 months early)"`
- Import from `'../taxes.js'`, `'../socialSecurity.js'`, etc. (not from index.js) for clearer test isolation
