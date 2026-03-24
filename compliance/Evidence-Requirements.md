# Evidence Requirements for AI/LLM Compliance

**Last Updated:** 2026-03-13
**Purpose:** Master list of evidence to gather during design, coding, and testing to support compliance across all tracked jurisdictions. Hand this to a legal or compliance expert to help prove compliance.

---

## How to Use This Document

1. Identify which jurisdictions your project operates in
2. Find the matching sections below
3. Gather the listed evidence during the appropriate project phase (design, coding, testing)
4. Package evidence with metadata per CLAUDE.md conventions (session number, date, author, applicable laws)

---

## Part 1: Universal Evidence (Required Across Nearly All Jurisdictions)

These evidence items are required or strongly expected in virtually every jurisdiction with AI regulation. Gather these regardless of where you operate.

### 1.1 AI System Risk Classification

| Evidence | Phase | Why |
|----------|-------|-----|
| Written risk classification of your AI system (prohibited / high-risk / limited / minimal) | Design | Required by EU, South Korea, Brazil, Peru, Colombia, Nigeria (proposed), Colorado; expected everywhere else |
| Justification document explaining why you assigned that classification | Design | Supports audit defense in any jurisdiction |

### 1.2 Transparency and Disclosure

| Evidence | Phase | Why |
|----------|-------|-----|
| User-facing disclosure that they are interacting with AI | Design, Coding | Required: EU, South Korea, China, Utah, UK (expected); voluntary everywhere else |
| AI-generated content labeling mechanism (visible labels) | Design, Coding | Required: EU, China, South Korea, California (SB 942); trending globally |
| Documentation of how/where disclosures appear in the product | Testing | Proves implementation to regulators |

### 1.3 Bias and Fairness

| Evidence | Phase | Why |
|----------|-------|-----|
| Bias testing methodology documentation | Design | Needed for EU, Colorado, California, NYC, Illinois, South Korea, Brazil, Australia, NZ |
| Bias test results across protected characteristics | Testing | Core evidence for anti-discrimination defense |
| Remediation plan for identified bias | Testing | Shows good faith compliance |

### 1.4 Human Oversight

| Evidence | Phase | Why |
|----------|-------|-----|
| Design documentation showing human override/intervention capability | Design | Required: EU (high-risk), South Korea, Brazil, Chile; expected broadly |
| Documentation of who performs oversight and their qualifications | Design | EU AI Act requires competent oversight personnel |
| Testing records proving override mechanisms work | Testing | Validates design claims |

### 1.5 Data Protection and Privacy

| Evidence | Phase | Why |
|----------|-------|-----|
| Privacy impact assessment / Data protection impact assessment (PIA/DPIA) | Design | Required: EU (GDPR), UK, Canada (PIPEDA), India (DPDPA), Brazil (LGPD), Nigeria (GAID), Australia, South Africa (POPIA), and 30+ others |
| Consent records for personal data collection and processing | Design, Coding | Required in every jurisdiction with data protection law |
| Purpose limitation documentation (what data is used for, and only that) | Design | Universal data protection requirement |
| Data subject rights implementation (access, correction, deletion) | Coding, Testing | Required everywhere with data protection law |
| Data retention and destruction policy | Design | Required broadly |

### 1.6 Training Data Documentation

| Evidence | Phase | Why |
|----------|-------|-----|
| Inventory of training data sources | Design, Coding | Required: EU (GPAI), California (AB 2013), China; recommended everywhere |
| Copyright and licensing status of training data | Design | Critical: EU, Australia (no TDM exemption), UK (pending), NZ (ambiguous) |
| Data quality and integrity assessment | Coding | EU AI Act, Brazil, general best practice |

### 1.7 Technical Documentation

| Evidence | Phase | Why |
|----------|-------|-----|
| System architecture documentation | Design | Required: EU, China, South Korea; expected for any regulated market |
| Model capabilities and known limitations | Design, Testing | Required: EU, Colorado, California; good practice everywhere |
| Testing methodology and validation results | Testing | Required: EU, South Korea, Brazil; expected everywhere |

### 1.8 Incident Management

| Evidence | Phase | Why |
|----------|-------|-----|
| Incident response plan for AI system failures | Design | Required: EU, California (SB 53), South Korea; expected broadly |
| Incident log template and retention policy | Coding | Required: EU, China (6+ month retention) |

---

## Part 2: Jurisdiction-Specific Evidence

### 2.1 European Union — EU AI Act

**Deadline:** Full applicability 2 Aug 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Risk classification per Annex III with justification | Design | Art. 6 — mandatory for all AI systems in EU |
| Conformity assessment report (high-risk systems) | Design, Testing | Art. 43 — before market placement |
| CE marking documentation | Pre-deployment | Required upon conformity assessment completion |
| EU database registration for high-risk systems | Pre-deployment | Art. 49 — before deployment |
| Risk management system documentation (ongoing, iterative) | Design, Testing | Art. 9 — continuous process |
| Data governance documentation | Design, Coding | Art. 10 — training, validation, testing datasets |
| Fundamental rights impact assessment (public sector deployers) | Design | Art. 27 — for high-risk public-sector use |
| AI literacy training records for staff | Design | Art. 4 — effective Feb 2025 already |
| Serious incident reports to market surveillance | Testing | Art. 62 — mandatory reporting |
| GPAI: Technical documentation per Commission template | Coding | Art. 53 — for GPAI model providers |
| GPAI: Public summary of training data content | Coding | Art. 53 — using Commission template |
| GPAI: Copyright compliance documentation | Coding | Art. 53 — proof of EU copyright compliance |
| GPAI (systemic risk): Model evaluation and adversarial test results | Testing | Art. 55 — for models >10²⁵ FLOPS |
| GPAI (systemic risk): Cybersecurity assessment | Coding, Testing | Art. 55 |
| GPAI (systemic risk): Energy consumption report | Testing | Art. 55 |
| Provider instructions for deployers | Design | Art. 13 — instructions of use |
| Deployer: Performance monitoring logs | Testing | Art. 26 — ongoing monitoring |

**Penalties:** Up to €35M or 7% global turnover

---

### 2.2 China

**Status:** Actively enforced now

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| CAC algorithm registration confirmation | Design, Coding | Administrative Provisions on Recommendation Algorithms — mandatory filing |
| LLM filing confirmation (if public opinion/social mobilization capability) | Design, Coding | Interim Measures for Generative AI Services — separate from algorithm filing |
| Security assessment report (completed before public launch) | Testing | Interim Measures — mandatory before offering public services |
| Content moderation policy and implementation documentation | Design, Coding | Interim Measures — lawful, truthful, not harmful to national security |
| Explicit content labels on all AI-generated text, audio, images, video | Design, Coding | Measures for Labeling AI-Generated Content (Sept 2025) |
| Implicit metadata labels (provider name, content attributes, content number) | Coding | Measures for Labeling AI-Generated Content |
| User complaint/reporting mechanism documentation | Design, Coding | Interim Measures — required complaint handling |
| 6+ month log retention of content moderation, complaints, label modifications | Coding | Interim Measures + Labeling Measures |
| Training data annotation security documentation | Coding, Testing | Data Annotation Security Specification (Nov 2025) |
| Pre-training/fine-tuning data security documentation | Coding, Testing | Pre-training and Fine-tuning Data Security Specification (Nov 2025) |
| GenAI operational security documentation | Coding, Testing | Basic Security Requirements for GenAI Services (Nov 2025) |
| AI ethics compliance policy | Design | Amended Cybersecurity Law (Jan 2026) |
| Risk monitoring procedures and logs | Testing | Amended Cybersecurity Law (Jan 2026) |
| Safety assessment documentation | Testing | Amended Cybersecurity Law (Jan 2026) |
| Livestream AI character labeling (if applicable) | Design, Coding | Livestreaming E-Commerce AI Rules (Feb 2026) |
| Patent specifications: model architecture, training process, key parameters | Design, Coding | Patent and IP Rules (Jan 2026) — if filing patents |
| Ethics review (if biological/medical AI R&D) | Design | Ethics Review Measures (Dec 2023, expanded Aug 2025) |

**Penalties:** Fines, business suspension, criminal liability, app/service takedowns

---

### 2.3 United States — State Laws

#### Colorado AI Act (SB 24-205) — Effective June 30, 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Documentation of reasonable care to prevent algorithmic discrimination | Design, Testing | Core obligation for developers |
| Technical documentation provided to deployers | Design, Coding | Developer must provide to deployers |
| Disclosed known system limitations | Design, Testing | Developer disclosure obligation |
| Impact assessments for consequential consumer decisions | Design, Testing | Deployer obligation |
| Consumer disclosure documentation | Design, Coding | Deployer obligation |
| Risk management plan | Design, Testing | Deployer obligation |

**Penalties:** Up to $20,000 per violation

#### California — Frontier AI (SB 53) — Effective Jan 1, 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Published risk framework | Design | Frontier developers (>10²⁶ FLOPS) |
| Safety incident reports | Testing | Mandatory reporting |
| Whistleblower protection policy | Design, Coding | Required for frontier and large developers (>$500M revenue) |

**Penalties:** Up to $1M per violation

#### California — Training Data Transparency (AB 2013) — Effective Jan 1, 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Training data source disclosure | Design, Coding | Generative AI providers |

#### California — AI Transparency Act (SB 942) — Effective Aug 2, 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Watermarking capability implementation | Design, Coding | GenAI content providers |
| Latent disclosure mechanism documentation | Design, Coding | GenAI content providers |
| AI-generated content detection tool availability | Design, Coding | GenAI content providers |

#### Illinois — HB 3773 + AI Video Interview Act

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Bias testing proving AI does not discriminate against protected classes | Design, Testing | Employers using AI in employment |
| Employer notice to candidates about AI video analysis | Design, Coding | AI Video Interview Act |
| Candidate consent records | Coding, Testing | AI Video Interview Act |
| Data retention/destruction policy and logs | Coding, Testing | AI Video Interview Act |

#### NYC Local Law 144 (Already in effect)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Annual bias audit by independent auditor | Testing | Automated employment decision systems |
| Public disclosure of audit results | Testing | Posted on employer website |

#### Texas RAIGA — Effective Jan 1, 2026

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| AI governance policy documentation | Design, Coding | AI system developers |
| Transparency provisions documentation | Design, Testing | AI system developers |

#### Utah

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Consumer disclosure of generative AI interaction | Design, Coding | GenAI deployers |

---

### 2.4 United Kingdom

**Status:** No AI Bill yet; DUA Act in force; sector regulators active

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| ADM system documentation (decision logic, impact assessment) | Design, Testing | DUA Act ADM reforms (Feb 2026) |
| Deepfake safeguard documentation (if image generation capable) | Design, Coding, Testing | DUA Act — criminal offence (Feb 2026) |
| Training data copyright and licensing audit | Design | DUA Act copyright provisions; March 2026 report pending |
| Safety, security, robustness assessment | Design, Testing | Five Core Principles (expected to become binding) |
| Transparency/explainability assessment | Design, Testing | Five Core Principles |
| Fairness audit and bias testing | Testing | Five Core Principles |
| Governance framework documentation | Design | Five Core Principles |
| Contestability/redress process documentation | Design | Five Core Principles |
| ICO ADM guidance compliance documentation | Design, Testing | ICO statutory code in development |
| Personal data handling records for AI training | Design, Testing | ICO — securing assurances from foundation model developers |
| Agentic AI oversight documentation (if autonomous systems) | Design, Coding, Testing | ICO monitoring agentic AI |
| Cybersecurity assessment (if relevant service provider) | Design, Coding, Testing | Cyber Security and Resilience Bill (expected 2026) |
| AISI evaluation reports (if frontier model) | Testing | AI Safety Institute — voluntary now, mandatory expected |

---

### 2.5 Canada

**Status:** AIDA dead; privacy reform coming; provincial laws advancing

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| PIPEDA consent and transparency documentation | Design, Testing | PIPEDA — current federal law |
| Algorithmic impact assessment (if federal government client) | Design, Testing | Directive on Automated Decision-Making (2019) |
| Human-in-the-loop documentation (if federal government client) | Design, Testing | Directive on ADM |
| Voluntary Code of Conduct alignment documentation (generative AI) | Design, Testing | Code of Conduct (2023) — accountability, safety, fairness, transparency, oversight, robustness |
| Ontario: AI hiring disclosure documentation | Design, Coding | Workers for Workers Four Act (2026) |
| Ontario: Bias testing for AI recruitment tools | Testing | Workers for Workers Four Act |
| Quebec: Automated profiling consent and transparency notices | Design, Testing | Law 25 |
| Alberta: Children's privacy safeguards (when amendments pass) | Design, Testing | PIPA amendments (expected 2026) |
| CAISI evaluation reports (if frontier model) | Testing | Canadian AI Safety Institute |

---

### 2.6 South Korea — AI Basic Act (Effective Jan 22, 2026)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| AI system risk classification (high-impact vs. other) | Design | AI Basic Act — risk-based framework |
| Fundamental rights impact assessment (high-impact AI) | Design, Testing | Comprehensive impact on rights |
| Human monitoring and intervention capability documentation | Design, Coding, Testing | Meaningful human oversight at all times |
| User disclosure notices (AI-generated content / AI decisions) | Design, Coding | Mandatory for high-impact AI |
| Risk register with all risks assessed, documented, and addressed | Design, Coding, Testing | Full documentation requirement |
| Local representative appointment (foreign companies) | Pre-deployment | Domestic agent for regulatory communications |
| Ongoing bias monitoring methodology and results | Testing | Discriminatory outcome monitoring |
| AI Safety Institute compliance documentation | Testing | Mandated by Act |
| Ethics committee documentation (charter, meeting records, reviews) | Design | Encouraged, may become required |
| PIPA: Consent and data collection scope documentation | Design, Testing | Personal Information Protection Act |

---

### 2.7 Japan

**Status:** Innovation-first; soft law; AI Promotion Act (May 2025)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Transparency measures documentation | Design | AI Promotion Act — cooperation duty |
| Risk mitigation strategy | Design, Testing | AI Promotion Act |
| AI Guidelines for Business alignment (risk, transparency, accountability, oversight) | Design, Testing | Voluntary but influential for enterprise clients |
| APPI personal data compliance | Design, Testing | Act on Protection of Personal Information |
| Product safety testing (if consumer-facing AI product) | Testing | Product liability laws |
| AI Safety Institute engagement records (if frontier model) | Testing | Japan AI Safety Institute |

---

### 2.8 India

**Status:** No AI law; DPDPA enforcing

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| DPDPA consent records and purpose limitation documentation | Design, Testing | Digital Personal Data Protection Act 2023 |
| Data localization documentation (if applicable data categories) | Design, Coding | DPDPA |
| Data subject rights implementation evidence | Coding, Testing | DPDPA |
| Section 79 intermediary safe harbor compliance (if platform) | Testing | IT Act 2000 |
| Content moderation documentation (if significant social media intermediary) | Testing | IT Rules 2021 |
| Sector-specific compliance: RBI/SEBI (finance), CDSCO (healthcare), TRAI (telecom) | Design, Testing | Sector regulators |

---

### 2.9 Singapore

**Status:** Voluntary frameworks + sector binding rules

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Model AI Governance Framework alignment documentation | Design, Testing | Voluntary but widely referenced |
| Generative AI governance documentation (foundation model risks, content provenance) | Design, Testing | GenAI Framework (2024) |
| AI Verify testing/certification results | Testing | Voluntary certification |
| PDPA compliance documentation | Design, Testing | Personal Data Protection Act |
| MAS FEAT Principles compliance (if financial services) | Design, Testing | Binding for finance |
| MAS Veritas Toolkit testing results (if financial services) | Testing | Binding for finance |

---

### 2.10 Australia

**Status:** No AI-specific law; existing laws + voluntary guidance

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Privacy Act ADM transparency documentation | Design, Testing | Privacy Act amendments — effective Dec 2026 |
| Australian Privacy Principles compliance | Design, Testing | Privacy Act 1988 |
| AI6 Guidance alignment documentation | Design, Testing | Guidance for AI Adoption (Oct 2025) — voluntary |
| Consumer law: no misleading AI-generated content | Testing | Australian Consumer Law |
| Copyright licensing for training data (no TDM exemption) | Design | Attorney-General ruling Oct 2025 |
| eSafety compliance (if AI interacts with children or generates images) | Testing | Online Safety Act |
| Sector-specific: TGA (health), APRA/ASIC (finance), Fair Work (employment) | Design, Testing | Sector regulators |

---

### 2.11 New Zealand

**Status:** Light-touch; voluntary guidance; Privacy Act 2020

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Privacy Act 2020 compliance (PIA, data handling, consent) | Design, Testing | Primary legal framework |
| OECD AI Principles alignment documentation | Design, Testing | Formally adopted June 2024 |
| Fair Trading Act: no misleading AI conduct | Testing | Consumer protection |
| Human Rights Act: bias prevention in employment/services | Testing | Discrimination laws |
| Māori data sovereignty considerations (if public sector) | Design, Testing | Treaty of Waitangi obligations |
| Responsible AI Guidance alignment | Design, Testing | Voluntary but demonstrates good practice |

---

### 2.12 Brazil

**Status:** PL 2338/2023 passed Senate; most advanced in Latin America

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Mandatory preliminary risk assessment (before market introduction) | Design, Testing | PL 2338/2023 |
| Risk classification documentation (prohibited / high-risk / general) | Design | PL 2338/2023 |
| Algorithmic impact evaluation with implementation methodology | Design, Testing | PL 2338/2023 |
| Transparency and explainability documentation | Design, Testing | PL 2338/2023 |
| AI safety assessment | Testing | PL 2338/2023 |
| LGPD compliance (consent, data handling, breach notification) | Design, Testing | LGPD — ANPD enforcement |

---

### 2.13 Peru — Law No. 31814 (Enacted)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Three-tier classification (prohibited / high-risk / low-risk) | Design | Law No. 31814 |
| Non-use verification for prohibited practices | Design, Testing | Manipulative, autonomous weapons, unauthorized surveillance, predictive policing |
| Impact evaluations | Design, Testing | Required |
| Transparency documentation | Design, Testing | Required |
| Public registry registration | Design | Required |

---

### 2.14 Mexico (Expected 2026)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| LFPDPPP personal data compliance | Design, Testing | Federal data protection law — applies now |
| Risk-based classification (upon law passage) | Design | Federal AI Law proposal |
| CONAIA authorization documentation (upon law passage) | Design, Testing | Proposed oversight body |

---

### 2.15 Africa

#### Nigeria (Digital Economy Bill targeted March 2026)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| NDPA Section 37: human review for automated decisions | Design, Testing | Nigeria Data Protection Act 2023 — in force |
| DPIA documentation | Design, Testing | GAID (effective Sept 2025) |
| Privacy by design implementation evidence | Design, Coding | GAID |
| Risk-based AI classification (upon bill passage) | Design, Testing | Digital Economy Bill |
| Algorithmic transparency documentation (upon bill passage) | Design, Testing | Digital Economy Bill |
| 30% local content for AI research on Nigerian data (upon bill passage) | Design, Coding | Digital Sovereignty Bill |

#### South Africa

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| POPIA Section 71: no automated profiling with legal consequences | Design, Testing | POPIA — in force |
| Disclosure of automated decision logic | Design, Testing | POPIA Section 71 |
| Financial sector explainability documentation (if finance) | Design, Testing | FSCA joint AI report (Nov 2025) |

#### Kenya

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Automated decision-making protections | Design, Testing | Data Protection Act 2019 |

#### Ethiopia

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| EAII certification for imported AI technologies | Testing | Ethiopian AI Institute |
| Right to challenge AI-only decisions (credit, hiring, insurance) | Design, Testing | PDPP No. 1321/2024 |

#### Other African Countries

| Country | Evidence | Law |
|---------|----------|-----|
| Ghana | Right to object to automated decisions | DPA 2012 Sec 41 |
| Botswana | Right to object to automated decisions | DPA 2024 |
| Mauritius | AI advisory licensing compliance (if financial services) | FSC rules (2021) |
| Algeria | DPIAs, 5-day breach notification, mandatory DPO | DPA amendments (July 2025) |

---

### 2.16 Vietnam — Digital Technology Industry Law (Phased from March 2026)

| Evidence | Phase | Specific Requirement |
|----------|-------|---------------------|
| Risk-based classification documentation | Design | First ASEAN AI law |
| Regulatory compliance documentation (details emerging) | Design, Testing | Phased rollout over four years |

---

## Part 3: Evidence by Project Phase

### Design Phase Checklist

- [ ] AI system risk classification document
- [ ] Privacy impact assessment / DPIA
- [ ] Human oversight design documentation
- [ ] Transparency/disclosure design (where AI appears to users)
- [ ] Training data inventory and copyright audit
- [ ] System architecture documentation
- [ ] Risk management plan
- [ ] Data governance documentation
- [ ] Incident response plan
- [ ] Consent mechanism design
- [ ] Local representative appointment (South Korea, if applicable)
- [ ] Jurisdiction-specific registrations planned

### Coding Phase Checklist

- [ ] Disclosure mechanisms implemented (AI interaction, content labeling)
- [ ] Content labeling — explicit (visible) and implicit (metadata) where required
- [ ] Human override/intervention mechanisms coded
- [ ] Consent collection and data subject rights implemented
- [ ] Complaint/reporting mechanism implemented
- [ ] Log retention infrastructure (6+ months for China)
- [ ] Watermarking/detection tools (California SB 942, EU)
- [ ] Privacy by design implementation
- [ ] Data security controls for training data

### Testing Phase Checklist

- [ ] Bias testing across protected characteristics — results documented
- [ ] Conformity assessment completed (EU high-risk)
- [ ] Security assessment completed (China, UK, general)
- [ ] Human oversight mechanisms validated
- [ ] Disclosure/transparency features verified
- [ ] Content labeling verified (explicit + implicit)
- [ ] Performance monitoring baseline established
- [ ] Incident response plan tested
- [ ] Adversarial testing completed (EU GPAI systemic risk)
- [ ] Sector-specific testing (healthcare, finance, employment)

---

## Part 4: Key Compliance Deadlines

| Date | Jurisdiction | Event |
|------|-------------|-------|
| **Already in force** | China | GenAI measures, algorithm filing, content labeling, security standards |
| **Already in force** | EU | Prohibited practices + AI literacy (Feb 2025); GPAI obligations (Aug 2025) |
| **Jan 1, 2026** | US (CA, TX, IL) | Multiple state AI laws effective |
| **Jan 22, 2026** | South Korea | AI Basic Act effective |
| **Feb 5-6, 2026** | UK | DUA Act ADM reforms + deepfake offence |
| **Mar 2026** | Nigeria | Digital Economy Bill targeted for passage |
| **Jun 30, 2026** | US (CO) | Colorado AI Act effective |
| **Aug 2, 2026** | EU | **Full applicability** — high-risk, transparency, conformity |
| **Aug 2, 2026** | US (CA) | AI Transparency Act (SB 942) |
| **Nov 1, 2026** | Egypt | PDPL full enforcement |
| **Dec 2026** | Australia | Privacy Act ADM transparency obligations |
| **Aug 2, 2027** | EU | High-risk AI in regulated products |

---

*This document is compliance research, not legal advice. Consult qualified legal counsel for jurisdiction-specific compliance decisions.*
