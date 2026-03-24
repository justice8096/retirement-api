# AI/LLM Supply Chain Risk Assessment

> **Laws served:** EU AI Act Art. 25 (value chain responsibilities), Art. 55 (GPAI cybersecurity); NIST AI RMF (GOVERN/MAP/MANAGE); NIST SP 800-218A (SSDF AI Profile); OWASP Top 10 for LLM 2025 (LLM03 Supply Chain, LLM04 Data Poisoning); MITRE ATLAS AML.T0010; UK NCSC AI Security Guidelines; CISA AI Deployment Guidance; ISO/IEC 42001 A.10; China TC260-003; South Korea AI Basic Act
> **Template version:** 1.0 | **Last updated:** 2026-03-15

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | Retirement Planning SaaS Platform |
| Organization | Retirement Planning SaaS |
| Document owner | Justin, Project Owner |
| Session/GitHub ref | RP-2026-001 |
| Date created | 2026-03-21 |
| Author | Auto-filled by compliance tooling (review and add human author) |
| Assessor(s) | |
| Next review date | |

---

## 1. AI Component Inventory

| Component | Type | Provider | Version | Country of Origin | License | Risk Tier |
|-----------|------|----------|---------|-------------------|---------|-----------|
| [Foundation model] | Model | | | | | [Critical/High/Medium/Low] |
| [Fine-tuned model] | Model | | | | | |
| [ML framework] | Software | | | | | |
| [Inference runtime] | Software | | | | | |
| [Training data] | Data | | | | | |
| [Vector DB / RAG source] | Data | | | | | |
| [Evaluation dataset] | Data | | | | | |

---

## 2. Model Supply Chain Risk (MITRE ATLAS AML.T0010)

### 2.1 Model Provenance

| Check | Status | Evidence |
|-------|--------|---------|
| Model source verified (official repo/registry) | [ ] | |
| Model hash/checksum validated | [ ] | |
| Model card reviewed | [ ] | |
| License compatibility confirmed | [ ] | |
| Provider identity verified (not typosquatted repo) | [ ] | |
| Model signed by provider (if available) | [ ] | |
| SBOM/AIBOM available | [ ] | |

### 2.2 Model Integrity Threats

| Threat | Applicable? | Likelihood | Impact | Controls |
|--------|:-----------:|-----------|--------|----------|
| **AML.T0010.003 Model Compromise** - Backdoors in pretrained model weights | | | | |
| **Hugging Face org confusion** - Downloading from impersonator repo (ATLAS CS0028) | | | | |
| **Malicious model files** - Pickle/safetensors with embedded code (ATLAS CS0030) | | | | |
| **LoRA/adapter poisoning** - Fine-tune adapters introducing backdoors | | | | |
| **Model substitution** - Swapped model weights in deployment pipeline | | | | |
| **Quantization artifacts** - Behavioral changes from GGUF/GPTQ conversion | | | | |

---

## 3. Code Generation Supply Chain Risk

> Applies when using AI tools (Copilot, Cursor, Claude Code, Codeium, etc.) to generate source code

### 3.1 Vulnerable Code Patterns (OWASP LLM03, OpenSSF)

| Risk | Applicable? | Likelihood | Impact | Controls |
|------|:-----------:|-----------|--------|----------|
| **Insecure code suggestions** - AI reproducing known CVE patterns from training data | | | | |
| **Missing input validation** - Generated code lacking sanitization (SQLi, XSS, command injection) | | | | |
| **Weak cryptography** - AI suggesting deprecated algorithms (MD5, SHA1, DES) | | | | |
| **Hardcoded secrets** - AI including placeholder credentials that reach production | | | | |
| **Insecure defaults** - HTTP instead of HTTPS, permissive CORS, debug modes | | | | |
| **Incomplete error handling** - Swallowed exceptions, information leakage in errors | | | | |

**Statistics (OpenSSF 2025):** 45% of AI-assisted development tasks introduce critical security flaws; 62% of AI-generated code contains known vulnerabilities; 78% contains at least one exploitable vulnerability that traditional scanning misses.

### 3.2 Dependency Hallucination / Slopsquatting (OWASP LLM03, ENISA 2025)

| Risk | Applicable? | Likelihood | Impact | Controls |
|------|:-----------:|-----------|--------|----------|
| **Package hallucination** - AI suggesting nonexistent packages (~20% rate) | | | | |
| **Slopsquatting** - Attacker registers hallucinated package names with malware | | | | |
| **Version hallucination** - AI suggesting nonexistent versions of real packages | | | | |
| **Dependency confusion** - AI mixing public/private package names | | | | |

### 3.3 License Contamination (NIST AI 600-1 Risk #10)

| Risk | Applicable? | Likelihood | Impact | Controls |
|------|:-----------:|-----------|--------|----------|
| **Copyleft injection** - AI reproducing GPL/AGPL code into permissive-licensed project | | | | |
| **Copyright reproduction** - AI outputting verbatim copyrighted code | | | | |
| **Attribution gaps** - AI-generated code lacking required license notices | | | | |
| **Patent exposure** - AI suggesting patented algorithms without disclosure | | | | |

### 3.4 CI/CD Pipeline Risks (ENISA 2025, GitHub/Pillar Security)

| Risk | Applicable? | Likelihood | Impact | Controls |
|------|:-----------:|-----------|--------|----------|
| **Rules File Backdoor** - Poisoned config files injecting malicious instructions into coding assistant | | | | |
| **AI agent tool misuse** - Coding agent executing unauthorized commands (CVE-2025-53773) | | | | |
| **Prompt injection via issues/PRs** - Malicious content in GitHub Issues hijacking AI code review | | | | |
| **Wormable infections** - AI-generated code that propagates across forked repositories | | | | |
| **Secret exfiltration** - AI tool leaking GITHUB_TOKEN or other credentials | | | | |

---

## 4. Training Data Supply Chain Risk (NIST SP 800-218A PW.3, CISA 2025)

### 4.1 Data Provenance

| Check | Status | Evidence |
|-------|--------|---------|
| Training data sources documented | [ ] | |
| Data provenance chain verified | [ ] | |
| Data licenses reviewed and compatible | [ ] | |
| PII scan completed on training data | [ ] | |
| Copyright/IP scan completed | [ ] | |
| Data quality assessment performed | [ ] | |

### 4.2 Data Poisoning Threats

| Threat | Applicable? | Likelihood | Impact | Controls |
|--------|:-----------:|-----------|--------|----------|
| **AML.T0010.001 Data Compromise** - Poisoned open-source datasets | | | | |
| **Split-view poisoning** (CISA) - Via expired domain purchases in curated datasets | | | | |
| **Frontrunning poisoning** (CISA) - Injection before crowd-sourced collection | | | | |
| **RAG data poisoning** - Malicious content in retrieval-augmented generation sources | | | | |
| **Fine-tuning data poisoning** - Compromised instruction-tuning datasets | | | | |
| **Embedding poisoning** - Manipulated vector embeddings for retrieval manipulation | | | | |

---

## 5. Infrastructure Supply Chain Risk (MITRE ATLAS)

| Threat | Applicable? | Likelihood | Impact | Controls |
|--------|:-----------:|-----------|--------|----------|
| **AML.T0010.000 Hardware Compromise** - GPU/TPU firmware vulnerabilities | | | | |
| **AML.T0010.002 Software Compromise** - ML framework/library supply chain attacks | | | | |
| **AML.T0010.004 Container Registry Compromise** - Malicious inference containers | | | | |
| **CloudBorne** - Firmware vulnerabilities in shared cloud GPU instances | | | | |
| **CloudJacking** - Unauthorized cloud infrastructure access | | | | |
| **PyPI/npm malicious packages** - Backdoored ML libraries (ENISA 2025) | | | | |

---

## 6. Third-Party Provider Assessment (ISO/IEC 42001 A.10, EU AI Act Art. 25)

### 6.1 Provider Due Diligence

| Criterion | Assessment | Score (1-5) |
|-----------|-----------|:-----------:|
| Provider transparency (model cards, documentation) | | |
| Training data disclosure level | | |
| Safety testing evidence | | |
| Bias evaluation and disclosure | | |
| Incident response capability | | |
| Data handling and privacy practices | | |
| Regulatory compliance posture | | |
| Financial stability / continuity risk | | |
| Exit strategy / data portability | | |

### 6.2 Contractual Requirements (EU AI Act Art. 25(4))

| Requirement | In Contract? | Details |
|-------------|:---:|---------|
| Written agreement with AI component supplier | [ ] | |
| Technical access and documentation provisions | [ ] | |
| IP and trade secret protections (Art. 25(6)) | [ ] | |
| Audit rights | [ ] | |
| Incident notification obligations | [ ] | |
| Data handling and deletion terms | [ ] | |
| Liability allocation | [ ] | |
| Model update notification and approval | [ ] | |
| Subcontractor (4th party) AI use restrictions | [ ] | |

### 6.3 Ongoing Monitoring (ISO/IEC 42001 A.10.3)

| Monitoring Area | Frequency | Method | Owner |
|----------------|-----------|--------|-------|
| Model performance drift | | | |
| Provider compliance status | | | |
| Security advisory tracking | | | |
| License/terms changes | | | |
| Emergent bias detection | | | |

---

## 7. Cross-Jurisdiction Supply Chain Flags

| Flag | Applicable? | Action Required |
|------|:-----------:|-----------------|
| **Chinese-origin model deployed in EU** - Extra GPAI documentation required; assess content filtering alignment with EU values | | |
| **Chinese-origin model deployed in US** - Monitor for any export control or sanctions developments | | |
| **Any model deployed in China** - CAC filing required; GenAI security standards (TC260-003) apply | | |
| **API provider in different jurisdiction** - GDPR DPA required if EU personal data processed; data transfer impact assessment | | |
| **Model trained on EU personal data** - GDPR lawful basis required regardless of provider location | | |
| **South Korea deployment** - Local representative required for foreign AI operators (AI Basic Act) | | |
| **Open-source model modified** - You become "provider" under EU AI Act Art. 25(1) if substantially modified | | |

---

## 8. Code Generation Security Controls

> Required when AI tools are used in the software development lifecycle

### 8.1 Pre-Generation Controls

| Control | Implemented? | Details |
|---------|:---:|---------|
| AI coding tool vetted and approved | [ ] | |
| Tool configuration hardened (no YOLO mode, etc.) | [ ] | |
| Rules files / system prompts reviewed for injection | [ ] | |
| Approved package allowlist maintained | [ ] | |
| AI instructed to prefer safe defaults (OpenSSF) | [ ] | |

### 8.2 Post-Generation Controls

| Control | Implemented? | Details |
|---------|:---:|---------|
| SAST scan on all AI-generated code (CodeQL, Semgrep, Bandit) | [ ] | |
| Dependency verification - all packages exist and are legitimate | [ ] | |
| License scan (FOSSA, Snyk, etc.) on AI-generated code | [ ] | |
| Human review of all AI-generated code before merge | [ ] | |
| Security-focused unit tests including negative tests (OpenSSF) | [ ] | |
| Secret scanning (GitGuardian, etc.) | [ ] | |

### 8.3 SLSA Compliance for AI-Assisted Development

| SLSA Level | Met? | Evidence |
|-----------|:---:|---------|
| L1 - Build process documented | [ ] | |
| L2 - Hosted build service with signed provenance | [ ] | |
| L3 - Tamper-proof build with non-falsifiable provenance | [ ] | |
| AI-generated code tracked in VCS with attribution | [ ] | |

---

## 9. Bill of Materials

### 9.1 AI Bill of Materials (AIBOM)

> Conforming to SPDX, CycloneDX, or SWID format per CISA guidance

| Component | Type | Version | Source | Hash | License |
|-----------|------|---------|--------|------|---------|
| | [Model/Data/Framework/Library] | | | | |

### 9.2 Software Bill of Materials (SBOM)

| Generated? | Format | Location | Last Updated |
|:---:|--------|----------|:---:|
| [ ] | [SPDX / CycloneDX / SWID] | | |

---

## 10. Risk Summary and Mitigation Plan

| Risk ID | Risk Description | Framework Reference | Severity | Likelihood | Current Controls | Residual Risk | Mitigation Plan | Owner | Due Date |
|---------|-----------------|---------------------|----------|-----------|-----------------|---------------|-----------------|-------|----------|
| SC-001 | | | [Critical/High/Med/Low] | | | [Accept/Mitigate/Transfer/Avoid] | | | |

---

## 11. Evidence Checklist

- [ ] AI component inventory completed
- [ ] Model provenance verified (hashes, source repos, signatures)
- [ ] Code generation risks assessed and controls implemented
- [ ] Dependency hallucination controls in place
- [ ] License contamination scan performed
- [ ] CI/CD pipeline hardened against AI-specific attacks
- [ ] Training data provenance documented (NIST SP 800-218A PW.3)
- [ ] Data poisoning risks assessed
- [ ] Infrastructure supply chain reviewed
- [ ] Third-party provider due diligence completed (ISO 42001 A.10)
- [ ] Contractual requirements in place (EU AI Act Art. 25(4))
- [ ] Cross-jurisdiction flags reviewed
- [ ] AIBOM/SBOM generated (CISA guidance)
- [ ] SLSA compliance assessed
- [ ] Risk mitigation plan documented
- [ ] Next review date scheduled

---

## Framework Reference Matrix

| Framework | Type | Enforcement | Key Sections |
|-----------|------|-------------|-------------|
| NIST AI RMF (AI 100-1) | Voluntary | US guidance | GOVERN, MAP, MANAGE functions |
| NIST SP 800-218A | Voluntary (federal procurement ref) | US guidance | PW.3 (training data integrity) |
| NIST AI 600-1 | Voluntary | US guidance | Risk #12 (Value Chain), Risk #10 (IP) |
| OWASP LLM Top 10 2025 | Voluntary | Industry standard | LLM03 (Supply Chain), LLM04 (Poisoning) |
| MITRE ATLAS | Voluntary | Threat intelligence | AML.T0010 (ML Supply Chain Compromise) |
| EU AI Act Art. 25 | Mandatory | EU regulation | Value chain responsibilities, fines to 7% revenue |
| UK NCSC Guidelines | Voluntary (ETSI standard) | UK guidance | Secure Development, Supply Chain Security |
| CISA AI Guidance | Federal agencies | US guidance | SBOM/AIBOM, data poisoning types |
| ISO/IEC 42001 | Voluntary (certifiable) | International standard | A.10 (Third-Party Relationships) |
| China TC260-003 | Recommended standard | China | Supply chain security assessment |
| South Korea AI Basic Act | Mandatory (eff. 2026-01-22) | Korean law | Developer/utilizer operator split |
| ENISA 2025 | Informational | EU threat intel | Rules File Backdoor, Slopsquatting |
| OpenSSF AI Guide | Voluntary | Industry | Code assistant security instructions |
| SLSA | Voluntary | Industry | Build provenance for AI artifacts |

---

*This template supports compliance evidence gathering. It is not legal advice.*
