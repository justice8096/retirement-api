# Human Oversight Design Document

> **Laws served:** EU AI Act Art. 14; South Korea AI Basic Act; Chile AI Regulatory Bill; Canada Directive on ADM; South Africa POPIA Sec 71; Nigeria NDPA Sec 37; Kenya DPA 2019; Ghana DPA Sec 41; Botswana DPA 2024; Ethiopia PDPP 1321/2024; Argentina data protection law
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

## 1. Oversight Model

| Field | Details |
|-------|---------|
| Oversight type | [ ] Human-in-the-loop (human approves every decision) |
| | [ ] Human-on-the-loop (human monitors and can intervene) |
| | [ ] Human-in-command (human sets parameters, reviews outcomes) |
| Justification for chosen model | |
| Risk level of AI system | [High-risk / Limited / Minimal] |

---

## 2. Oversight Personnel

| Role | Name(s) | Qualifications | Authority Level | Training Completed |
|------|---------|---------------|----------------|:---:|
| Primary oversight operator | | | [Full override / Escalation only] | [ ] |
| Backup operator | | | | [ ] |
| Escalation authority | | | [Can shut down system] | [ ] |
| Governance sponsor | | | [Accountable executive] | [ ] |

### Competency Requirements

> **Required by:** EU AI Act Art. 14 — oversight personnel must be competent

| Competency | Required? | Training Method | Certification |
|-----------|:---:|----------------|:---:|
| Understanding of system capabilities and limitations | [ ] | | [ ] |
| Understanding of automation bias risks | [ ] | | [ ] |
| Ability to correctly interpret system outputs | [ ] | | [ ] |
| Authority and ability to override/disregard system | [ ] | | [ ] |
| Knowledge of when and how to intervene | [ ] | | [ ] |
| Familiarity with applicable legal requirements | [ ] | | [ ] |

---

## 3. Override Mechanisms

### 3.1 Override Capabilities

| Mechanism | Implemented? | How It Works | Access Control |
|-----------|:---:|-------------|---------------|
| Reject individual AI decision | [ ] | | [Who can trigger] |
| Modify AI output before delivery | [ ] | | |
| Pause system operation | [ ] | | |
| Emergency system shutdown | [ ] | | |
| Revert to manual/human-only process | [ ] | | |
| Adjust model parameters/thresholds | [ ] | | |
| Block specific input types | [ ] | | |

### 3.2 Override Workflow

| Step | Action | System Behavior | Logging |
|------|--------|----------------|---------|
| 1 | Operator identifies issue | | [ ] Logged |
| 2 | Operator initiates override | System pauses / flags decision | [ ] Logged |
| 3 | Override action taken | [Decision reversed / Modified / Escalated] | [ ] Logged |
| 4 | Outcome documented | Rationale recorded | [ ] Logged |
| 5 | Root cause assessed | [One-time / Systemic?] | [ ] Logged |

---

## 4. Monitoring Design

| Monitoring Aspect | Method | Frequency | Alert Threshold |
|------------------|--------|-----------|----------------|
| Decision accuracy spot-checks | [Random sampling of X%] | [Real-time / Daily / Weekly] | |
| Bias drift detection | [Statistical monitoring] | | |
| Error rate tracking | [Dashboard / Automated alerts] | | |
| User complaint monitoring | [Complaint queue / NPS] | | |
| Override rate tracking | [If too high → model issue; if zero → rubber-stamping risk] | | |
| Performance degradation | [Latency, throughput, quality metrics] | | |

### Automation Bias Prevention

> **EU AI Act recital requirement:** Prevent operators from over-relying on AI

| Measure | Implemented? | Description |
|---------|:---:|-------------|
| Confidence scores displayed to operator | [ ] | |
| Low-confidence decisions flagged for mandatory review | [ ] | |
| Periodic forced manual decisions (to maintain skill) | [ ] | |
| Training on automation bias risks | [ ] | |
| Rotation of oversight duties | [ ] | |
| Disagreement tracking (human vs. AI) | [ ] | |

---

## 5. Intervention Triggers

| Trigger | Response | Responsible | Escalation |
|---------|----------|-------------|------------|
| Model confidence below threshold | Mandatory human review | Operator | |
| Bias metric drift alert | Pause + investigate | Operator → Data science | Governance |
| User complaint about AI decision | Manual review of decision | Operator | |
| Incident / safety event | Emergency shutdown protocol | Operator → Escalation authority | Executive |
| Regulatory inquiry | Preserve logs, notify legal | Governance sponsor | Legal |
| Scheduled periodic review | Full system audit | Oversight team | |

---

## 6. Testing Evidence

| Test | Date | Result | Tester |
|------|------|--------|--------|
| Override mechanism functions correctly | | [Pass / Fail] | |
| Emergency shutdown completes within [X seconds] | | [Pass / Fail] | |
| Operator can correctly interpret system outputs | | [Pass / Fail] | |
| Alert thresholds trigger notifications | | [Pass / Fail] | |
| Fallback to manual process works end-to-end | | [Pass / Fail] | |
| Override logs are created and retained | | [Pass / Fail] | |

---

## 7. Override and Intervention Log

| Date | Operator | Trigger | Action Taken | Rationale | Outcome | Follow-Up |
|------|----------|---------|-------------|-----------|---------|-----------|
| | | | | | | |

---

## 8. Evidence Checklist

- [ ] Oversight model selected and justified
- [ ] Oversight personnel identified with qualifications documented
- [ ] Competency training completed and recorded (see template 18)
- [ ] Override mechanisms implemented and tested
- [ ] Monitoring dashboards and alerts configured
- [ ] Automation bias prevention measures in place
- [ ] Intervention triggers defined
- [ ] Emergency shutdown procedure tested
- [ ] Override/intervention log system operational
- [ ] Fallback to human-only process tested

---

*This template supports compliance evidence gathering. It is not legal advice.*
