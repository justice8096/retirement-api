# System Transparency Document

> **Laws served:** EU AI Act Arts. 11-14, 50; Colorado SB 24-205; UK DUA Act; South Korea AI Basic Act; Brazil PL 2338/2023; Peru Law No. 31814
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | |
| Version / Release | |
| Organization | |
| Document owner | [Name, role] |
| Session/GitHub ref | |
| Date created | [YYYY-MM-DD] |
| Author | [Human name or LLM model] |
| Classification | [Prohibited / High-risk / Limited risk / Minimal risk] |

---

## 1. System Purpose and Scope

| Field | Details |
|-------|---------|
| What the system does | [Plain-language description] |
| Intended use cases | |
| Intended users | [Internal staff / Business customers / Consumers / Public sector] |
| Target jurisdictions | |
| Sector(s) | [Healthcare / Finance / Employment / Education / Law enforcement / General] |
| Deployment environment | [Cloud / On-premise / Edge / Hybrid] |

---

## 2. How the System Works

### 2.1 Architecture Overview

| Component | Description |
|-----------|-------------|
| Model type | [LLM / Classification / Regression / Generative / Multi-modal / Other] |
| Foundation model (if any) | [Model name, provider, version] |
| Fine-tuning approach | [None / SFT / RLHF / DPO / Other] |
| Input types | [Text / Image / Audio / Video / Structured data] |
| Output types | [Text / Image / Audio / Decisions / Scores / Recommendations] |
| Integration points | [APIs, databases, third-party services] |

### 2.2 Decision-Making Logic

| Aspect | Description |
|--------|-------------|
| How outputs are generated | [Describe the pipeline from input to output] |
| Key factors influencing outputs | [Features, weights, rules, thresholds] |
| Confidence scoring (if any) | [How confidence is calculated and used] |
| Fallback behavior | [What happens when confidence is low or system fails] |

### 2.3 Data Used

| Data Category | Description | Source | Retention |
|--------------|-------------|--------|-----------|
| Training data | | | |
| Fine-tuning data | | | |
| Runtime input data | | | |
| User interaction data | | | |
| Feedback/evaluation data | | | |

---

## 3. Known Limitations

> **Required by:** Colorado SB 24-205 (developer must disclose); EU AI Act Art. 13

| Limitation | Description | Mitigation |
|-----------|-------------|------------|
| Accuracy boundaries | [Where accuracy degrades — e.g., edge cases, languages, demographics] | |
| Bias risks | [Known bias patterns or demographic performance gaps] | |
| Hallucination / confabulation | [If generative: tendency to produce false information] | |
| Adversarial vulnerability | [Known attack vectors] | |
| Data currency | [Training data cutoff date; how stale data affects outputs] | |
| Out-of-distribution behavior | [How system behaves with unexpected inputs] | |
| Environmental dependencies | [Performance dependencies on infrastructure, latency, etc.] | |

---

## 4. Performance Metrics

| Metric | Value | Measurement Method | Date Measured |
|--------|-------|--------------------|---------------|
| Accuracy | | | |
| Precision | | | |
| Recall | | | |
| F1 Score | | | |
| Fairness metrics (per demographic) | | | |
| Latency (p50 / p95 / p99) | | | |
| Error rate | | | |

---

## 5. Risk Classification Justification

| Criterion | Assessment |
|-----------|-----------|
| Assigned risk level | [Prohibited / High-risk / Limited / Minimal] |
| Framework used | [EU AI Act Annex III / Colorado consequential decisions / South Korea high-impact categories / Other] |
| Justification | [Why this classification was assigned] |
| Reviewer | [Name, role, date] |

---

## 6. Human Oversight Summary

| Aspect | Details |
|--------|---------|
| Oversight model | [Human-in-the-loop / Human-on-the-loop / Human-in-command] |
| Override capability | [How a human can intervene, override, or shut down the system] |
| Oversight personnel qualifications | [Required training, role, authority level] |
| Monitoring frequency | [Real-time / Daily / Weekly / Per-decision] |

---

## 7. Transparency Disclosures

| Disclosure | Implemented? | Location | Screenshot/Link |
|-----------|-------------|----------|-----------------|
| User notification of AI interaction | [ ] Yes [ ] No | | |
| AI-generated content labeling | [ ] Yes [ ] No | | |
| Explanation of decision factors | [ ] Yes [ ] No | | |
| Opt-out / human alternative | [ ] Yes [ ] No | | |
| Complaint / appeal mechanism | [ ] Yes [ ] No | | |

---

## 8. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | | | Initial document |

---

*This template supports compliance evidence gathering. It is not legal advice.*
