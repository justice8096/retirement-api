# CWE Mapping & Compliance Cross-Walk — retirement-api

| Field | Value |
|---|---|
| **Date** | 2026-04-24 |
| **Commit** | `4a70922` (master) |
| **Source audit** | `sast-dast-scan-2026-04-24.md` |
| **Findings in scope** | 3 LOW (script hygiene), 2 INFO (positive controls) |
| **Previous mapping** | `cwe-mapping-2026-04-20.md` |

---

## Summary

All findings from the 2026-04-24 SAST scan are LOW-severity defence-in-depth items on offline developer scripts, plus two unchanged INFO positive controls. This file maps each to a CWE ID and to eight compliance frameworks: OWASP Top 10 2021, OWASP LLM Top 10 2025, NIST SP 800-53 Rev. 5, EU AI Act (Art. 25 — risk-management & post-market monitoring), ISO/IEC 27001:2022, SOC 2 TSC 2017, MITRE ATT&CK, MITRE ATLAS.

No finding in this audit triggers a regulated incident-reporting threshold in any of the eight frameworks.

---

## Per-finding mapping

### L-2026-04-24-01 — `apply-youtube-curation.mjs` path traversal (defence-in-depth)

| Field | Value |
|---|---|
| **CWE** | [CWE-22: Improper Limitation of a Pathname to a Restricted Directory](https://cwe.mitre.org/data/definitions/22.html) |
| **Files** | `scripts/apply-youtube-curation.mjs:15-34`, `scripts/apply-youtube-auto.mjs:89` |
| **OWASP Top 10 2021** | A01:2021 Broken Access Control (file-system access outside intent) |
| **OWASP LLM Top 10 2025** | N/A (no LLM surface) |
| **NIST SP 800-53 Rev. 5** | SI-10 Information Input Validation; SA-11 Developer Testing and Evaluation |
| **EU AI Act Art. 25** | N/A (not AI-facing) |
| **ISO/IEC 27001:2022** | A.8.28 Secure coding; A.8.29 Security testing in development |
| **SOC 2 TSC** | CC8.1 Change Management |
| **MITRE ATT&CK** | T1083 File and Directory Discovery (theoretical local-dev) |
| **MITRE ATLAS** | N/A |

### L-2026-04-24-02 — YouTube API-key leak risk via raw error body

| Field | Value |
|---|---|
| **CWE** | [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html) |
| **Files** | `scripts/curate-youtube-via-api.mjs:48-51`, `:64-67` |
| **OWASP Top 10 2021** | A09:2021 Security Logging and Monitoring Failures |
| **OWASP LLM Top 10 2025** | N/A (no LLM surface) |
| **NIST SP 800-53 Rev. 5** | AU-3 Content of Audit Records; SC-12 Cryptographic Key Establishment and Management; IA-5 Authenticator Management |
| **EU AI Act Art. 25** | N/A |
| **ISO/IEC 27001:2022** | A.8.15 Logging; A.5.15 Access control |
| **SOC 2 TSC** | CC6.1 Logical Access; CC7.2 System Monitoring |
| **MITRE ATT&CK** | T1552.001 Unsecured Credentials: Credentials in Files |
| **MITRE ATLAS** | N/A |

### L-2026-04-24-03 — Silent catch hides network failures in crime-source probe

| Field | Value |
|---|---|
| **CWE** | [CWE-754: Improper Check for Unusual or Exceptional Conditions](https://cwe.mitre.org/data/definitions/754.html) |
| **Files** | `scripts/add-crime-sources-to-cons.mjs:63-70` |
| **OWASP Top 10 2021** | A09:2021 Security Logging and Monitoring Failures |
| **OWASP LLM Top 10 2025** | N/A |
| **NIST SP 800-53 Rev. 5** | SI-11 Error Handling; AU-3 Content of Audit Records |
| **EU AI Act Art. 25** | N/A |
| **ISO/IEC 27001:2022** | A.8.16 Monitoring activities; A.8.26 Application security requirements |
| **SOC 2 TSC** | CC7.2 System Monitoring |
| **MITRE ATT&CK** | N/A (informational) |
| **MITRE ATLAS** | N/A |

### I-2026-04-24-01 — Health 503 on missing encryption key (positive control, carried)

| Field | Value |
|---|---|
| **CWE** | [CWE-311: Missing Encryption of Sensitive Data](https://cwe.mitre.org/data/definitions/311.html) — explicitly prevented |
| **Files** | `src/middleware/encryption.ts:37-42`; `src/routes/health.ts` |
| **OWASP Top 10 2021** | A02:2021 Cryptographic Failures (control in place) |
| **OWASP LLM Top 10 2025** | N/A |
| **NIST SP 800-53 Rev. 5** | SC-13 Cryptographic Protection; SC-28 Protection of Information at Rest |
| **EU AI Act Art. 25** | N/A |
| **ISO/IEC 27001:2022** | A.8.24 Use of cryptography |
| **SOC 2 TSC** | CC6.1 Logical Access; C1.1 Confidentiality Commitments |
| **MITRE ATT&CK** | T1552 Unsecured Credentials (prevention) |
| **MITRE ATLAS** | N/A |

### I-2026-04-24-02 — Swagger UI exposed in production (positive control, carried)

| Field | Value |
|---|---|
| **CWE** | [CWE-200: Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html) — intentional exposure |
| **Files** | `src/lib/swagger.ts` |
| **OWASP Top 10 2021** | A05:2021 Security Misconfiguration (accepted: API is designed to be consumable) |
| **OWASP LLM Top 10 2025** | N/A |
| **NIST SP 800-53 Rev. 5** | CM-7 Least Functionality (accepted risk) |
| **EU AI Act Art. 25** | N/A |
| **ISO/IEC 27001:2022** | A.8.9 Configuration management |
| **SOC 2 TSC** | CC6.6 Logical Access — External Users |
| **MITRE ATT&CK** | T1592 Gather Victim Host Information (passive) |
| **MITRE ATLAS** | N/A |

---

## Aggregate compliance matrix (frameworks × severity × count)

| Framework | CRITICAL | HIGH | MEDIUM | LOW | INFO | Total |
|---|---|---|---|---|---|---|
| OWASP Top 10 2021 | 0 | 0 | 0 | 3 | 2 | 5 |
| OWASP LLM Top 10 2025 | 0 | 0 | 0 | 0 | 0 | 0 |
| NIST SP 800-53 Rev. 5 | 0 | 0 | 0 | 3 | 2 | 5 |
| EU AI Act Art. 25 | 0 | 0 | 0 | 0 | 0 | 0 |
| ISO/IEC 27001:2022 | 0 | 0 | 0 | 3 | 2 | 5 |
| SOC 2 TSC 2017 | 0 | 0 | 0 | 3 | 2 | 5 |
| MITRE ATT&CK | 0 | 0 | 0 | 2 | 1 | 3 |
| MITRE ATLAS | 0 | 0 | 0 | 0 | 0 | 0 |

### Distinct CWEs in scope

| CWE | Title | Count |
|---|---|---|
| CWE-22 | Path Traversal | 1 (L-01) |
| CWE-532 | Sensitive Information in Log File | 1 (L-02) |
| CWE-754 | Improper Check for Unusual / Exceptional Conditions | 1 (L-03) |
| CWE-311 | Missing Encryption of Sensitive Data (prevention in place) | 1 (I-01) |
| CWE-200 | Exposure of Sensitive Information (accepted) | 1 (I-02) |

### Severity totals (from source audit)

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 3 |
| INFO | 2 |
| **Total** | **5** |

---

## Cross-walk notes

- **OWASP LLM Top 10 2025** and **MITRE ATLAS** both empty because this API does not host or call LLMs. The dashboard project (`retirement-dashboard-angular`) is the AI-adjacent surface; its audit handles any LLM/ATLAS mappings.
- **EU AI Act Art. 25** applies to high-risk AI system providers. This repository is a data/records API and does not fall under the Act; kept in the matrix for completeness per audit checklist.
- All three LOW findings involve **developer scripts** rather than the served API, which is why they map to "Change Management" / "Developer Testing" controls rather than runtime controls.

---

## Conclusion

The CWE surface covered by this audit is narrow (three distinct CWEs on script hygiene). No framework reports any HIGH/CRITICAL-severity finding. Compliance posture is unchanged from 2026-04-20.
