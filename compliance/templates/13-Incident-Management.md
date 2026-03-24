# Incident Management Plan

> **Laws served:** EU AI Act Art. 62 (serious incident reporting); China GenAI Interim Measures (log retention); California SB 53 (safety incident reporting); South Korea AI Basic Act; UK Cyber Security and Resilience Bill
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

## 1. Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|:---:|
| **Critical** | Serious harm to individuals; regulatory reporting required | Death, serious injury, fundamental rights violation, large-scale data breach | Immediate |
| **High** | Significant impact on individuals or operations | Discriminatory outcomes at scale, major accuracy failure, safety boundary breach | < 4 hours |
| **Medium** | Moderate impact, contained | Bias detected in monitoring, isolated incorrect decisions, partial system failure | < 24 hours |
| **Low** | Minor impact, easily remediated | Performance degradation, minor output quality issues | < 72 hours |

---

## 2. Incident Response Workflow

| Phase | Actions | Responsible | Timeline |
|-------|---------|-------------|---------|
| **1. Detection** | Automated alert / User report / Monitoring discovery | Operations / Any staff | Immediate |
| **2. Triage** | Classify severity, assign incident lead | Incident lead | < 1 hour |
| **3. Containment** | Stop harm — pause system / isolate / override | Operations + Technical | Per severity |
| **4. Investigation** | Root cause analysis, impact assessment | Technical lead | < 48 hours |
| **5. Remediation** | Fix root cause, validate fix | Engineering | Per complexity |
| **6. Notification** | Notify affected parties, regulators (if required) | Legal + Governance | Per jurisdiction |
| **7. Recovery** | Restore normal operations, monitor for recurrence | Operations | Post-fix |
| **8. Post-Incident Review** | Lessons learned, process improvements | Governance Board | < 2 weeks |

---

## 3. Regulatory Reporting Requirements

| Jurisdiction | Law | What Must Be Reported | To Whom | Deadline |
|-------------|-----|----------------------|---------|---------|
| **EU** | AI Act Art. 62 | Serious incidents: death, serious harm, fundamental rights violation, widespread harm | Market surveillance authority | Without undue delay, max 15 days |
| **EU** | GDPR Art. 33 | Personal data breaches | Supervisory authority | 72 hours |
| **California** | SB 53 | Safety incidents involving frontier AI | Attorney General | As specified in risk framework |
| **South Korea** | AI Basic Act | Incidents involving high-impact AI | AI Committee / MSIT | As specified |
| **China** | GenAI Interim Measures | Content safety incidents, complaints | CAC | Promptly |
| **UK** | Cyber Security Bill | Cyber incidents affecting relevant services | Designated authority | TBD (expected 2026) |
| **Nigeria** | NDPA | Data breaches | NDPC | Within 72 hours |
| **Algeria** | DPA amendments | Data breaches | Authority | Within 5 days |

---

## 4. Log Retention Requirements

| Jurisdiction | Minimum Retention | What Must Be Retained |
|-------------|------------------|----------------------|
| **China** | 6 months | Content moderation logs, complaint records, label modification logs |
| **EU** | Duration of AI system lifecycle + 10 years (high-risk) | Automatic logging of system operations (Art. 12) |
| **General best practice** | 3-5 years | All incident records, investigation reports, remediation actions |

---

## 5. Incident Report Template

### For each incident, complete:

| Field | Value |
|-------|-------|
| Incident ID | [Auto-generated] |
| Date/time detected | |
| Date/time occurred (if different) | |
| Detected by | [Automated monitoring / User report / Staff / Third party] |
| Severity | [Critical / High / Medium / Low] |
| AI system involved | |
| Description | |
| Impact | [Who affected, how many, what harm] |
| Root cause | |
| Containment actions taken | |
| Remediation actions taken | |
| Regulatory reports filed | [Jurisdiction, authority, date, reference] |
| Affected parties notified | [Who, when, how] |
| Post-incident review date | |
| Lessons learned | |
| Process improvements | |
| Incident closed date | |
| Closed by | |

---

## 6. Communication Plan

| Audience | When | Method | Content | Responsible |
|----------|------|--------|---------|-------------|
| Internal: Incident team | Immediately | [Slack / Page / Email] | Full technical details | Incident lead |
| Internal: Executive team | Critical/High only | [Direct contact] | Summary + impact + actions | Governance lead |
| External: Regulators | Per jurisdiction requirements | [Official filing] | Per regulatory template | Legal |
| External: Affected individuals | When required by law | [Email / Letter / In-app] | What happened, impact, remediation | Legal + Comms |
| External: Public (if required) | When required or appropriate | [Press release / Blog] | Summary, accountability, actions | Comms |

---

## 7. Testing and Drills

| Drill Type | Frequency | Last Conducted | Next Scheduled | Findings |
|-----------|-----------|---------------|---------------|----------|
| Tabletop exercise (Critical scenario) | [Annual] | | | |
| System shutdown drill | [Semi-annual] | | | |
| Regulatory notification drill | [Annual] | | | |
| Communication cascade test | [Semi-annual] | | | |

---

## 8. Evidence Checklist

- [ ] Incident classification defined
- [ ] Response workflow documented with roles and timelines
- [ ] Regulatory reporting requirements mapped per jurisdiction
- [ ] Log retention meets jurisdiction-specific minimums
- [ ] Incident report template operational
- [ ] Communication plan defined for all audiences
- [ ] Drills/exercises conducted and documented
- [ ] Post-incident review process established
- [ ] Incident log system operational and access-controlled

---

*This template supports compliance evidence gathering. It is not legal advice.*
