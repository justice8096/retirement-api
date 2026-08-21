# Retirement API Server

## What this is

A JSON API for a retirement planning app. It stores your settings. It runs
projections. It serves location cost data. Frontend clients call it.

## Ecosystem (consolidated 2026-08)

- **This repo is canonical for data and the engine.** Location data lives in
  `data/locations/<id>/*.json`; the calculation library (including the Monte
  Carlo engine at `shared/engine/`) is the `@retirement/shared` package in
  `shared/`, consumed by this API (`#shared/*` imports), the Angular
  dashboard, and retirement-mcp via `file:` dependencies. There is no
  copy-sync script; edit `shared/engine/*.ts` and run `npm run engine:build`
  (`test:shared` and `build` do this automatically; CI has a drift gate).
- **The dashboard is `retirement-dashboard-angular`** (a pure API client).
  The old React dashboard and the `commercialRetirementProject` monorepo are
  archived under `D:\retirement\_archive\`.
- **Single data path:** edit canonical JSON → `npm run db:seed` → the API
  serves it. There is no mirror step to any dashboard.

## How it's built

Each stack choice is one line so you can skim.

| Piece | Choice |
|-------|--------|
| Language | TypeScript (strict) |
| HTTP framework | Fastify 5 |
| Runtime | Node.js 20 or newer |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Cache | Redis 7 |
| Auth | Local username/password → self-issued JWT (HS256, `AUTH_JWT_SECRET`) |
| Billing | Stripe |
| Encryption | AES-256-GCM for financial fields |

## Key folders

- `src/server.ts` — Fastify bootstrap. Registers all routes.
- `src/routes/` — One file per feature area. 17 files in total.
- `src/middleware/` — Auth, encryption, rate-limit, input sanitize.
- `src/lib/` — Shared helpers. `validation.ts` produces plain-language
  error envelopes. `locale.ts` resolves the client locale.
- `shared/` — Pure-JS calculation library. FIRE, withdrawal strategies,
  inflation, FX, taxes, RMD, Social Security.
- `prisma/schema.prisma` — Full data model.

## Getting started

### 1. Install

```bash
npm install
npx prisma generate
```

### 2. Run in dev mode

```bash
npm run dev
# Starts tsx --watch on port 3000.
```

### 3. Seed the database

```bash
npm run db:migrate
DATA_DIR=./data npm run db:seed
```

`db:seed` needs `DATA_DIR=./data` when run from the project root — the
script's default (`../../data`) resolves outside the repo. Seeding is an
idempotent upsert (bumps each row's `version`); it reads canonical
`data/locations/<id>/location.json`, not the `prisma/seed-*.json` snapshots.

### Optional: SQLite snapshot for ad-hoc analysis

```bash
node tools/build-db.js
# Builds data/retirement.db (untracked, derived) from the canonical
# data/locations JSON — handy for ad-hoc SQL queries. Nothing in the
# runtime stack consumes it; the API serves Postgres seeded by db:seed.
```

### 4. Run tests

```bash
npm test
npm run test:shared   # shared/ tests
npm run typecheck
```

### 5. Run via Docker

```bash
docker compose up
# postgres + redis + api + migrate all come up.
```

## API style

### Error shape

All validation errors use the same envelope:

```jsonc
{
  "error": "Validation failed",
  "details": [
    {
      "field": "portfolioBalance",
      "fieldLabel": "Portfolio balance",
      "message": "Portfolio balance must be at least 0.",
      "code": "too_small"
    }
  ]
}
```

- `field` is the JS property path, joined with dots for nested fields.
- `fieldLabel` is a plain-language label suitable for a form error toast.
- `message` is a plain-language explanation, targeted at end users.
- `code` is the original Zod code. Useful for client-side i18n.

HTTP-level errors (429, 503, etc.) use a simpler shape: `{ error: "Too many requests" }`.

### Numeric fields

We document units next to every numeric field. Two rules:

- **Rate fields** (`withdrawalRate`, `ceilingRate`, `floorRate`, etc.) are
  **decimal fractions**. `0.04` means 4%.
- **Amount fields** (`portfolioBalance`, `essentialSpending`, etc.) are
  whole units of the user's currency. Not cents.

Numeric response envelopes include a `_units` sibling that says so
explicitly. See `src/routes/withdrawal.ts` for a worked example.

### Glossary

Plain-language definitions for every financial term the UI surfaces live at
`/api/glossary`. See `src/routes/glossary.ts`. Add new terms there rather
than documenting them inline in the UI.

### Locale

The API honors `Accept-Language`. The resolved locale is echoed back in the
`Content-Language` response header and is also available to route handlers
as `request.locale`. See `src/lib/locale.ts` for the supported tags.

## Security

- Financial fields at rest: AES-256-GCM.
- Authenticated routes: self-issued JWT via `POST /api/auth/login` (scrypt
  password hashes; accounts managed with `tools/manage-users.mjs` — no
  registration endpoint).
- Per-tier rate limiting: Redis-backed in production.
- CORS: allowlist via `CORS_ORIGIN` (comma-separated).
- Helmet headers.
- Input sanitization on all write routes.
- CI checks for leaked secrets (`sk_live_`, `whsec_live_`).

## Routes at a glance

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/auth` | None | Username/password login → JWT (`/login`, `/me`) |
| `/api/health` | None | Liveness and readiness probes |
| `/api/locations` | None | Public location data (138 locations) |
| `/api/glossary` | None | Plain-language financial definitions |
| `/api/me` | JWT | User profile CRUD + GDPR export |
| `/api/me/household` | JWT | Household members and pets |
| `/api/me/financial` | JWT | Portfolio and SS settings (encrypted) |
| `/api/me/fees` | JWT | Brokerage + FX fee settings |
| `/api/me/withdrawal` | JWT | Withdrawal strategy |
| `/api/me/preferences` | JWT | Preferences (includes `accessibility`) |
| `/api/me/scenarios` | JWT + tier | Saved Monte Carlo scenarios |
| `/api/me/groceries` | JWT | Grocery overrides |
| `/api/me/locations` | JWT + tier | Custom locations |
| `/api/admin/locations` | Admin | Location CRUD with version history |
| `/api/billing` | JWT | Stripe checkout and customer portal |
| `/api/webhooks/stripe` | Stripe signature | Subscription lifecycle |

## Accessibility

This server is the upstream source of every number and every label the end
user sees. It is explicitly designed for dyslexic and dyscalculic users.

Key choices:
- Error messages avoid jargon codes (`FST_ERR_*`, `P2024`).
- Field labels ship next to field names (`fieldLabel` alongside `field`).
- Amounts ship with units; rates ship with encoding metadata.
- Glossary definitions live server-side at `/api/glossary`.
- Accommodations persist via `/api/me/preferences.accessibility`.

See `audits/Dyslexia-Compliance-Audit-retirement-api-2026-04-16.md` and
`audits/Dyscalculia-Compliance-Audit-retirement-api-2026-04-16.md` for the
full evaluation.
