# retirement-api

A JSON API for retirement planning — stores user settings, runs projections,
serves location cost-of-living data. Built as the backend for
[`retirement-dashboard-angular`](https://github.com/justice8096/retirement-dashboard-angular);
the two are designed to ship together but the API is consumable standalone.

[![CI](https://github.com/justice8096/retirement-api/actions/workflows/ci.yml/badge.svg)](https://github.com/justice8096/retirement-api/actions/workflows/ci.yml)
[![SLSA L1](https://img.shields.io/badge/SLSA-L1-blue)](audits/supply-chain-audit-2026-04-20.md)
[![Dyscalculia A](https://img.shields.io/badge/Dyscalculia-A_(95%2F100)-brightgreen)](audits/Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md)
[![Dyslexia A](https://img.shields.io/badge/Dyslexia-A_(94%2F100)-brightgreen)](audits/Dyslexia-Compliance-Audit-retirement-api-2026-04-20.md)

---

## What it does

- **Stores** encrypted financial settings (portfolio, household, targets) per user.
- **Computes** FIRE numbers, safe withdrawal rates, Monte Carlo simulations,
  Roth-conversion schedules, and ACA subsidy estimates using the pure-JS
  library in [`shared/`](shared/).
- **Serves** seeded location cost-of-living data for 88 locations (70 US
  + 18 international) plus per-user custom locations.
- **Surfaces** plain-language definitions for every financial term at
  [`GET /api/glossary`](src/routes/glossary.ts) so UIs never have to hand-author them.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict, ESM) | Type-safety end-to-end |
| HTTP | Fastify 5 | Fast, hook-first, strong schema validation |
| DB | PostgreSQL 16 + Prisma 6 | JSONB for flexible blobs, relational for indexed access |
| Cache / rate-limit | Redis 7 (optional; falls back to in-memory) | Distributed counters |
| Auth | Clerk (JWT) | Managed identity; avoids rolling our own |
| Billing | Stripe | Webhooks for one-time feature unlocks + legacy subscriptions |
| Encryption | AES-256-GCM | Portfolio / household / member-PII at rest |
| Tests | Vitest | Same runner in `src/` and `shared/` |

Full architectural rationale in [`docs/adr/0001-runtime-stack.md`](docs/adr/0001-runtime-stack.md).

---

## Quickstart

```bash
# 1. Install deps + generate Prisma client
npm install
npx prisma generate

# 2. Copy env template and fill in real values
cp .env.example .env
#    - DATABASE_URL        postgres://…
#    - REDIS_URL           redis://…
#    - CLERK_SECRET_KEY    sk_test_…
#    - CLERK_PUBLISHABLE_KEY pk_test_…
#    - ENCRYPTION_MASTER_KEY   64-hex (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#    - STRIPE_SECRET_KEY   sk_test_…
#    - CORS_ORIGIN         http://localhost:5173

# 3. Migrate + seed the DB
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev        # tsx --watch on :3000
# or
docker compose up  # postgres + redis + api + migrate
```

Health probes: `curl http://localhost:3000/api/health` and `.../ready`.

---

## API at a glance

| Prefix | Auth | Description |
|---|---|---|
| `/api/health` | public | Liveness + readiness |
| `/api/locations` | public | 88-location catalogue + supplements |
| `/api/glossary` | public | Plain-language financial definitions |
| `/api/me` | JWT | Profile CRUD + GDPR export |
| `/api/me/household` | JWT | Members, pets, target income (encrypted) |
| `/api/me/financial` | JWT | Portfolio + SS settings (encrypted) |
| `/api/me/fees` | JWT | Brokerage + transfer + FX fee settings |
| `/api/me/withdrawal` | JWT | Withdrawal strategy + plain-language `explanation` |
| `/api/me/scenarios` | JWT + basic tier | Saved Monte Carlo scenarios |
| `/api/me/preferences` | JWT | Includes `accessibility.dyslexia` / `.dyscalculia` sub-schemas |
| `/api/me/locations` | JWT + basic tier | Private custom locations |
| `/api/me/groceries` | JWT | Per-user grocery overrides |
| `/api/admin/*` | admin tier | Location / release / contribution review |
| `/api/billing/*` | JWT | Stripe checkout + customer portal |
| `/api/webhooks/stripe` | Stripe signature | Subscription + purchase lifecycle |
| `/api/releases` | public read / JWT purchase | Versioned data-release paywall |

OpenAPI: served at `/docs` (Swagger UI) and `/api/openapi.json` (raw spec).

### Response conventions

Every response that carries money-shaped fields also carries a `_units`
sibling describing encoding + currency + periodicity. Example from
[`GET /api/me/withdrawal`](src/routes/withdrawal.ts):

```jsonc
{
  "withdrawalRate": 0.04,
  "amount": 40000,
  "explanation": "Withdrawing about $40,000 per year from your $1,000,000 portfolio.",
  "_units": {
    "withdrawalRate": { "encoding": "fraction", "meaning": "0.04 = 4%" },
    "amount":          { "encoding": "amount",   "currency": "USD", "periodicity": "year" }
  }
}
```

### API versioning

Request `Accept-Version: 2` for decimal-fraction wire encoding on every
percentage field. Default is v1 (whole-number percents, legacy). See
[ADR-0003](docs/adr/0003-api-versioning-percent-encoding.md).

### Validation errors

Every 400 uses the same envelope (`field`, `fieldLabel`, `message`, `code`)
via [`toValidationErrorPayload`](src/lib/validation.ts). New routes go
through [`validateBody()`](src/lib/validation.ts) so the raw-Zod-issues
pattern can't come back.

---

## Accessibility

This server is the upstream source of every number and every label the
end user sees. It's explicitly designed to be friendly to users with
dyslexia and dyscalculia — but the posture benefits every consumer.

| Concern | Mechanism |
|---|---|
| Plain-language field labels | `fieldLabel` on every validation error + `_labels` sibling on GET responses |
| Plain-language explanations | `explanation` string on withdrawal + anchor-synthesis on scenario GETs |
| Jargon-free error text | `plainMessage()` rewrites Zod codes (`too_small`, `invalid_type`, …) into subject-verb English |
| Cross-device persistence | `accessibility.dyslexia` / `.dyscalculia` sub-schemas on `/api/me/preferences` |
| Unit / periodicity clarity | `_units` envelope on every money-shaped response |
| Magnitude anchoring | Synthesized anchors (`"about 18 years of planned spending"`) on monte_carlo_v1 percentiles |

**Current scores** (2026-04-20 audits):
- Dyscalculia: **95 / 100 (A)** — see
  [`audits/Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md`](audits/Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md)
- Dyslexia: **94 / 100 (A)** — see
  [`audits/Dyslexia-Compliance-Audit-retirement-api-2026-04-20.md`](audits/Dyslexia-Compliance-Audit-retirement-api-2026-04-20.md)
- WCAG 2.1 AA (static HTML assets under `compliance/`): contrast, skip-nav,
  and `lang="en"` cleanup via [`tools/wcag-fix-html.mjs`](tools/wcag-fix-html.mjs)

---

## Security

- **Authenticated routes**: Clerk JWT; 10-second cache invalidated on tier change.
- **At-rest encryption**: AES-256-GCM on financial fields (portfolio balance,
  target annual income, SS PIA, per-account balances).
- **Input validation**: Zod `.strict()` schemas; 32-level depth + 10 000-key
  caps on every JSONB payload via [`safeJsonRecord`](src/middleware/sanitize.ts).
- **Rate limits**: per-tier (60 / 120 / 300 / 600 req/min for free / basic /
  premium / admin); Redis-backed, in-memory fallback.
- **CORS**: strict allowlist via `CORS_ORIGIN`; `*` rejected when credentials enabled.
- **Prod safety**: startup refuses to boot if a dev-bypass user exists in
  the prod DB.
- **Dep posture**: 0 known vulnerabilities (`npm audit` on 2026-04-20); SLSA L1.

Full policy + disclosure process: [`SECURITY.md`](SECURITY.md).

Latest SAST/DAST scan:
[`audits/sast-dast-scan-2026-04-20.md`](audits/sast-dast-scan-2026-04-20.md)
— 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW (accepted), 2 INFO open.

---

## Data provenance

Location cost-of-living numbers, ACA benchmarks, tax brackets, and the
Monte Carlo model assumptions are documented in
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

Prominent sources:
- US BLS Consumer Expenditure Survey (65+ quintiles)
- Numbeo + Eurostat + OECD for international
- healthcare.gov + KFF Marketplace Calculator for ACA
- IRS Revenue Procedures for federal brackets

---

## Development

```bash
npm run dev            # tsx --watch on :3000
npm test               # API tests (vitest)
npm run test:shared    # shared/ calculation-library tests
npm run typecheck      # tsc --noEmit
npm run db:studio      # Prisma Studio
npm run db:migrate     # apply pending migrations
npm run db:seed        # load seed data
```

Tooling scripts in `tools/`:
- `expand-abbreviations.mjs` — dyslexia F-012 seed-data maintenance.
- `wcag-fix-html.mjs` — WCAG 2.1 AA sweep across the static-HTML tree.
- `backup-db.sh` — pg_dump with retention.
- `tailscale-serve.sh` — expose dev API over Tailscale HTTPS.

---

## AI-assisted development

This project is developed by a single maintainer with material assistance
from [Claude](https://claude.ai) (model: Claude Opus 4.7 as of 2026-04).
Every commit is human-reviewed before push; destructive git operations
are always gated on explicit approval. Feature cycles run ~38 / 62
human-authored / AI-assisted; remediation cycles compress closer to
~10 / 90 as the pattern is to draft everything, review, then commit.

Cumulative split, grading, and the per-cycle methodology live in
[`audits/contribution-analysis-2026-04-20.md`](audits/contribution-analysis-2026-04-20.md).

The LLM-compliance posture (EU AI Act Art. 25 / 52, NIST SP 800-218A,
OWASP LLM Top 10 2025, ISO 27001) is audited and scored:
[`audits/llm-compliance-report-2026-04-20.md`](audits/llm-compliance-report-2026-04-20.md)
— currently **80 / 100 (GOOD band)**.

---

## Key docs

| | |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | What landed when |
| [SECURITY.md](SECURITY.md) | Disclosure SLA + IR runbook |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | Data provenance + projection assumptions |
| [docs/OPS.md](docs/OPS.md) | Clerk rotation, gitleaks, Redis observability |
| [docs/adr/0001-runtime-stack.md](docs/adr/0001-runtime-stack.md) | Fastify / Prisma / Postgres decision |
| [docs/adr/0002-aca-regime.md](docs/adr/0002-aca-regime.md) | Why `premiumCapPctOfIncome = 0.085` |
| [docs/adr/0003-api-versioning-percent-encoding.md](docs/adr/0003-api-versioning-percent-encoding.md) | `Accept-Version: 2` opt-in |
| [CLAUDE.md](CLAUDE.md) | AI-assistant onboarding (read this if you're also Claude) |
| [audits/](audits/) | Dated compliance and security audit set (dyslexia, dyscalculia, SAST, supply-chain, LLM, CWE, contribution) |

---

## License

**All Rights Reserved.** This repository is publicly readable but is not
open source. Running, modifying, redistributing, or hosting this software
requires prior written authorization from the copyright holder. See
[`LICENSE`](LICENSE) for full terms.

Individual UI components may, from time to time, be extracted into
separate repositories under **[Creative Commons Zero (CC0 1.0
Universal)](https://creativecommons.org/publicdomain/zero/1.0/)**. Those
extracts are governed by their own LICENSE files and are freely reusable;
the parent repository you are reading now is not.

For licensing enquiries: `justice8096@gmail.com`.

---

## Contributing

This is currently a solo project. Bug reports and security disclosures
welcome — see [SECURITY.md](SECURITY.md) for the channel + SLA.
