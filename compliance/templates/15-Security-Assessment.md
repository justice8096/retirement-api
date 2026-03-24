# Security Assessment

> **Laws served:** China Amended Cybersecurity Law + National Security Standards; UK Cyber Security and Resilience Bill; EU AI Act Art. 55 (GPAI systemic risk); South Korea AI Basic Act; China GenAI Basic Security Requirements
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | |
| Organization | |
| Document owner | |
| Session/GitHub ref | |
| Date created | [YYYY-MM-DD] |
| Author | [Human name or LLM model] |
| Assessor(s) | |
| Next review date | |

---

## 1. Security Scope

| Field | Details |
|-------|---------|
| System components assessed | [Model / API / Infrastructure / Data pipeline / Frontend] |
| Deployment environment | [Cloud provider / On-premise / Hybrid] |
| Data classification | [Public / Internal / Confidential / Restricted] |
| Jurisdictions with security requirements | |

---

## 2. Threat Assessment

| Threat Category | Specific Threats | Likelihood | Impact | Controls |
|----------------|-----------------|-----------|--------|----------|
| **Model attacks** | Adversarial inputs, prompt injection, jailbreaking | | | |
| **Data attacks** | Training data poisoning, data extraction, membership inference | | | |
| **Infrastructure** | Unauthorized access, DDoS, supply chain compromise | | | |
| **Output manipulation** | Content manipulation, deepfake generation misuse | | | |
| **Privacy attacks** | Model memorization extraction, PII leakage | | | |
| **Social engineering** | Credential theft, insider threat | | | |

---

## 3. Security Controls

### 3.1 Model Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Input validation and sanitization | [ ] | |
| Prompt injection defenses | [ ] | |
| Output filtering | [ ] | |
| Rate limiting | [ ] | |
| Model access controls (API keys, auth) | [ ] | |
| Adversarial robustness testing | [ ] | [Method, frequency] |
| Model versioning and integrity checks | [ ] | |

### 3.2 Data Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Training data encryption at rest | [ ] | |
| Data encryption in transit | [ ] | |
| Access controls on training data | [ ] | |
| Data integrity verification | [ ] | |
| Anonymization / pseudonymization | [ ] | |
| Secure data deletion | [ ] | |
| Data backup and recovery | [ ] | |

### 3.3 Infrastructure Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Network segmentation | [ ] | |
| Firewall / WAF | [ ] | |
| Intrusion detection / prevention | [ ] | |
| Container / runtime security | [ ] | |
| Secrets management | [ ] | |
| Patch management | [ ] | |
| Logging and monitoring | [ ] | |

### 3.4 Operational Security

| Control | Implemented? | Details |
|---------|:---:|---------|
| Incident response plan | [ ] | [See template 13] |
| Security training for staff | [ ] | |
| Vulnerability disclosure program | [ ] | |
| Penetration testing | [ ] | [Frequency, last test date] |
| Third-party security assessment | [ ] | |
| Business continuity plan | [ ] | |

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

- [ ] Threat assessment completed
- [ ] Model security controls implemented and documented
- [ ] Data security controls implemented and documented
- [ ] Infrastructure security controls verified
- [ ] China security specifications met (if applicable)
- [ ] EU GPAI systemic risk cybersecurity assessed (if applicable)
- [ ] Vulnerability assessment completed
- [ ] Penetration testing completed
- [ ] Incident response plan tested
- [ ] Next review date scheduled

---

*This template supports compliance evidence gathering. It is not legal advice.*
