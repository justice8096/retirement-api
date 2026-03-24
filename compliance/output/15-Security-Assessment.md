# Security Assessment

> **Laws served:** China Amended Cybersecurity Law + National Security Standards; UK Cyber Security and Resilience Bill; EU AI Act Art. 55 (GPAI systemic risk); South Korea AI Basic Act; China GenAI Basic Security Requirements
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | Retirement Planning SaaS Platform |
| Organization | Retirement Planning SaaS |
| Document owner | Justin, Project Owner |
| Session/GitHub ref | RP-2026-001 |
| Date created | 2026-03-22 |
| Author | Auto-filled by compliance tooling (review and add human author) |
| Assessor(s) | |
| Next review date | |

---

## 1. Security Scope

| Field | Details |
|-------|---------|
| System components assessed | API (Fastify), Frontend (React SPA), Infrastructure (Docker/Nginx/PostgreSQL/Redis), Data pipeline (Zustand stores, localStorage), State management (centralized useAssumptionsStore) |
| Deployment environment | Docker Compose production stack — self-hosted with Tailscale TLS (nginx reverse proxy + Fastify API + PostgreSQL + Redis). Public access via Tailscale Funnel with auto TLS termination. |
| Data classification | Location data: Public. Financial settings (portfolio, PIA, income): Confidential (AES-256-GCM encrypted at rest). User preferences: Internal. |
| Jurisdictions with security requirements | US (state privacy laws), EU (GDPR, AI Act) |

---

## 2. Threat Assessment

| Threat Category | Specific Threats | Likelihood | Impact | Controls |
|----------------|-----------------|-----------|--------|----------|
| **Model attacks** | N/A — no LLM in production runtime | Low | Low | AI agents run offline only (data update pipeline); no user-facing LLM endpoints |
| **Data attacks** | Financial data extraction, localStorage tampering | Medium | High | AES-256-GCM encryption at rest, Clerk JWT auth, server-side tier enforcement |
| **Infrastructure** | Unauthorized access, DDoS, supply chain compromise | Medium | High | Tailscale TLS, nginx rate limiting, Clerk auth, Docker network isolation |
| **Output manipulation** | Cost data tampering, projection manipulation | Low | Medium | Server-authoritative location data, Zod validation, prototype pollution defense |
| **Privacy attacks** | PII leakage from financial settings, localStorage exposure | Medium | High | Encrypted JSONB fields, GDPR data export with decryption, no innerHTML with external data |
| **Social engineering** | Credential theft, insider threat | Low | High | Clerk managed auth (no custom password handling), admin role separation |
| **Client-side state** | localStorage store tampering, XSS via assumptions store | Medium | Medium | Zustand persist with validated defaults, no eval/innerHTML, Helmet CSP headers |

---

## 3. Security Controls

### 3.1 Model Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Input validation and sanitization | [x] | Zod schema validation on all API endpoints; safeJsonRecord strips __proto__, constructor, prototype keys |
| Prompt injection defenses | [N/A] | No LLM in production runtime; AI agents run offline only |
| Output filtering | [x] | API responses filtered by tier; health endpoint hides details for unauthenticated users |
| Rate limiting | [x] | Redis-backed (or in-memory fallback) rate limiting on all API routes |
| Model access controls (API keys, auth) | [x] | Clerk JWT authentication; requireAuth, requireTier, requireAdmin middleware chain |
| Adversarial robustness testing | [N/A] | No user-facing ML model |
| Model versioning and integrity checks | [N/A] | No ML model in production |

### 3.2 Data Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Financial data encryption at rest | [x] | AES-256-GCM for portfolioBalance, targetAnnualIncome, ssPia stored as JSONB envelopes in PostgreSQL |
| Data encryption in transit | [x] | Tailscale TLS termination at nginx; all client-server traffic over HTTPS |
| Access controls on data | [x] | Per-user data isolation via Clerk userId; tier-gated endpoints; admin-only location management |
| Data integrity verification | [x] | AES-256-GCM authentication tags prevent tampering; Zod validation on all inputs |
| Anonymization / pseudonymization | [x] | Clerk manages identity; financial fields encrypted; GDPR export includes decrypted data |
| Secure data deletion | [x] | GDPR data export endpoint (/api/me/export); user can request full data deletion |
| Data backup and recovery | [ ] | PostgreSQL backup strategy TBD |
| Client-side data security | [x] | Zustand stores persist to localStorage with validated defaults; centralized useAssumptionsStore migration cleans up legacy keys; no sensitive data in URL params |

### 3.3 Infrastructure Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Network segmentation | [x] | Docker Compose internal network; only nginx exposed; PostgreSQL/Redis on internal network only |
| Firewall / WAF | [x] | Nginx reverse proxy with rate limit headers; CORS restricted to APP_URL origin |
| Intrusion detection / prevention | [ ] | Not yet implemented |
| Container / runtime security | [x] | Docker Compose with named volumes; non-root containers planned |
| Secrets management | [x] | Environment variables for encryption key, Clerk secret, Stripe secret; .env in .gitignore; startup validation warns if encryption key missing |
| Patch management | [x] | npm audit for dependency vulnerabilities; Dependabot alerts enabled |
| Logging and monitoring | [x] | Sentry error reporting for 5xx errors; request ID tracking for audit trails; Fastify structured logging |

### 3.4 Operational Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Incident response plan | [x] | See compliance template 13 (Incident Management) |
| Security training for staff | [ ] | Single-developer project; documented in CLAUDE.md and DESIGN-DOCUMENT.md |
| Vulnerability disclosure program | [ ] | Not yet established |
| Penetration testing | [ ] | Manual OWASP Top 10 audit performed (commit 5fba175); automated scanning TBD |
| Third-party security assessment | [ ] | Not yet conducted |
| Business continuity plan | [ ] | Docker Compose enables rapid redeployment; PostgreSQL backup strategy TBD |

### 3.5 Client-Side Security (Added 2026-03-22)

| Control | Implemented? | Details |
|---------|:---:|---------|
| XSS prevention | [x] | React auto-escapes JSX output; no raw HTML injection or dynamic code evaluation in dashboard code |
| CSP headers | [x] | Helmet CSP via Fastify; restricts script sources, frame ancestors |
| localStorage integrity | [x] | Zustand persist middleware with validated defaults; centralized store migration removes legacy keys; no credentials in localStorage |
| State management security | [x] | useAssumptionsStore centralizes financial inputs with type-safe defaults; useScenarioOverride validates override values against base assumptions |
| Body size limits | [x] | Fastify body size limit (1 MB) prevents payload-based DoS |
| Cookie security | [x] | Clerk manages session cookies with secure defaults |

---

## 4. China-Specific Security Requirements

### 4.1 Basic Security Requirements for GenAI Services (Nov 2025)

| Requirement | Status | Evidence |
|------------|--------|---------|
| GenAI operational security controls documented | [ ] | |
| Content safety mechanisms in place | [ ] | |
| User complaint handling security | [ ] | |

### 4.2 Pre-training/Fine-tuning Data Security (Nov 2025)

| Requirement | Status | Evidence |
|------------|--------|---------|
| Data sourcing security documented | [ ] | |
| Data processing security documented | [ ] | |
| Data storage security documented | [ ] | |

### 4.3 Data Annotation Security (Nov 2025)

| Requirement | Status | Evidence |
|------------|--------|---------|
| Annotation process security documented | [ ] | |
| Annotator access controls | [ ] | |
| Annotation data protection | [ ] | |

---

## 5. EU GPAI Systemic Risk — Cybersecurity (Art. 55)

> **Applies to:** GPAI models with systemic risk (>10^25 FLOPS)

| Requirement | Status | Evidence |
|------------|--------|---------|
| Cybersecurity protections assessed | [ ] | |
| Adversarial testing conducted | [ ] | [Results ref] |
| Model evaluation completed | [ ] | [Results ref] |
| Incident tracking and reporting to AI Office | [ ] | |

---

## 6. Vulnerability Assessment Results

| Vulnerability ID | Description | Severity | CVSS | Status | Remediation | Date Fixed |
|-----------------|-------------|----------|:---:|--------|-------------|-----------|
| | | [Critical/High/Med/Low] | | [Open/In progress/Fixed/Accepted] | | |

---

## 7. Penetration Test Summary

| Test Date | Scope | Tester | Findings (Critical/High/Med/Low) | Report Ref |
|-----------|-------|--------|:---:|-----------|
| | | [Internal / External firm] | /  /  /  | |

---

## 8. Evidence Checklist

- [x] Threat assessment completed (2026-03-22)
- [x] Model security controls implemented and documented (N/A — no LLM in prod; input validation via Zod)
- [x] Data security controls implemented and documented (AES-256-GCM, Clerk auth, Zustand store migration)
- [x] Infrastructure security controls verified (Docker network isolation, nginx, TLS, rate limiting)
- [ ] China security specifications met (if applicable)
- [ ] EU GPAI systemic risk cybersecurity assessed (if applicable)
- [x] Vulnerability assessment completed (OWASP Top 10 audit, npm audit, code scan 2026-03-22)
- [ ] Penetration testing completed
- [x] Incident response plan tested (see template 13)
- [x] Next review date scheduled: 2026-04-22

---

*This template supports compliance evidence gathering. It is not legal advice.*
