---
name: Compliance Gap Analysis
description: >-
  This skill should be used when the user asks about "GDPR compliance",
  "CCPA compliance", "privacy compliance", "data protection gaps",
  "compliance gaps", "privacy audit", "consent flows", "data deletion",
  "data export", "right to erasure", "data retention", "privacy policy",
  or mentions regulatory compliance requirements for the SaaS platform.
  Also trigger before production launch or when adding user data features.
version: 1.0.0
---

# Compliance Gap Analysis

Map GDPR, CCPA, and financial data protection requirements to the actual codebase. Identify gaps between regulatory requirements and current implementation.

## When to Use

- Before production launch
- When adding features that handle personal or financial data
- When expanding to new jurisdictions (EU, California, etc.)
- During legal/compliance review preparation
- After modifying user data endpoints or storage

## Compliance Framework

### GDPR Requirements (if serving EU users)

| Requirement | Implementation Check | Code Location |
|------------|---------------------|---------------|
| Right to access | `GET /api/me/export` returns all user data | `packages/api/src/routes/me.js` |
| Right to erasure | `DELETE /api/me` cascades across all tables | `packages/api/src/routes/me.js` |
| Data portability | Export in machine-readable format (JSON/CSV) | `packages/api/src/routes/me.js` |
| Consent collection | Cookie consent banner, data processing consent | `packages/dashboard/src/` |
| Privacy policy | Accessible, covers all data categories | `/privacy` route or static page |
| Data minimization | Only collect what's needed | Prisma schema review |
| Encryption at rest | Financial fields encrypted (AES-256-GCM) | `packages/api/` encryption layer |
| Breach notification | Incident response plan, 72-hour notification | Operational procedure |
| DPO designation | Data Protection Officer identified | Organizational |
| Processing records | Log of data processing activities | Audit logging |

### CCPA Requirements (if serving California users)

| Requirement | Implementation Check | Code Location |
|------------|---------------------|---------------|
| Right to know | User can see all collected data | `GET /api/me/export` |
| Right to delete | User can request deletion | `DELETE /api/me` |
| Right to opt-out | Opt out of data sale (N/A if no data sale) | Privacy policy |
| Non-discrimination | No service degradation for exercising rights | Tier logic review |
| Privacy notice | At or before data collection | Registration flow |

### Financial Data Requirements

| Requirement | Implementation Check | Code Location |
|------------|---------------------|---------------|
| Financial disclaimer | "Not financial advice" prominent display | Dashboard header/footer |
| Data encryption | Portfolio, income, SS PIAs encrypted at rest | Prisma middleware |
| Access controls | Users can only see own financial data | `where: { userId }` on all queries |
| Audit trail | Log access to financial data | API logging |
| Secure transmission | HTTPS only, no financial data in URLs | Server config |

## Gap Analysis Procedure

### 1. Data Inventory

Catalog all personal/financial data collected:

```
packages/api/prisma/schema.prisma — All stored fields
packages/dashboard/src/store/     — Client-side persisted data
```

Classify each field:
- **PII** (Personally Identifiable): email, displayName
- **Financial** (Sensitive): portfolioBalance, ssPia, targetAnnualIncome
- **Preference** (Low sensitivity): theme, selectedLocation, projection years

### 2. Data Flow Mapping

Trace how data flows:
- Collection: registration form, onboarding wizard, settings pages
- Storage: PostgreSQL (server), localStorage (client)
- Processing: API routes, shared calculation functions
- Transmission: HTTPS API calls, WebSocket (if any)
- Deletion: cascade delete path, localStorage cleanup

### 3. Implementation Audit

For each requirement, check if:
- **Implemented**: Code exists and works correctly
- **Partial**: Code exists but incomplete (e.g., delete route exists but doesn't cascade)
- **Stub**: Route skeleton exists but returns 501
- **Missing**: No implementation at all

### 4. Legal Documents Needed

Check for existence and completeness of:
- Privacy Policy (comprehensive, covers all data types)
- Terms of Service (liability limitations, financial disclaimer)
- Cookie Policy (if using cookies beyond session)
- Data Retention Policy (how long data is kept after deletion request)
- Financial Disclaimer ("not financial advice, consult a professional")

## Report Format

```
## IMPLEMENTED
- [I1] Right to access — GET /api/me/export returns user + household + preferences + scenarios

## PARTIAL
- [P1] Right to erasure — DELETE /api/me exists but doesn't cascade to household_pets table

## STUB (returns 501)
- [S1] Data export — GET /api/me/export route defined but not implemented

## MISSING
- [M1] Cookie consent banner — no implementation found
- [M2] Privacy policy page — no /privacy route or static page
- [M3] Financial disclaimer — not displayed in dashboard

## LEGAL DOCUMENTS NEEDED
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Financial Disclaimer
- [ ] Data Retention Policy
```

## Key Files

- `packages/api/prisma/schema.prisma` — Data model, all stored fields
- `packages/api/src/routes/me.js` — User data CRUD, export, deletion
- `packages/dashboard/src/store/` — Client-side data stores
- `packages/dashboard/src/` — UI components (consent, disclaimers)
- `compliance/` — AI compliance evidence kit (separate from privacy compliance)
