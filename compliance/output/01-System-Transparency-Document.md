# System Transparency Document

> **Laws served:** EU AI Act Arts. 11-14, 50; Colorado SB 24-205; UK DUA Act; South Korea AI Basic Act; Brazil PL 2338/2023; Peru Law No. 31814
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | Retirement Planning SaaS Platform |
| Version / Release | 0.1.0 |
| Organization | Retirement Planning SaaS |
| Document owner | Justin, Project Owner |
| Session/GitHub ref | RP-2026-001 |
| Date created | 2026-03-21 |
| Author | Auto-filled by compliance tooling (review and add human author) |
| Classification | limited |

---

## 1. System Purpose and Scope

| Field | Details |
|-------|---------|
| What the system does | Multi-user commercial SaaS for retirement cost comparison, financial projections, and Monte Carlo portfolio simulation. Uses Claude AI agents for automated cost data research, location data updates, and data refinement. Dashboard provides personalized retirement planning with tax calculations, Social Security modeling, and RMD projections. |
| Intended use cases | |
| Intended users | consumers |
| Target jurisdictions | European Union, United States — California, United States — Colorado, United States — Texas, United States — New York City, United States — Illinois, United States — Utah, Brazil, Mexico, Peru |
| Sector(s) | finance, consumer-services |
| Deployment environment | Docker Compose production stack — self-hosted with Tailscale TLS (nginx reverse proxy + Fastify API + PostgreSQL + Redis). Public access via Tailscale Funnel with auto TLS termination. |

---

## 2. How the System Works

### 2.1 Architecture Overview

| Component | Description |
|-----------|-------------|
| Model type | LLM |
| Foundation model (if any) | Claude (Opus/Sonnet), Anthropic |
| Fine-tuning approach | [None / SFT / RLHF / DPO / Other] |
| Input types | text, structured-data, financial-data |
| Output types | financial-projections, cost-estimates, recommendations, text, structured-data |
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
| Assigned risk level | limited |
| Framework used | [EU AI Act Annex III / Colorado consequential decisions / South Korea high-impact categories / Other] |
| Justification | [Why this classification was assigned] |
| Reviewer | [Name, role, date] |

---

## 6. Human Oversight Summary

| Aspect | Details |
|--------|---------|
| Oversight model |  |
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
