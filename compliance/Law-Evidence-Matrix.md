# Law-to-Evidence Matrix

**Last Updated:** 2026-03-13
**Purpose:** Cross-reference every tracked law to the evidence types it requires. Use this to see at a glance which evidence satisfies which laws.

---

## Evidence Type Key

| Code | Evidence Type |
|------|--------------|
| **RC** | Risk Classification — written risk tier assignment with justification |
| **CA** | Conformity Assessment — formal assessment against regulatory standard |
| **RM** | Risk Management Plan — ongoing risk identification, mitigation, monitoring |
| **IA** | Impact Assessment — rights, safety, or algorithmic impact evaluation |
| **TD** | Technical Documentation — system architecture, model specs, design docs |
| **TD-DATA** | Training Data Documentation — data sources, quality, provenance inventory |
| **TD-CR** | Training Data Copyright — licensing and copyright status of training data |
| **TRANS** | Transparency / Explainability — documentation of how system makes decisions |
| **DISC** | Disclosure to Users — user-facing notice of AI interaction or AI-generated content |
| **LABEL** | Content Labeling — visible and/or metadata labels on AI-generated content |
| **LABEL-WM** | Watermarking / Detection — watermarks or detection tools for AI content |
| **LABEL-META** | Implicit Metadata Labels — embedded provider/content metadata |
| **HO** | Human Oversight — design docs, override mechanisms, qualified personnel records |
| **BIAS** | Bias Testing — methodology, test results, remediation plans |
| **BIAS-AUDIT** | Independent Bias Audit — third-party audit with public disclosure |
| **PIA** | Privacy Impact Assessment / DPIA |
| **CONSENT** | Consent Records — documented consent for data collection and processing |
| **DSR** | Data Subject Rights — implementation of access, correction, deletion |
| **DRP** | Data Retention Policy — retention periods, destruction procedures |
| **DL** | Data Localization — proof of data storage location compliance |
| **GOV** | Governance Framework — organizational AI governance structure |
| **LIT** | AI Literacy — staff training records and competency documentation |
| **INC** | Incident Management — response plan, logs, reporting to authorities |
| **REG** | Registration / Filing — algorithm registration, database entry, public registry |
| **MOD** | Content Moderation — policies, implementation, logs |
| **COMP** | Complaint Mechanism — user complaint/reporting system documentation |
| **LOG** | Log Retention — audit logs retained for mandated period |
| **SEC** | Security Assessment — cybersecurity, operational security documentation |
| **SAFE** | Safety Evaluation — pre-deployment safety testing (AI Safety Institute or equivalent) |
| **CE** | CE Marking — conformity marking documentation |
| **LR** | Local Representative — domestic agent appointment for foreign companies |
| **ETH** | Ethics Review / Committee — ethics review records or committee documentation |
| **WB** | Whistleblower Protections — policy and implementation |
| **PROD** | Product Safety — consumer product liability and safety testing |
| **SECT** | Sector-Specific Compliance — finance, healthcare, employment, telecom requirements |
| **LC** | Local Content — local data or content requirements |
| **ENERGY** | Energy Reporting — compute/energy consumption documentation |

---

## Matrix: Laws × Evidence Types

### European Union

| Law | Status | RC | CA | RM | IA | TD | TD-DATA | TD-CR | TRANS | DISC | LABEL | HO | BIAS | PIA | CONSENT | DSR | GOV | LIT | INC | REG | SEC | SAFE | CE | ENERGY |
|-----|--------|----|----|----|----|----|---------|----|-------|------|-------|----|------|-----|---------|-----|-----|-----|-----|-----|-----|------|----|----|
| EU AI Act — Prohibited practices | In force | ✅ | | | | ✅ | | | | | | | | | | | | | | | | | | |
| EU AI Act — High-risk systems | Aug 2026 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ | ✅ | ✅ | ✅ | | | | ✅ | ✅ | ✅ | ✅ | | | ✅ | |
| EU AI Act — Limited risk (Art. 50) | Aug 2026 | | | | | | | | | ✅ | ✅ | | | | | | | | | | | | | |
| EU AI Act — AI Literacy (Art. 4) | In force | | | | | | | | | | | | | | | | | ✅ | | | | | | |
| EU AI Act — GPAI baseline (Art. 53) | In force | | | | | ✅ | ✅ | ✅ | | | | | | | | | | | | | | | | |
| EU AI Act — GPAI systemic risk (Art. 55) | In force | | | | | ✅ | ✅ | ✅ | | | | | | | | | | | ✅ | | ✅ | ✅ | | ✅ |
| EU GDPR | In force | | | | | | | | | | | | | ✅ | ✅ | ✅ | | | | | | | | |

### China

| Law | Status | RC | RM | TD | TD-DATA | TRANS | DISC | LABEL | LABEL-META | HO | BIAS | PIA | CONSENT | GOV | INC | REG | MOD | COMP | LOG | SEC | ETH | PROD |
|-----|--------|----|----|----|---------|----|------|-------|----|----|----|-----|---------|-----|-----|-----|-----|------|-----|-----|-----|------|
| Admin Provisions — Recommendation Algorithms | In force | | | ✅ | | ✅ | | | | | | | | | | ✅ | | | | | | |
| Admin Provisions — Deep Synthesis | In force | | | | | | | ✅ | | | | | | | | ✅ | | | | ✅ | | |
| Interim Measures — Generative AI Services | In force | | | | | | | ✅ | | | | | | | | ✅ | ✅ | ✅ | ✅ | ✅ | | |
| Measures for Labeling AI-Generated Content | In force | | | | | | | ✅ | ✅ | | | | | | | | | | ✅ | | | |
| National Security Standards (3 specs) | In force | | | | ✅ | | | | | | | | | | | | | | | ✅ | | |
| Amended Cybersecurity Law | In force | | ✅ | | | | | | | | | | | | | | | | | ✅ | ✅ | |
| Livestreaming E-Commerce AI Rules | In force | | | | | | ✅ | ✅ | | | | | | | | | | | | | | |
| Patent and IP Rules | In force | | | ✅ | | | | | | | | | | | | | | | | | | |
| Ethics Review Measures | In force | | | | | | | | | | | | | | | | | | | | ✅ | |

### United States — State Laws

| Law | Status | RC | RM | IA | TD | TD-DATA | TD-CR | TRANS | DISC | LABEL | LABEL-WM | HO | BIAS | BIAS-AUDIT | PIA | CONSENT | DRP | GOV | INC | WB | SECT |
|-----|--------|----|----|----|----|---------|-------|-------|------|-------|------|----|------|------|-----|---------|-----|-----|-----|----|----|
| Colorado AI Act (SB 24-205) | Jun 2026 | ✅ | ✅ | ✅ | ✅ | | | | ✅ | | | | ✅ | | | | | | | | |
| CA Frontier AI (SB 53) | In force | | | | | | | | | | | | | | | | | | ✅ | ✅ | |
| CA Training Data (AB 2013) | In force | | | | | ✅ | | | | | | | | | | | | | | | |
| CA AI Transparency (SB 942) | Aug 2026 | | | | | | | | ✅ | ✅ | ✅ | | | | | | | | | | |
| CA Common Pricing Algorithm ban | In force | | | | ✅ | | | | | | | | | | | | | | | | |
| CA Civil Rights AI Employment | In force | | | | | | | | | | | | ✅ | | | | | | | | |
| CA Deepfake disclosure laws | Various | | | | | | | | | ✅ | | | | | | | | | | | |
| IL HB 3773 (AI Employment) | In force | | | | | | | | | | | | ✅ | | | | | | | | ✅ |
| IL AI Video Interview Act | In force | | | | | | | | ✅ | | | | | | | ✅ | ✅ | | | | |
| NYC Local Law 144 | In force | | | | | | | | ✅ | | | | | ✅ | | | | | | | ✅ |
| TX RAIGA | In force | | | | | | | ✅ | | | | | | | | | | ✅ | | | |
| UT GenAI Disclosure | In force | | | | | | | | ✅ | | | | | | | | | | | | |

### United Kingdom

| Law | Status | RM | IA | TD | TD-CR | TRANS | DISC | HO | BIAS | PIA | CONSENT | DSR | GOV | INC | SEC | SAFE | SECT |
|-----|--------|----|----|----|----|-------|------|----|----|-----|---------|-----|-----|-----|-----|------|----|
| DUA Act — ADM reforms | In force | | ✅ | ✅ | | ✅ | | | | | | | | | | | |
| DUA Act — Deepfake offence | In force | | | | | | | | | | | | | | ✅ | | |
| DUA Act — Copyright provisions | Pending | | | | ✅ | | | | | | | | | | | | |
| Five Core Principles (becoming binding) | Voluntary | ✅ | | | | ✅ | | ✅ | ✅ | | | | ✅ | | ✅ | | |
| ICO ADM statutory code | In development | | ✅ | ✅ | | ✅ | | | | ✅ | ✅ | | | | | | |
| Cyber Security and Resilience Bill | Expected 2026 | | | | | | | | | | | | | ✅ | ✅ | | |
| AI Safety Institute evaluations | Voluntary→mandatory | | | ✅ | | | | | | | | | | | | ✅ | |
| UK GDPR (via DUA Act) | In force | | | | | | | | | ✅ | ✅ | ✅ | | | | | |

### Canada

| Law | Status | IA | TD | TRANS | DISC | HO | BIAS | PIA | CONSENT | DSR | GOV | SAFE | SECT | DRP |
|-----|--------|----|----|-------|------|----|------|-----|---------|-----|-----|------|----|-----|
| PIPEDA | In force | | | ✅ | | | | ✅ | ✅ | ✅ | | | | |
| Directive on ADM (federal gov) | In force | ✅ | | ✅ | | ✅ | | | | | | | | |
| Voluntary Code of Conduct (GenAI) | Voluntary | | | ✅ | | ✅ | ✅ | | | | ✅ | ✅ | | |
| Ontario Bill 194 (public sector) | In force | | ✅ | ✅ | | | | | | | | | | |
| Ontario Workers for Workers Four | 2026 | | | | ✅ | | ✅ | | | | | | ✅ | |
| Quebec Law 25 | In force | | | ✅ | | | | | ✅ | | | | | |
| Alberta PIPA amendments | Expected 2026 | | | | | | | | | | | | ✅ | ✅ |
| CAISI evaluations | Active | | ✅ | | | | | | | | | ✅ | | |

### South Korea

| Law | Status | RC | RM | IA | TD | TRANS | DISC | HO | BIAS | PIA | CONSENT | DSR | GOV | REG | ETH | SAFE | LR | SECT |
|-----|--------|----|----|----|----|-------|------|----|------|-----|---------|-----|-----|-----|-----|------|----|------|
| AI Basic Act — all systems | In force | ✅ | | | ✅ | | | | | | | | | | | | | |
| AI Basic Act — high-impact AI | In force | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | | | | | ✅ | ✅ | | |
| AI Basic Act — foreign companies | In force | | | | | | | | | | | | | | | | ✅ | |
| PIPA | In force | | | | | | | | | ✅ | ✅ | ✅ | | | | | | |
| Credit Information Act | In force | | | | | ✅ | ✅ | | ✅ | | | | | | | | | ✅ |
| Product Liability Act | In force | | | | | | | | | | | | | | | | | ✅ |

### Japan

| Law | Status | RM | TD | TRANS | HO | BIAS | PIA | CONSENT | GOV | SAFE | PROD | SECT |
|-----|--------|----|----|-------|----|------|-----|---------|-----|------|----|------|
| AI Promotion Act | In force | ✅ | | ✅ | | | | | | | | |
| AI Guidelines for Business | Voluntary | ✅ | | ✅ | ✅ | | | | ✅ | | | |
| APPI | In force | | | | | | ✅ | ✅ | | | | |
| Product liability laws | In force | | | | | | | | | | ✅ | |
| AI Safety Institute | Voluntary | | ✅ | | | | | | | ✅ | | |
| Sector-specific regulations | In force | | | | | | | | | | | ✅ |

### India

| Law | Status | TD | TRANS | DISC | BIAS | PIA | CONSENT | DSR | DL | MOD | SECT |
|-----|--------|----|----|------|------|-----|---------|-----|----|-----|------|
| DPDPA 2023 | Enforcing | | | | | ✅ | ✅ | ✅ | ✅ | | |
| IT Act 2000 / IT Rules 2021 | In force | | | | | | | | | ✅ | |
| Consumer Protection Act 2019 | In force | | ✅ | ✅ | | | | | | | |
| Sector regulators (RBI, SEBI, CDSCO, TRAI) | In force | | | | | | | | | | ✅ |

### Singapore

| Law | Status | TD | TRANS | HO | BIAS | PIA | CONSENT | DSR | GOV | SAFE | SECT |
|-----|--------|----|----|------|----|------|-----|---------|-----|------|----|
| Model AI Governance Framework | Voluntary | | ✅ | ✅ | ✅ | | | | ✅ | | |
| GenAI Governance Framework (2024) | Voluntary | ✅ | ✅ | | | | | | | | |
| AI Verify | Voluntary | | | | | | | | | ✅ | |
| PDPA | In force | | | | | ✅ | ✅ | ✅ | | | |
| MAS FEAT / Veritas (finance) | Binding | | ✅ | | ✅ | | | | | ✅ | ✅ |

### Australia

| Law | Status | TD | TRANS | DISC | HO | BIAS | PIA | CONSENT | DSR | DRP | TD-CR | GOV | SECT | SEC |
|-----|--------|----|----|------|----|----|-----|---------|-----|-----|----|-----|------|----|
| Privacy Act 1988 (+ Dec 2026 ADM) | In force / Dec 2026 | | ✅ | | | | ✅ | ✅ | ✅ | ✅ | | | | |
| AI6 Guidance for AI Adoption | Voluntary | | ✅ | | ✅ | ✅ | | | | | | ✅ | | |
| Australian Consumer Law | In force | | | ✅ | | | | | | | | | | |
| Copyright (no TDM exemption) | In force | | | | | | | | | | ✅ | | | |
| Online Safety Act | In force | | | | | | | | | | | | ✅ | |
| Sector regulators (TGA, APRA, ASIC, Fair Work) | In force | | | | | | | | | | | | ✅ | |

### New Zealand

| Law | Status | TRANS | DISC | BIAS | PIA | CONSENT | DSR | TD-CR | GOV | SECT |
|-----|--------|-------|------|------|-----|---------|-----|-------|-----|------|
| Privacy Act 2020 | In force | | | | ✅ | ✅ | ✅ | | | |
| OECD AI Principles (adopted) | Voluntary | ✅ | | | | | | | ✅ | |
| Fair Trading Act 1986 | In force | | ✅ | | | | | | | |
| Human Rights Act 1993 | In force | | | ✅ | | | | | | |
| Copyright Act 1994 | In force | | | | | | | ✅ | | |
| Responsible AI Guidance | Voluntary | ✅ | ✅ | ✅ | | | | | ✅ | |

### Brazil

| Law | Status | RC | RM | IA | TD | TRANS | BIAS | PIA | CONSENT | DSR | GOV | SAFE | SECT |
|-----|--------|----|----|----|----|-------|------|-----|---------|-----|-----|------|----|
| PL 2338/2023 (AI Bill) | Senate passed | ✅ | ✅ | ✅ | ✅ | ✅ | | | | | ✅ | ✅ | |
| LGPD | In force | | | | | | | ✅ | ✅ | ✅ | | | |
| Sector regulators (judiciary, finance, health, telecom) | In force | | | | | | | | | | | | ✅ |

### Peru

| Law | Status | RC | IA | TD | TRANS | DISC | BIAS | REG | ETH |
|-----|--------|----|----|----|----|------|------|-----|-----|
| Law No. 31814 | In force | ✅ | ✅ | ✅ | ✅ | | | ✅ | ✅ |

### Mexico

| Law | Status | RC | TD | TRANS | DISC | PIA | CONSENT | DSR | SECT |
|-----|--------|----|----|-------|------|-----|---------|-----|----|
| LFPDPPP (data protection) | In force | | | | | ✅ | ✅ | ✅ | |
| Federal AI Law (proposed) | Expected 2026 | ✅ | ✅ | ✅ | | | | | |
| Consumer Protection Law | In force | | | | ✅ | | | | |

### Colombia

| Law | Status | RC | IA | TD | TRANS | BIAS | PIA | CONSENT | GOV | REG | ETH |
|-----|--------|----|----|----|----|------|-----|---------|-----|-----|-----|
| Bill 059/2023 + AI bills | Senate approved | ✅ | | ✅ | ✅ | | | | ✅ | ✅ | ✅ |
| Data protection law | In force | | | | | | ✅ | ✅ | | | |

### Chile

| Law | Status | RC | IA | TD | TRANS | HO | BIAS | GOV |
|-----|--------|----|----|----|----|----|----|-----|
| AI Regulatory Bill | Advanced stage | ✅ | | ✅ | ✅ | ✅ | | ✅ |

### Argentina

| Law | Status | HO | BIAS | PIA | CONSENT | DSR | SECT |
|-----|--------|----|------|-----|---------|-----|----|
| Data protection law | In force | ✅ | | ✅ | ✅ | ✅ | |
| Proposed AI bills | Pending | | ✅ | | | | |
| Financial sector framework | In force | | | | | | ✅ |

### Nigeria

| Law | Status | RC | IA | TD | TRANS | HO | BIAS | PIA | CONSENT | DSR | GOV | REG | MOD | LC |
|-----|--------|----|----|----|----|----|----|-----|---------|-----|-----|-----|-----|-----|
| NDPA 2023 (Sec 37) | In force | | | | | ✅ | | | | | | | | |
| GAID | In force | | | | | | | ✅ | | | | | | |
| Digital Economy Bill | Target Mar 2026 | ✅ | | ✅ | ✅ | | | | | | | ✅ | | |
| Digital Sovereignty Bill | Proposed | | | | | | | | | | | | | ✅ |

### South Africa

| Law | Status | TRANS | HO | BIAS | PIA | CONSENT | DSR | SECT |
|-----|--------|-------|----|----|-----|---------|-----|----|
| POPIA (Sec 71) | In force | ✅ | ✅ | | ✅ | ✅ | ✅ | |
| FSCA AI report (finance) | Guidance | ✅ | | | | | | ✅ |
| Draft AI Policy Framework | Expected 2026/27 | | | | | | | |

### Kenya

| Law | Status | HO | BIAS | PIA | CONSENT | DSR |
|-----|--------|----|------|-----|---------|-----|
| Data Protection Act 2019 | In force | ✅ | | ✅ | ✅ | ✅ |

### Ethiopia

| Law | Status | HO | PIA | CONSENT | DSR | SAFE |
|-----|--------|----|-----|---------|-----|------|
| PDPP No. 1321/2024 | In force | ✅ | ✅ | ✅ | ✅ | |
| Ethiopian AI Institute | Active | | | | | ✅ |

### Vietnam

| Law | Status | RC | TD | TRANS |
|-----|--------|----|----|-------|
| Digital Technology Industry Law | Mar 2026 | ✅ | ✅ | ✅ |

### Other African Countries

| Law | Country | Status | HO | PIA | CONSENT | DSR | DRP | SECT |
|-----|---------|--------|----|-----|---------|-----|-----|----|
| DPA 2012 Sec 41 | Ghana | In force | ✅ | | | | | |
| DPA 2024 | Botswana | In force | ✅ | ✅ | ✅ | ✅ | | |
| FSC AI Advisory rules | Mauritius | In force | | | | | | ✅ |
| DPA amendments (July 2025) | Algeria | In force | | ✅ | | | ✅ | |

---

## Summary: Evidence Types Most Frequently Required

| Evidence Type | # of Laws Requiring It | Highest-Enforcement Jurisdictions |
|--------------|----------------------|--------------------------------|
| **PIA / DPIA** | 20+ | EU, UK, India, Brazil, Nigeria, South Africa, Australia |
| **Transparency / Explainability** | 18+ | EU, China, South Korea, UK, Brazil, Colorado |
| **Consent Records** | 16+ | EU, UK, India, Brazil, South Africa, Canada, Mexico |
| **Data Subject Rights** | 14+ | EU, UK, India, Brazil, South Africa, Canada, Australia |
| **Bias Testing** | 12+ | EU, South Korea, Colorado, NYC, Illinois, California, Australia |
| **Risk Classification** | 11+ | EU, South Korea, Brazil, Peru, Colorado, Vietnam |
| **Human Oversight** | 11+ | EU, South Korea, Chile, Canada (fed gov), South Africa, Nigeria, Kenya |
| **Technical Documentation** | 11+ | EU, China, South Korea, Colorado, Brazil, Peru, Vietnam |
| **Disclosure to Users** | 10+ | EU, South Korea, China, Utah, California, Colorado, NYC, Illinois |
| **Content Labeling** | 8+ | EU, China, South Korea, California (SB 942) |
| **Incident Management** | 6+ | EU, China, California (SB 53), South Korea |
| **Registration / Filing** | 6+ | EU, China, Peru, Colombia, Nigeria (proposed) |
| **Governance Framework** | 6+ | EU, South Korea, Brazil, Chile, Colombia, Singapore, UK |
| **Security Assessment** | 6+ | China, UK, EU (GPAI systemic), South Korea |
| **Sector-Specific** | 10+ | All major jurisdictions (finance, healthcare, employment) |

---

*This document is compliance research, not legal advice. Consult qualified legal counsel for jurisdiction-specific compliance decisions.*
