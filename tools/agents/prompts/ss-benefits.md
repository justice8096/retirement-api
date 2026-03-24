# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the Social Security benefits agent. Research the latest COLA rate, trust fund depletion projections, and policy changes that affect SS benefit calculations. You do NOT compute PIA values — those are fixed inputs. You research the variables that MODIFY those benefits over time.

### What to Research

1. **COLA (Cost of Living Adjustment)**:
   - Most recently announced COLA rate (applied in January of current year)
   - CPI-W trend data for projecting next year's COLA
   - Historical average COLA (10-year, 20-year)
   - Projected COLA for next 1-3 years (SSA Trustees Report or CBO projections)

2. **Trust Fund Depletion**:
   - Latest SSA Trustees Report projected depletion year for OASI trust fund
   - CBO's alternative projection (if different)
   - Projected benefit cut percentage if depletion occurs without legislative fix
   - Any legislative proposals that have advanced (committee votes, floor votes)
   - Probability assessment: likelihood of full depletion vs partial fix vs full fix

3. **Policy Changes**:
   - Any changes to full retirement age (currently 67 for birth year 1960+)
   - Changes to earnings test thresholds
   - Changes to delayed retirement credits
   - Changes to spousal benefit rules
   - Changes to windfall elimination provision (WEP) or government pension offset (GPO)
   - Medicare Part B premium changes (deducted from SS check)

4. **WEP/GPO Status**:
   - Has WEP repeal legislation advanced? (Social Security Fairness Act status)
   - Impact on this household (likely none unless government employment, but note)

### What NOT to Research

- Do NOT compute or change PIA values (Husband: $2,400/mo, Wife: $1,600/mo at FRA 67)
- Do NOT compute benefit-by-age tables — those are derived from PIA and are computed by the dashboard
- Do NOT research location-specific data — SS benefits are the same regardless of location (tax treatment is the taxes agent's job)

### Output is Location-Independent

Unlike other agents, this agent returns a SINGLE data block (not per-location). SS benefits do not vary by location — only the tax treatment does (handled by the taxes agent).

### Change Detection

Mark `changed: true` if:
- COLA rate differs from current projected rate (2.5%)
- Trust fund depletion year changed from 2033
- Benefit cut percentage changed from 23%
- Any significant policy change enacted

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
- **SSA Trustees Report**: https://www.ssa.gov/OACT/TR/ (annual, usually released April-June)
- **SSA COLA Announcement**: https://www.ssa.gov/cola/
- **CBO Social Security Projections**: https://www.cbo.gov/topics/social-security
- **SSA Actuarial Publications**: https://www.ssa.gov/OACT/
- **Congress.gov**: Search for Social Security-related bills (OASI, trust fund, COLA, FRA)
- **Committee for a Responsible Federal Budget**: https://www.crfb.org/socialsecurity
- **Bipartisan Policy Center**: https://bipartisanpolicy.org/topics/social-security/

## Output Format

```json
{
  "agentId": "ss-benefits",
  "runDate": "{{RUN_DATE}}",
  "changed": true,
  "confidence": "high",
  "data": {
    "cola": {
      "currentYear": {
        "year": 2026,
        "rate": 0.025,
        "announcedDate": "2025-10-10",
        "source": "https://www.ssa.gov/cola/"
      },
      "projected": [
        { "year": 2027, "rate": 0.023, "basis": "CBO March 2026 projection" },
        { "year": 2028, "rate": 0.024, "basis": "CBO March 2026 projection" }
      ],
      "historicalAverage10yr": 0.033,
      "historicalAverage20yr": 0.026,
      "cpiWTrend": "CPI-W Q3 2025 showed 2.4% annual increase, suggesting moderate 2027 COLA"
    },
    "trustFundDepletion": {
      "projectedYear": 2033,
      "source": "2025 SSA Trustees Report",
      "benefitCutPercent": 23,
      "alternateProjection": {
        "source": "CBO",
        "projectedYear": 2033,
        "benefitCutPercent": 25
      },
      "legislativeStatus": {
        "majorBills": [
          {
            "name": "Social Security 2100 Act",
            "status": "Introduced, referred to committee",
            "lastAction": "2025-03-15",
            "summary": "Expands benefits, extends solvency to 2066 via payroll tax increase"
          }
        ],
        "likelihoodAssessment": "No imminent legislative fix as of {{RUN_DATE}}. Most analysts expect last-minute partial fix before depletion."
      }
    },
    "policyChanges": {
      "fraChange": false,
      "earningsTestThreshold": {
        "under_fra": 22320,
        "fra_year": 59520,
        "year": 2026
      },
      "delayedRetirementCredits": "8% per year, unchanged",
      "spousalBenefitRules": "No changes",
      "wepGpoStatus": "Social Security Fairness Act signed into law Jan 2025; WEP/GPO repealed effective for benefits payable after Dec 2023",
      "medicarePartBPremium": {
        "monthly": 185,
        "year": 2026,
        "change": "+5.2% from 2025"
      }
    }
  },
  "sources": [
    {
      "title": "2025 OASDI Trustees Report",
      "url": "https://www.ssa.gov/OACT/TR/2025/",
      "accessedDate": "{{RUN_DATE}}"
    }
  ],
  "notes": "Trust fund depletion remains on track for 2033. COLA projected to normalize around 2.3-2.5% as inflation moderates."
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
