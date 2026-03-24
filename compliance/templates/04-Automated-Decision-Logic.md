# Automated Decision Logic Document

> **Laws served:** UK DUA Act ADM reforms; South Africa POPIA Sec 71; NYC Local Law 144; Colorado SB 24-205; Australia Privacy Act ADM; EU AI Act Art. 13-14; Canada Directive on ADM
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System / Decision Name | |
| Organization | |
| Document owner | |
| Session/GitHub ref | |
| Date created | [YYYY-MM-DD] |
| Author | [Human name or LLM model] |

---

## 1. Decision Overview

| Field | Details |
|-------|---------|
| Decision being made or assisted | [e.g., credit scoring, hiring screening, content recommendation, insurance pricing] |
| Decision category | [Consequential / Non-consequential] |
| Fully automated or human-assisted? | [Fully automated / AI-assisted with human review / AI recommendation only] |
| Who is affected by this decision? | [Consumers / Employees / Candidates / Patients / Students / Public] |
| Legal or similarly significant effects? | [Yes / No — if yes, South Africa POPIA Sec 71 and UK DUA Act apply] |
| Jurisdictions where decision is deployed | |

---

## 2. Decision Logic

### 2.1 Input Factors

| Factor / Feature | Data Type | Source | Weight / Importance | Why Included |
|-----------------|-----------|--------|:---:|-------------|
| | | | | |
| | | | | |
| | | | | |

### 2.2 Processing Steps

Describe the pipeline from input to decision output:

| Step | Description | Component |
|------|-------------|-----------|
| 1 | Data collection and validation | |
| 2 | Feature extraction / preprocessing | |
| 3 | Model inference | |
| 4 | Post-processing / business rules | |
| 5 | Output generation | |
| 6 | Human review (if applicable) | |

### 2.3 Decision Rules and Thresholds

| Rule / Threshold | Value | Effect |
|-----------------|-------|--------|
| Approval threshold | [e.g., score > 0.7] | [Approved] |
| Rejection threshold | [e.g., score < 0.3] | [Rejected] |
| Review band | [e.g., 0.3-0.7] | [Escalated to human reviewer] |
| Override rules | [Business rules that override model output] | |

### 2.4 Factors Explicitly Excluded

| Excluded Factor | Reason for Exclusion |
|----------------|---------------------|
| [e.g., Race, ethnicity] | Protected characteristic — legal prohibition |
| [e.g., Gender] | Protected characteristic |
| [e.g., ZIP code as proxy] | Proxy discrimination risk |

---

## 3. Explainability

### 3.1 Explanation Method

| Method | Used? | Description |
|--------|:---:|-------------|
| Feature importance (SHAP/LIME) | [ ] | |
| Rule-based explanation | [ ] | |
| Counterfactual explanation | [ ] | "You would have been approved if X were different" |
| Confidence score | [ ] | |
| Decision factors summary | [ ] | Plain-language summary of key factors |

### 3.2 User-Facing Explanation

> **Required by:** South Africa POPIA Sec 71 (logic disclosure); UK DUA Act; Colorado SB 24-205

| Aspect | Details |
|--------|---------|
| What is explained to the affected person | |
| How the explanation is delivered | [In-app / Email / Letter / On request] |
| Language/reading level | [Plain language, [X] grade reading level] |
| When explanation is provided | [With decision / Upon request / Automatically] |

---

## 4. Human Review and Override

> **Required by:** South Africa POPIA Sec 71; UK DUA Act; Colorado; Canada Directive on ADM

| Aspect | Details |
|--------|---------|
| Can a human review and override the decision? | [Yes / No] |
| Who performs the review? | [Role, qualifications] |
| How is review requested? | [User action / Automatic escalation / Periodic sampling] |
| Average review turnaround time | |
| Override authority | [Reviewer can fully override / Can only escalate / Limited adjustment] |
| Override logging | [All overrides recorded with rationale] |

---

## 5. Fairness and Non-Discrimination

| Assessment | Details |
|-----------|---------|
| Protected characteristics tested | [Race, gender, age, disability, religion, etc.] |
| Bias testing methodology | [See template 08-Bias-Testing] |
| Disparate impact ratio | [Per characteristic — threshold typically 80% / 4/5ths rule] |
| Last bias audit date | |
| Independent auditor (if NYC LL 144) | [Auditor name, date, public URL of results] |

---

## 6. Contestability

> **Required by:** UK Five Principles; South Korea AI Basic Act; Colorado SB 24-205

| Aspect | Details |
|--------|---------|
| Can the affected person contest the decision? | [Yes — describe process] |
| How to submit a contest/appeal | [Contact method, form, URL] |
| Timeline for response | [X business days] |
| Who reviews contested decisions? | [Human reviewer — role and authority] |
| Escalation path | |
| Records of contests retained for | [X years] |

---

## 7. Evidence Checklist

- [ ] Decision logic fully documented above
- [ ] Input factors and weights documented
- [ ] Excluded factors documented with justification
- [ ] User-facing explanation designed and implemented
- [ ] Human review mechanism in place and tested
- [ ] Contestability process in place and documented
- [ ] Bias testing completed and results recorded
- [ ] Independent audit completed (if NYC LL 144 applies)
- [ ] Decision logs being retained per applicable retention periods

---

## 8. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | | | Initial document |

---

*This template supports compliance evidence gathering. It is not legal advice.*
