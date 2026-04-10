# CWE-to-Compliance Framework Mapping Report (Re-Audit)

| Field | Value |
|---|---|
| **Date** | 2026-04-02 |
| **Commit** | 93a719f (post-fix) |
| **Branch** | expand-household-model |
| **Source Reports** | `audits/sast-dast-scan.md` (re-audit), `audits/supply-chain-audit.md` (re-audit) |
| **Previous CWEs** | 17 |
| **Resolved CWEs** | 8 (fully resolved) |
| **New CWEs** | 2 |
| **Current Open CWEs** | 11 |

---

## 0. Delta Summary

### CWEs Fully Resolved Since Last Audit

The following 8 CWEs have been fully remediated and no longer appear in open findings:

| CWE ID | CWE Name | Original Finding(s) | Fix Applied |
|---|---|---|---|
| CWE-347 | Improper Verification of Cryptographic Signature | H-01 (Stripe webhook secret non-null assertion) | Proper null check + 500 response |
| CWE-22 | Improper Limitation of a Pathname to a Restricted Directory | H-02 (Path traversal in `serve.js`) | `startsWith(ROOT)` guard added |
| CWE-338 | Use of Cryptographically Weak PRNG | M-01 (`Math.random()` for request IDs) | Replaced with `crypto.randomUUID()` |
| CWE-942 | Overly Permissive Cross-domain Whitelist | M-02 (CORS wildcard with credentials) | Wildcard `*` rejected when `credentials: true` |
| CWE-200 | Exposure of Sensitive Information to an Unauthorized Actor | M-03 (Health endpoint info disclosure) | Restricted to admin users only |
| CWE-284 | Improper Access Control | M-05 (Releases auth flow guard) | Added `if (_reply.sent) return` check |
| CWE-362 | Concurrent Execution Using Shared Resource with Improper Synchronization | M-06 (Webhook idempotency race) | Insert-first with P2002 unique constraint catch |
| CWE-311 | Missing Encryption of Sensitive Data | M-07 (Encryption silent degradation) | Throws on startup in production; health check added |

Additionally, CWE-185 (Incorrect Regular Expression, L-01) was resolved -- the SQL keyword blocklist was removed. CWE-1021 (Improper Restriction of Rendered UI Layers, I-01) from the original report does not appear in the re-audit findings and is considered resolved.

**Net effect: 10 of 17 original CWEs resolved or removed from open findings.**

### CWEs Partially Resolved

| CWE ID | CWE Name | Status | Detail |
|---|---|---|---|
| CWE-798 | Use of Hard-Coded Credentials | Partially resolved | C-02 (hardcoded DB password in PowerShell script) fixed; C-01 (Clerk keys in `.env` on disk) remains |
| CWE-1393 | Use of Default Credentials | Partially resolved | Postgres password in `.env.example` fixed with placeholder; Redis `changeme` remains |

### New CWEs Since Last Audit

| CWE ID | CWE Name | Finding | Source |
|---|---|---|---|
| CWE-394 | Unexpected Status Code or Return Value | N-01 (Preferences PATCH returns 200 on validation error) | SAST/DAST re-audit |
| CWE-918 | Server-Side Request Forgery (SSRF) | GHSA-gjxx-92w9-8v8f (Clerk `clerkFrontendApiProxy` SSRF leaks secret keys) | Supply chain re-audit |

**Note:** The Effect context contamination advisory (GHSA-38f7-945m-qr2g) maps to CWE-362 (Race Condition), which was already in the original report for M-06. However, M-06 was fixed at the application level. The new transitive vulnerability reintroduces CWE-362 via the supply chain, so it is retained as an open CWE with a different source.

---

## 1. Per-CWE Compliance Mapping (Open Findings Only)

| CWE ID | CWE Name | Findings | OWASP Top 10 2021 | OWASP LLM Top 10 2025 | NIST SP 800-53 | EU AI Act (Art. 25) | ISO 27001 | SOC 2 | MITRE ATT&CK | MITRE ATLAS |
|---|---|---|---|---|---|---|---|---|---|---|
| CWE-798 | Use of Hard-Coded Credentials | C-01 | A07:2021 - Security Misconfiguration | -- | IA-5 (Authenticator Management), SC-12 (Cryptographic Key Establishment) | -- | A.9.2.4 (Management of secret authentication information) | CC6.1 (Logical and Physical Access Controls) | T1552.001 (Unsecured Credentials: Credentials In Files) | -- |
| CWE-1393 | Use of Default Credentials | H-03 (partial) | A07:2021 - Security Misconfiguration | -- | IA-5 (Authenticator Management) | -- | A.9.2.4 (Management of secret authentication information) | CC6.1 (Logical and Physical Access Controls) | T1078.001 (Valid Accounts: Default Accounts) | -- |
| CWE-20 | Improper Input Validation | L-04 | A03:2021 - Injection | -- | SI-10 (Information Input Validation) | Art. 25(1) - Accuracy, robustness, cybersecurity | A.14.2.5 (Secure system engineering principles) | CC6.1 (Logical and Physical Access Controls) | T1190 (Exploit Public-Facing Application) | AML.T0043 (Craft Adversarial Data) |
| CWE-367 | Time-of-Check Time-of-Use (TOCTOU) Race Condition | H-05 | A04:2021 - Insecure Design | -- | SC-4 (Information in Shared System Resources) | -- | A.14.2.5 (Secure system engineering principles) | CC6.1 (Logical and Physical Access Controls) | T1068 (Exploitation for Privilege Escalation) | -- |
| CWE-362 | Concurrent Execution Using Shared Resource with Improper Synchronization | GHSA-38f7-945m-qr2g (transitive via Prisma/Effect) | A04:2021 - Insecure Design | -- | SC-4 (Information in Shared System Resources) | -- | A.14.2.5 (Secure system engineering principles) | CC7.2 (System Monitoring) | T1499 (Endpoint Denial of Service) | -- |
| CWE-394 | Unexpected Status Code or Return Value | N-01 | A04:2021 - Insecure Design | -- | SI-11 (Error Handling) | -- | A.14.2.5 (Secure system engineering principles) | CC7.2 (System Monitoring) | -- | -- |
| CWE-400 | Uncontrolled Resource Consumption | L-02, L-03, L-06 | A05:2021 - Security Misconfiguration | -- | SC-5 (Denial-of-Service Protection) | Art. 25(1) - Accuracy, robustness, cybersecurity | A.14.1.2 (Securing application services on public networks) | CC6.8 (System Operations - Availability) | T1499 (Endpoint Denial of Service) | AML.T0029 (Denial of ML Service) |
| CWE-915 | Improperly Controlled Modification of Dynamically-Determined Object Attributes | L-05 | A08:2021 - Software and Data Integrity Failures | -- | SI-10 (Information Input Validation) | -- | A.14.2.5 (Secure system engineering principles) | CC6.1 (Logical and Physical Access Controls) | T1059 (Command and Scripting Interpreter) | -- |
| CWE-918 | Server-Side Request Forgery (SSRF) | GHSA-gjxx-92w9-8v8f (Clerk) | A10:2021 - Server-Side Request Forgery | -- | SC-7 (Boundary Protection), AC-4 (Information Flow Enforcement) | -- | A.13.1.3 (Segregation in networks) | CC6.6 (System Boundaries) | T1190 (Exploit Public-Facing Application) | -- |

---

## 2. Aggregate Compliance Matrix (Open Findings Only)

### Findings Per OWASP Top 10 2021 Category

| OWASP Top 10 2021 Category | CWE Count | Change | CWEs |
|---|---|---|---|
| A01:2021 - Broken Access Control | 0 | **-3** | (CWE-22, CWE-200, CWE-284 resolved) |
| A02:2021 - Cryptographic Failures | 0 | **-3** | (CWE-347, CWE-338, CWE-311 resolved) |
| A03:2021 - Injection | 1 | -1 | CWE-20 (CWE-185 resolved) |
| A04:2021 - Insecure Design | 3 | 0 | CWE-367, CWE-362 (new source), CWE-394 (new) |
| A05:2021 - Security Misconfiguration | 1 | -2 | CWE-400 (CWE-942, CWE-1021 resolved) |
| A07:2021 - Security Misconfiguration (Credentials) | 2 | 0 | CWE-798, CWE-1393 |
| A08:2021 - Software and Data Integrity Failures | 1 | 0 | CWE-915 |
| A10:2021 - Server-Side Request Forgery | 1 | **+1** | CWE-918 (new, from supply chain) |
| A06, A09 | 0 | -- | -- |

**Notable:** A01 (Broken Access Control) and A02 (Cryptographic Failures) are now clear -- all findings in those categories were remediated. A10 (SSRF) has a new entry from the Clerk supply chain vulnerability.

### Findings Per NIST SP 800-53 Control Family

| NIST 800-53 Control Family | CWE Count | Change |
|---|---|---|
| SI (System and Information Integrity) | 3 | -4 |
| SC (System and Communications Protection) | 4 | -3 |
| AC (Access Control) | 1 | -3 |
| IA (Identification and Authentication) | 2 | 0 |

### Findings Per EU AI Act (Art. 25)

| EU AI Act Provision | CWE Count | Change | CWEs |
|---|---|---|---|
| Art. 25(1) - Accuracy, robustness, cybersecurity | 2 | -2 | CWE-20, CWE-400 (CWE-284, CWE-311 resolved) |
| Art. 25(2) - Transparency, provision of information | 0 | -1 | (CWE-200 resolved) |
| No direct mapping | 9 | -- | Remaining CWEs |

### Findings Per ISO 27001 Control

| ISO 27001 Control | CWE Count | Change |
|---|---|---|
| A.14.2.5 (Secure system engineering principles) | 5 | -3 |
| A.9.2.4 (Management of secret authentication information) | 2 | 0 |
| A.14.1.2 (Securing application services on public networks) | 1 | -1 |
| A.13.1.3 (Segregation in networks) | 1 | 0 (was CWE-942, now CWE-918) |
| A.10.1.1 (Policy on use of cryptographic controls) | 0 | -3 |
| A.9.4.1 (Information access restriction) | 0 | -1 |
| A.18.1.4 (Privacy and protection of PII) | 0 | -1 |

### Findings Per SOC 2 Criteria

| SOC 2 Trust Services Criteria | CWE Count | Change |
|---|---|---|
| CC6.1 (Logical and Physical Access Controls) | 5 | -7 |
| CC7.2 (System Monitoring) | 2 | -1 |
| CC6.6 (System Boundaries) | 1 | -1 (was CWE-942, now CWE-918) |
| CC6.8 (System Operations - Availability) | 1 | 0 |

### Findings Per MITRE ATT&CK Technique

| MITRE ATT&CK Technique | CWE Count | Change |
|---|---|---|
| T1190 (Exploit Public-Facing Application) | 2 | -1 |
| T1499 (Endpoint Denial of Service) | 2 | -1 |
| T1552.001 (Unsecured Credentials: Credentials In Files) | 1 | 0 |
| T1078.001 (Valid Accounts: Default Accounts) | 1 | 0 |
| T1068 (Exploitation for Privilege Escalation) | 1 | 0 |
| T1059 (Command and Scripting Interpreter) | 1 | 0 |
| T1189 (Drive-by Compromise) | 0 | -1 |
| T1082 (System Information Discovery) | 0 | -1 |
| T1083 (File and Directory Discovery) | 0 | -1 |
| T1185 (Browser Session Hijacking) | 0 | -1 |
| T1565.001 (Data Manipulation: Stored Data Manipulation) | 0 | -1 |
| No mapping | 1 | -1 (CWE-185 resolved; CWE-394 remains unmapped) |

### Findings Per MITRE ATLAS Technique

| MITRE ATLAS Technique | CWE Count | Change |
|---|---|---|
| AML.T0043 (Craft Adversarial Data) | 1 | 0 |
| AML.T0029 (Denial of ML Service) | 1 | 0 |
| AML.T0045 (System Misuse) | 0 | -2 (CWE-200, CWE-284 resolved) |
| No mapping | 9 | -- |

---

## 3. Framework Coverage Summary

| Framework | CWEs Mapped | CWEs Not Mapped | Coverage | Change |
|---|---|---|---|---|
| OWASP Top 10 2021 | 11 / 11 | 0 | **100%** | -- (maintained) |
| OWASP LLM Top 10 2025 | 0 / 11 | 11 | **0%** | -- (expected, no LLM features) |
| NIST SP 800-53 | 11 / 11 | 0 | **100%** | -- (maintained) |
| EU AI Act (Art. 25) | 2 / 11 | 9 | **18%** | -11pp (fewer applicable CWEs remain) |
| ISO 27001 | 11 / 11 | 0 | **100%** | -- (maintained) |
| SOC 2 | 11 / 11 | 0 | **100%** | -- (maintained) |
| MITRE ATT&CK | 10 / 11 | 1 | **91%** | +3pp (CWE-394 unmapped; resolved CWEs had mixed mappings) |
| MITRE ATLAS | 2 / 11 | 9 | **18%** | -6pp (fewer applicable CWEs remain) |

---

## 4. Compliance Coverage Gap Analysis (Updated)

### Improvements Since Last Audit

- **OWASP Top 10 A01 (Broken Access Control):** Cleared -- all 3 CWEs resolved (CWE-22, CWE-200, CWE-284).
- **OWASP Top 10 A02 (Cryptographic Failures):** Cleared -- all 3 CWEs resolved (CWE-347, CWE-338, CWE-311). The encryption silent degradation fix (M-07) was the most impactful remediation.
- **NIST SC family:** Reduced from 7 to 4 mapped CWEs. Key wins: SC-12 (key establishment) and SC-28 (protection at rest) are no longer triggered by open findings.
- **ISO 27001 A.10.1.1 (Cryptographic controls):** Cleared entirely -- all three crypto-related CWEs resolved.

### Remaining Concerns

- **OWASP Top 10 A04 (Insecure Design):** Holds at 3 CWEs, now the largest category. Includes the new supply chain race condition and the new N-01 finding.
- **OWASP Top 10 A10 (SSRF):** New category triggered by the Clerk supply chain vulnerability. Previously had zero findings in this category.
- **A07 (Credential Misconfiguration):** Unchanged at 2 CWEs. The Clerk key on disk (C-01) and Redis default password (H-03) remain.

### AI-Specific Framework Gaps (Unchanged)

- **OWASP LLM Top 10 2025:** Zero coverage remains expected -- no LLM inference in this API.
- **EU AI Act / MITRE ATLAS:** Coverage decreased in absolute terms because the resolved CWEs included several that had AI-adjacent mappings (CWE-20, CWE-200, CWE-284, CWE-311, CWE-400 for EU AI Act; CWE-200, CWE-284 for ATLAS). The remaining open CWEs are less AI-relevant. No action required unless AI features are added.

### Key Takeaway

The remediation cycle eliminated all Broken Access Control and Cryptographic Failures findings, the two most impactful OWASP categories. The remaining open CWE surface is dominated by Insecure Design patterns (race conditions, incorrect status codes) and credential hygiene issues. The new Clerk SSRF vulnerability introduces the first A10 finding, which should be addressed by running `npm audit fix`.

---

*Re-audit report generated 2026-04-02. CWEs extracted from Phase 1 re-audit SAST/DAST and supply chain scan reports. Delta computed against initial audit (same date, pre-fix baseline).*
