# CWE-to-Compliance Framework Mapping Report

| Field | Value |
|---|---|
| **Date** | 2026-04-19 |
| **Commit** | 80e2e91 |
| **Branch** | cleanup/seed-data-integrity-path |
| **Source Reports** | `audits/sast-dast-scan.md`, `audits/supply-chain-audit.md` (this cycle) |
| **Previous CWEs (2026-04-16)** | 11 open |
| **Resolved Since Last Audit** | 1 (CWE-703 Preferences PATCH error handling fix) |
| **New CWEs This Audit** | 5 (CWE-1287 Fastify, CWE-436/863 Clerk bypass, CWE-489 dev bypass, CWE-362 Stripe-customer race) |
| **Currently Open CWEs** | 15 distinct |

---

## 0. Delta Summary

### Resolved Since 2026-04-16

| CWE | Title | How Resolved |
|---|---|---|
| CWE-703 | Improper Check of Exceptional Conditions (Preferences PATCH) | Now returns `reply.code(400)` on both validation passes |

### Newly Introduced / Disclosed

| CWE | Title | Origin |
|---|---|---|
| CWE-1287 | Improper Validation of Specified Type of Input | Upstream Fastify advisory GHSA-247c-9743-5963 |
| CWE-436 | Interpretation Conflict | `@clerk/shared` GHSA-vqx2-fgx2-5wq9 |
| CWE-863 | Incorrect Authorization | `@clerk/shared` GHSA-vqx2-fgx2-5wq9 |
| CWE-489 | Active Debug Code | New dev-bypass block in `auth.ts` (auto-creates admin user) |
| CWE-362 | Concurrent Execution with Improper Synchronization | Stripe customer creation race between `billing.ts` and `releases.ts` |
| CWE-180 | Incorrect Behavior Order: Validate Before Canonicalize | Vite dev-server advisories (transitive, dev-only) |
| CWE-284 | Improper Access Control | Vite dev-server advisories (transitive, dev-only) |

### Still Open (Carried Over)

| CWE | Title | File |
|---|---|---|
| CWE-798 | Use of Hard-Coded Credentials | `.env` (risk-accepted) |
| CWE-1393 | Use of Default Credentials | `.env.example` (Redis) |
| CWE-367 | TOCTOU Race Condition | `auth.ts` user cache |
| CWE-400 | Uncontrolled Resource Consumption | `sanitize.ts`, `admin.ts` reindex, `users.ts` export |
| CWE-20 | Improper Input Validation | `contributions.ts` `processApproval`, `fees.ts` no `.strict()` |
| CWE-915 | Improperly Controlled Modification of Dynamically-Determined Object Attributes | `preferences.ts` passthrough |
| CWE-22, CWE-200 | Path Traversal / Information Exposure | Vite transitive |
| CWE-209 | Information Exposure through Error Message | `validation.ts` fieldPath |

---

## 1. Per-CWE Detail

### CWE-798 — Use of Hard-Coded Credentials

- **Finding**: C-01 (Clerk test keys in `.env` on disk, not in git)
- **Severity**: CRITICAL (risk-accepted by operator)
- **Frameworks**:
  - OWASP Top 10 2021: **A02:2021 Cryptographic Failures**, **A07:2021 Identification and Authentication Failures**
  - OWASP LLM Top 10 2025: **LLM06 Sensitive Information Disclosure**
  - NIST SP 800-53: **IA-5** (Authenticator Management), **SC-28** (Protection of Information at Rest)
  - EU AI Act Art. 25: Risk management of credential compromise
  - ISO 27001: **A.9.2.4** (Management of secret authentication)
  - SOC 2: **CC6.1** (Logical access security)
  - MITRE ATT&CK: **T1552.001** (Unsecured Credentials: Files)
  - MITRE ATLAS: — (not applicable)

### CWE-1287 — Improper Validation of Specified Type of Input (NEW)

- **Finding**: H-NEW-01 (Fastify body-schema bypass)
- **Severity**: HIGH (CVSS 7.5)
- **Frameworks**:
  - OWASP Top 10 2021: **A03:2021 Injection** (input handling)
  - NIST SP 800-53: **SI-10** (Information Input Validation)
  - ISO 27001: **A.14.2.5** (Secure system engineering)
  - SOC 2: **CC8.1** (Change management)
  - MITRE ATT&CK: **T1190** (Exploit Public-Facing Application)

### CWE-436 + CWE-863 — Interpretation Conflict / Incorrect Authorization (NEW)

- **Finding**: H-NEW-02 (Clerk middleware bypass)
- **Severity**: CRITICAL (CVSS 9.1)
- **Frameworks**:
  - OWASP Top 10 2021: **A01:2021 Broken Access Control**
  - NIST SP 800-53: **AC-3** (Access Enforcement)
  - EU AI Act Art. 14 (Human oversight — access to AI systems)
  - ISO 27001: **A.9.4** (System and application access control)
  - SOC 2: **CC6.1–CC6.3** (Logical access)
  - MITRE ATT&CK: **T1078** (Valid Accounts)

### CWE-489 — Active Debug Code (NEW)

- **Finding**: M-NEW-01 (Dev bypass auto-creates admin user)
- **Severity**: MEDIUM
- **Frameworks**:
  - OWASP Top 10 2021: **A05:2021 Security Misconfiguration**
  - NIST SP 800-53: **CM-7** (Least Functionality)
  - ISO 27001: **A.12.1.4** (Separation of dev/test/prod)
  - SOC 2: **CC8.1** (Change management)
  - MITRE ATT&CK: **T1078.001** (Default Accounts)

### CWE-362 — Concurrent Execution w/ Improper Synchronization (NEW)

- **Finding**: L-NEW-02 (Stripe customer created twice if parallel checkouts)
- **Severity**: LOW
- **Frameworks**:
  - OWASP Top 10 2021: **A04:2021 Insecure Design**
  - NIST SP 800-53: **SC-5** (Denial of Service Protection — tangential)
  - ISO 27001: **A.14.2.1** (Secure development policy)

### CWE-367 — TOCTOU Race Condition (UNCHANGED)

- **Finding**: H-05 (user cache)
- **Severity**: HIGH
- **Frameworks**: OWASP A01, A04; NIST AC-3, AC-6; ISO A.9.2.1; SOC 2 CC6.1

### CWE-1393 — Use of Default Credentials (UNCHANGED, PARTIAL)

- **Finding**: H-03 (Redis `changeme` in `.env.example`)
- **Frameworks**: OWASP A07, A05; NIST IA-5; ISO A.9.2.4

### CWE-400 — Uncontrolled Resource Consumption (UNCHANGED)

- **Findings**: L-02 (JSONB depth), L-03 (reindex), L-06 (export timeout)
- **Frameworks**: OWASP A04, A05; NIST SC-5; ISO A.13.1.1; SOC 2 CC7.1

### CWE-20 — Improper Input Validation (UNCHANGED / EXTENDED)

- **Findings**: L-04 (`processApproval`), M-02 (fees schema no `.strict()`), L-NEW-01 (release `id` not validated)
- **Frameworks**: OWASP A03; NIST SI-10; ISO A.14.2.5; MITRE ATT&CK T1190

### CWE-915 — Improper Controlled Modification of Dynamically-Determined Object Attributes

- **Finding**: L-05 (preferences `.passthrough()`)
- **Severity**: LOW (partially mitigated by `accessibilityPrefsSchema`)
- **Frameworks**: OWASP A03, A08; NIST SI-10; ISO A.14.2.5

### CWE-209 — Information Exposure Through Error Message

- **Finding**: L-NEW-03 (validation error leaks schema structure)
- **Severity**: INFO
- **Frameworks**: OWASP A09; NIST AU-2; ISO A.12.4

### CWE-22 / CWE-200 / CWE-180 / CWE-284 (Vite transitive, dev-only)

- **Finding**: Supply-chain A-03/A-04/A-05
- **Severity**: HIGH (dev-only; low production exposure)
- **Frameworks**: OWASP A01, A05; NIST SC-5, AC-6; ISO A.14.1.3

---

## 2. Aggregate Compliance Matrix

Mapping every open CWE to the 8 target frameworks. Cell value: "Direct" if the framework names the control, "Related" if it fits under a broader clause.

| CWE | OWASP Top 10 2021 | OWASP LLM Top 10 2025 | NIST SP 800-53 | EU AI Act Art. 25 | ISO 27001 | SOC 2 | MITRE ATT&CK | MITRE ATLAS |
|---|---|---|---|---|---|---|---|---|
| CWE-798 | A02, A07 | LLM06 | IA-5, SC-28 | Art. 25 | A.9.2.4 | CC6.1 | T1552.001 | — |
| CWE-1287 | A03 | — | SI-10 | Art. 25 | A.14.2.5 | CC8.1 | T1190 | — |
| CWE-436 | A01 | — | AC-3 | Art. 14 | A.9.4 | CC6.1 | T1078 | — |
| CWE-863 | A01 | LLM04 | AC-3 | Art. 14 | A.9.4 | CC6.1 | T1078 | AML.T0051 |
| CWE-489 | A05 | — | CM-7 | Art. 25 | A.12.1.4 | CC8.1 | T1078.001 | — |
| CWE-362 | A04 | — | SC-5 | Art. 25 | A.14.2.1 | CC8.1 | — | — |
| CWE-367 | A01, A04 | — | AC-3, AC-6 | Art. 14 | A.9.2.1 | CC6.1 | — | — |
| CWE-1393 | A07, A05 | — | IA-5 | Art. 25 | A.9.2.4 | CC6.1 | — | — |
| CWE-400 | A04, A05 | LLM10 | SC-5 | Art. 25 | A.13.1.1 | CC7.1 | T1499 | AML.T0029 |
| CWE-20 | A03 | LLM01 | SI-10 | Art. 25 | A.14.2.5 | CC8.1 | T1190 | AML.T0043 |
| CWE-915 | A03, A08 | — | SI-10 | Art. 25 | A.14.2.5 | CC8.1 | — | — |
| CWE-209 | A09 | — | AU-2, SC-30 | Art. 13 | A.12.4 | CC7.2 | T1213 | — |
| CWE-22 (Vite) | A01 | — | SC-5 | Art. 25 | A.14.1.3 | CC6.6 | T1059.007 | — |
| CWE-200 (Vite) | A05 | LLM06 | SC-30 | Art. 25 | A.8.2.3 | CC6.7 | T1213 | — |
| CWE-180 (Vite) | A01 | — | AC-6 | — | A.9.4.1 | CC6.3 | — | — |
| CWE-284 (Vite) | A01 | — | AC-3 | Art. 14 | A.9.4 | CC6.1 | T1078 | — |

---

## 3. OWASP Top 10 2021 Coverage

| OWASP Category | CWEs This Project Matches | Open Findings |
|---|---|---|
| A01 Broken Access Control | CWE-367, CWE-436, CWE-863, CWE-22, CWE-180, CWE-284 | H-05, A-02, A-03/04/05 |
| A02 Cryptographic Failures | CWE-798 | C-01 |
| A03 Injection | CWE-1287, CWE-20, CWE-915 | A-01, L-04, M-02 |
| A04 Insecure Design | CWE-367, CWE-362, CWE-400 | H-05, L-NEW-02 |
| A05 Security Misconfiguration | CWE-1393, CWE-489, CWE-200 | H-03, M-NEW-01 |
| A06 Vulnerable Components | covered by supply-chain-audit | A-01, A-02, A-03/04/05 |
| A07 Auth Failures | CWE-798, CWE-1393 | C-01, H-03 |
| A08 Software & Data Integrity | CWE-915 | L-05 |
| A09 Logging Failures | CWE-209 | L-NEW-03 |
| A10 SSRF | — | no current SSRF findings |

---

## 4. OWASP LLM Top 10 2025 Coverage

This project does not perform LLM inference (it is a data API). Mapping is mostly N/A. Categories that still apply:

- **LLM01 Prompt Injection** — N/A (no LLM prompt interface)
- **LLM02 Sensitive Info Disclosure** — CWE-798 relevance; encryption at rest partly mitigates
- **LLM04 Model DoS** — CWE-400 (resource consumption)
- **LLM06 Sensitive Info Disclosure** — CWE-798, CWE-200
- **LLM08 Excessive Agency** — CWE-489 (dev-bypass admin creation) is a soft match
- **LLM10 Model Theft** — N/A

---

## 5. EU AI Act Art. 25 Mapping

- **Risk Management**: no formal risk register — all 15 open CWEs should be tracked in one
- **Data Governance**: encryption at rest for financial PII addresses Art. 10 partially; no data-provenance documentation
- **Human Oversight (Art. 14)**: CWE-362, CWE-367, CWE-436, CWE-863 all touch access-control surfaces under human oversight
- **Technical Documentation (Art. 53)**: no SBOM, no build provenance — blocks Art. 53 full compliance

---

## 6. MITRE ATT&CK Mapping

Open findings map to these tactics/techniques:

- **Initial Access**: T1078 (Valid Accounts), T1190 (Exploit Public-Facing App), T1552.001 (Credentials in Files)
- **Privilege Escalation**: T1078.001 (Default Accounts)
- **Impact**: T1499 (Endpoint DoS), T1213 (Data from Information Repositories)
- **Execution**: T1059.007 (JavaScript — via Vite dev-server path)

---

## 7. MITRE ATLAS Mapping

Since this project has no ML/AI inference stack, ATLAS coverage is narrow:

- **AML.T0029 Resource Exhaustion** — CWE-400 analog
- **AML.T0043 Craft Adversarial Data** — CWE-20 analog (input validation)
- **AML.T0051 LLM Prompt Injection** — N/A

---

## 8. Recommendations for CWE Closure

1. **Close CWE-1287 + CWE-436 + CWE-863** in one step: `npm audit fix`.
2. **Close CWE-489**: add `DEV_AUTH_BYPASS=1` secondary gate in `auth.ts`.
3. **Close CWE-367**: export `invalidateUserCache()`; call from webhook.
4. **Close CWE-362**: optimistic-concurrency guard on `user.stripeCustomerId` update.
5. **Close CWE-1393**: placeholder in `.env.example` for Redis password.
6. **Close CWE-915**: remove `.passthrough()` from `preferencesPatchSchema`, or enumerate valid top-level keys.
7. **Close CWE-20 (multiple)**: `.strict()` on every Zod body schema; enum-typed `processApproval`; Zod validator for path `id` in `releases.ts`.
8. **Defer CWE-798** per operator's risk-acceptance stance; revisit at production launch.

If items 1–7 are applied, the open CWE count drops from 15 to 6 (CWE-798, CWE-1393-partial, CWE-400×3, CWE-209 informational). A follow-up audit should confirm residual risk is acceptable.
