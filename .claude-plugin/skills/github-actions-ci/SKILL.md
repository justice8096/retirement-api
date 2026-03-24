---
name: GitHub Actions CI/CD
description: >-
  This skill should be used when the user asks to "set up CI", "create CI/CD",
  "add GitHub Actions", "create pipeline", "automate tests", "automate deployment",
  "add linting to CI", "set up continuous integration", "deploy pipeline",
  or mentions GitHub Actions, CI/CD workflows, or automated testing pipelines.
version: 1.0.0
---

# GitHub Actions CI/CD

Generate CI/CD workflows for the monorepo. Covers linting, testing, building, and deployment across all 4 workspace packages.

## When to Use

- Initial CI/CD setup for the project
- Adding new pipeline stages (e.g., deployment, security scanning)
- Modifying existing workflows after structural changes
- Setting up preview deployments for PRs

## Workflow Files

Create in `.github/workflows/`:

### 1. `ci.yml` — Pull Request Checks

Triggered on: pull_request to main

Jobs:
1. **lint** — ESLint across all packages
2. **test-shared** — `npx vitest run packages/shared` (pure calculations, fast)
3. **test-api** — `npx vitest run packages/api` (needs PostgreSQL service container)
4. **test-dashboard** — `npx vitest run packages/dashboard` (jsdom environment)
5. **build** — `npm run build` (verify all packages compile)
6. **security** — `npm audit --audit-level=high`

PostgreSQL service container config for API tests:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: retirement
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: retirement_saas_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### 2. `deploy-staging.yml` — Staging Deployment

Triggered on: push to main

Jobs:
1. Run all CI checks (reuse ci.yml or duplicate)
2. Build dashboard for production
3. Deploy API to staging (Railway/Render)
4. Deploy dashboard to staging (Vercel/Cloudflare Pages)
5. Run Prisma migrations against staging DB
6. Smoke test staging endpoints

### 3. `deploy-production.yml` — Production Deployment

Triggered on: manual dispatch or release tag

Jobs:
1. All CI checks pass
2. Build and deploy API
3. Build and deploy dashboard
4. Run Prisma migrations
5. Health check
6. Notify (Slack/email)

## Required Secrets

Configure in GitHub repo Settings > Secrets:
- `DATABASE_URL` — Staging/production PostgreSQL connection string
- `CLERK_SECRET_KEY` or `AUTH0_SECRET` — Auth provider
- `STRIPE_SECRET_KEY` — Payment processing
- `ENCRYPTION_MASTER_KEY` — Financial data encryption
- `VERCEL_TOKEN` or `CLOUDFLARE_API_TOKEN` — Frontend deployment
- `RAILWAY_TOKEN` or `RENDER_API_KEY` — Backend deployment

## Node.js Setup

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
- run: npm ci
```

## Key Files

- `.github/workflows/` — Workflow YAML files
- `package.json` (root) — Workspace scripts: `test`, `build`, `lint`
- `packages/api/prisma/` — Migration files
- `docker-compose.yml` — Reference for service container config
