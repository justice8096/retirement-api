# Content Moderation Policy

> **Laws served:** China GenAI Interim Measures; China Amended Cybersecurity Law; India IT Act 2000 / IT Rules 2021; EU Digital Services Act (intersection)
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

---

## 1. Moderation Scope

| Field | Details |
|-------|---------|
| Content types moderated | [Text / Images / Audio / Video / Code] |
| Moderation applied to | [AI inputs / AI outputs / User-generated content / All] |
| Jurisdictions | |

---

## 2. Prohibited Content Categories

| Category | Definition | Detection Method | Action |
|----------|-----------|-----------------|--------|
| Content endangering national security | Per China GenAI measures | [Automated filter / Human review] | Block + log |
| Content inciting subversion of state power | Per China GenAI measures | | Block + log |
| Content undermining national unity | Per China GenAI measures | | Block + log |
| Terrorism / extremism | Per China + India IT Rules | | Block + log + report |
| Ethnic hatred / discrimination | Per China + India + EU | | Block + log |
| Violence and graphic content | Per China + India + EU | | Block + log |
| False / misleading information | Per China GenAI measures | | Block + flag |
| Obscenity / pornography | Per China + India IT Rules | | Block + log |
| Content harmful to minors | Per China + India + EU | | Block + log |
| Illegal activities | All jurisdictions | | Block + log |
| Personal data / privacy violations | All jurisdictions | | Block + log |
| Intellectual property infringement | All jurisdictions | | Block + flag |

---

## 3. Moderation Pipeline

| Stage | Method | Description | Coverage |
|-------|--------|-------------|---------|
| Pre-generation filter | [Automated] | Input screening before AI processing | 100% of inputs |
| Generation guardrails | [Automated] | Model-level safety constraints | 100% of outputs |
| Post-generation filter | [Automated] | Output screening before delivery | 100% of outputs |
| Human review queue | [Human] | Review of flagged content | Flagged items |
| User-reported content | [Human] | Review of user complaints | All reports |
| Periodic audit | [Human] | Random sample review | [X% / frequency] |

---

## 4. Complaint and Reporting Mechanism

> **Required by:** China GenAI Interim Measures (mandatory complaint handling)

| Aspect | Details |
|--------|---------|
| How users submit complaints | [In-app button / Email / Form / Hotline] |
| Complaint acknowledgment time | [Within X hours] |
| Resolution time | [Within X business days] |
| Escalation path | [Level 1 → Level 2 → Legal] |
| Complaint categories | [Inaccurate output / Harmful content / Privacy / Bias / Other] |
| User notification of outcome | [Method, timeline] |

---

## 5. Log Retention

> **China requirement:** 6+ months for content moderation logs, complaint records, label modifications

| Log Type | Retention Period | Storage | Access Control |
|----------|-----------------|---------|---------------|
| Moderation decisions | [6+ months minimum] | | |
| Complaint records | [6+ months minimum] | | |
| Label modification logs | [6+ months minimum] | | |
| Human review records | [6+ months minimum] | | |
| Appeals and outcomes | [6+ months minimum] | | |

---

## 6. India-Specific Requirements

### Significant Social Media Intermediary Obligations (IT Rules 2021)

| Requirement | Status | Details |
|------------|--------|---------|
| Chief Compliance Officer appointed | [ ] | [Name] |
| Nodal Contact Person appointed | [ ] | [Name] |
| Resident Grievance Officer appointed | [ ] | [Name] |
| Monthly compliance report published | [ ] | [URL] |
| Content takedown within 36 hours (court order) | [ ] | |
| Section 79 safe harbor compliance | [ ] | |

---

## 7. Moderation Team

| Role | Count | Training | Tools |
|------|:---:|---------|-------|
| Content moderators | | [Training program, frequency] | |
| Moderation supervisors | | | |
| Policy specialists | | | |
| Moderator wellbeing support | | [Counseling, rotation, exposure limits] | |

---

## 8. Evidence Checklist

- [ ] Prohibited content categories defined per jurisdiction
- [ ] Moderation pipeline implemented (pre/post-generation + human review)
- [ ] Complaint mechanism operational
- [ ] Log retention meets 6+ month minimum (China)
- [ ] India intermediary obligations met (if applicable)
- [ ] Moderation team trained and supported
- [ ] Periodic moderation audits scheduled
- [ ] Moderation effectiveness metrics tracked

---

*This template supports compliance evidence gathering. It is not legal advice.*
