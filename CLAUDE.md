# Retirement API Server

## Purpose
REST API server for the retirement planning platform. Serves location data, user profiles, financial settings, scenarios, and billing for multiple frontend clients.

## Architecture
- **Runtime**: Fastify 5, Node.js 20+, TypeScript (strict mode)
- **Database**: PostgreSQL 16 via Prisma 6 ORM
- **Cache**: Redis 7 (rate limiting, sessions)
- **Auth**: Clerk JWT verification
- **Billing**: Stripe subscriptions (basic/premium tiers)
- **Encryption**: AES-256-GCM at-rest for financial fields
- **Shared**: Vendored `shared/` pure JS calculation library (taxes, SS, RMD, inflation)

## Key Files
- `src/server.ts` — Fastify app bootstrap, route registration, middleware
- `src/routes/` — 12 route files (locations, users, household, financial, billing, etc.)
- `src/middleware/auth.ts` — Clerk JWT verification, tier guards, admin guards
- `src/middleware/encryption.ts` — AES-256-GCM encrypt/decrypt for financial data
- `src/middleware/rate-limit.ts` — Per-tier rate limiting with Redis store
- `src/middleware/sanitize.ts` — Input sanitization
- `prisma/schema.prisma` — Full PostgreSQL schema (13 models)
- `prisma/seed.ts` — Database seeding from JSON data
- `shared/` — Vendored calculation library (taxes, SS, RMD, inflation, formatting)
- `data/` — Master location JSON files (138 locations across 16 countries)
- `tools/` — Data maintenance scripts and agent orchestration

## Running
```bash
npm install
npx prisma generate
npm run dev          # tsx --watch, port 3000
```

## Database
```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seed from JSON data
npm run db:studio    # Prisma Studio GUI
```

## Docker
```bash
docker compose up    # postgres + redis + api + migrate
```

## Security
- All financial data (portfolioBalance, targetAnnualIncome, ssPia) encrypted at rest
- Clerk JWT verification on authenticated routes
- Per-tier rate limiting (Redis-backed in production)
- Multi-origin CORS via `CORS_ORIGIN` env var (comma-separated)
- Helmet security headers
- Input sanitization on all routes
- No live secrets in source (CI checks for sk_live_, whsec_live_)

## API Routes
| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/health` | None | Liveness/readiness probes |
| `/api/locations` | None | Public location data (138 locations) |
| `/api/me` | JWT | User profile CRUD, GDPR export |
| `/api/me/household` | JWT | Household members + pets |
| `/api/me/financial` | JWT | Portfolio, SS settings (encrypted) |
| `/api/me/preferences` | JWT | User preferences blob |
| `/api/me/scenarios` | JWT+tier | Saved Monte Carlo scenarios |
| `/api/me/groceries` | JWT | Grocery overrides |
| `/api/me/locations` | JWT+tier | Custom locations |
| `/api/admin/locations` | Admin | Location CRUD with versioning |
| `/api/billing` | JWT | Stripe checkout/portal |
| `/api/webhooks/stripe` | Stripe sig | Subscription lifecycle |
