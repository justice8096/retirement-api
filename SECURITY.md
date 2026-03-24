# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: [security contact - update this]
3. Include: description, reproduction steps, potential impact

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Security Measures

### Authentication & Authorization
- Clerk JWT verification on all authenticated endpoints
- Role-based access control (user, admin)
- Subscription tier enforcement (free, basic, premium)

### Data Protection
- AES-256-GCM encryption at rest for financial fields (portfolioBalance, targetAnnualIncome, ssPia)
- PostgreSQL with parameterized queries via Prisma (SQL injection prevention)
- Input sanitization on all routes
- Request body size limits (1MB)

### Rate Limiting
- Per-tier rate limits with Redis-backed distributed store
- Fallback to in-memory store when Redis unavailable

### Network Security
- CORS origin whitelist via `CORS_ORIGIN` env var
- Helmet security headers
- TLS support via Tailscale or custom certificates

### Infrastructure
- Non-root Docker containers
- Multi-stage Docker builds (minimal production images)
- Health check endpoints for orchestrator probes
- No secrets in source code (CI-enforced)

## Dependency Management
- `npm audit` runs in CI on every PR
- Critical vulnerability audits block merges
- Dependencies pinned with package-lock.json
