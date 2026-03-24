# AI Governance Framework

> **Laws served:** EU AI Act; South Korea AI Basic Act; Brazil PL 2338/2023; Chile AI Regulatory Bill; Colombia Bill 059/2023; Singapore AI Governance Framework; UK Five Core Principles; Texas RAIGA; Japan AI Guidelines for Business; New Zealand OECD Principles; Australia AI6 Guidance; Canada Voluntary Code of Conduct
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| Organization | Retirement Planning SaaS |
| Document owner | Justin, Project Owner |
| Session/GitHub ref | RP-2026-001 |
| Date created | 2026-03-21 |
| Author | Auto-filled by compliance tooling (review and add human author) |
| Approved by | [Executive sponsor, date] |
| Review cycle | [Annual / Semi-annual] |

---

## 1. Governance Structure

### 1.1 Organizational Chart

| Role / Body | Name(s) | Responsibilities | Authority |
|-------------|---------|-----------------|-----------|
| Executive sponsor | | Ultimate accountability for AI governance | Budget, policy, escalation |
| AI Governance Board/Committee | | Strategic oversight, risk acceptance, policy approval | Approve/reject AI deployments |
| AI Ethics Advisor / Committee | | Ethical review of AI use cases | Advisory / Binding review |
| Chief Data / AI Officer | | Operational AI governance | Day-to-day management |
| Data Protection Officer | | Privacy compliance intersection | GDPR/DPDPA/LGPD compliance |
| Legal / Compliance | | Regulatory compliance | Legal sign-off |
| Technical AI Lead | | Architecture, model governance, MLOps | Technical decisions |
| Human oversight operators | | Day-to-day monitoring and override | See template 09 |

### 1.2 Governance Meetings

| Meeting | Frequency | Attendees | Purpose |
|---------|-----------|-----------|---------|
| AI Governance Board | [Monthly / Quarterly] | | Strategic review, risk acceptance, policy |
| Ethics Review | [Per use case / Monthly] | | Ethical assessment of new/changed AI uses |
| Technical Review | [Per release / Sprint] | | Model performance, bias, incidents |
| Incident Review | [Per incident] | | Post-incident analysis |

---

## 2. AI Policy Framework

### 2.1 Core Policies

| Policy | Status | Owner | Last Reviewed |
|--------|--------|-------|--------------|
| AI Acceptable Use Policy | [ ] Draft [ ] Approved | | |
| AI Risk Management Policy | [ ] Draft [ ] Approved | | |
| AI Ethics Policy / Code of Ethics | [ ] Draft [ ] Approved | | |
| AI Transparency Policy | [ ] Draft [ ] Approved | | |
| AI Data Governance Policy | [ ] Draft [ ] Approved | | |
| AI Incident Response Policy | [ ] Draft [ ] Approved | | |
| AI Procurement / Third-Party Policy | [ ] Draft [ ] Approved | | |
| AI Model Lifecycle Policy | [ ] Draft [ ] Approved | | |

### 2.2 Principles

| Principle | Description | How Implemented |
|-----------|-------------|----------------|
| **Safety** | AI systems must not cause harm | [Risk assessment, testing, monitoring] |
| **Fairness** | AI must not discriminate | [Bias testing, remediation, monitoring] |
| **Transparency** | Users and stakeholders understand AI | [Disclosures, documentation, explainability] |
| **Accountability** | Clear responsibility for AI outcomes | [Governance structure, audit trails] |
| **Human oversight** | Humans can intervene and override | [Override mechanisms, monitoring] |
| **Privacy** | Personal data is protected | [PIA/DPIA, data minimization, rights] |
| **Robustness** | AI performs reliably and securely | [Testing, security, resilience] |

---

## 3. AI System Inventory / Register

> **Best practice across all jurisdictions; required by some (EU, Peru, Colombia)**

| System ID | System Name | Purpose | Risk Level | Owner | Status | Jurisdictions | Last Review |
|-----------|------------|---------|-----------|-------|--------|--------------|------------|
| | | | [High/Med/Low] | | [Active/Development/Retired] | | |

---

## 4. Approval and Review Process

### 4.1 New AI System Approval

| Gate | Activities | Decision Maker | Artifacts Required |
|------|-----------|----------------|-------------------|
| 1. Proposal | Use case definition, initial risk screening | AI Lead | Use case brief |
| 2. Ethics Review | Ethical assessment, fundamental rights check | Ethics Committee | Ethics assessment |
| 3. Risk Assessment | Full risk/impact assessment | Governance Board | Template 06, 07 |
| 4. Technical Review | Architecture, data, model validation | Technical Lead | Template 01, 05 |
| 5. Compliance Review | Jurisdiction mapping, regulatory requirements | Legal/Compliance | Evidence matrix check |
| 6. Approval | Go/no-go decision | Governance Board | Sign-off record |
| 7. Deployment | Production launch with monitoring | Operations | Template 09, 13 |

### 4.2 Change Management

| Change Type | Approval Required | Review Scope |
|------------|------------------|-------------|
| Model update (minor) | Technical Lead | Performance metrics |
| Model update (major) | Governance Board | Full re-assessment |
| New data source | Data Governance + Legal | PIA update, copyright check |
| New jurisdiction | Legal + Governance Board | Full regulatory mapping |
| New use case | Full approval process | All gates |
| Incident-driven change | Incident Review → Board | Root cause + fix validation |

---

## 5. Third-Party AI Governance

| Aspect | Requirements |
|--------|-------------|
| Vendor assessment | [AI-specific due diligence checklist] |
| Contractual requirements | [Transparency, audit rights, data handling, liability] |
| Ongoing monitoring | [Performance, compliance, incident reporting] |
| Exit strategy | [Data return/deletion, transition plan] |

---

## 6. Reporting and Accountability

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| AI Governance Dashboard | [Monthly] | Board / Executive | System inventory, risk status, incidents, compliance |
| Incident Report | [Per incident] | Governance Board + Legal | See template 13 |
| Annual AI Governance Report | [Annual] | Board + Regulators (if required) | Full governance review |
| Regulatory Filings | [Per deadline] | Authorities | See template 14 |

---

## 7. Evidence Checklist

- [ ] Governance structure defined with named individuals
- [ ] Meeting cadence established
- [ ] Core policies drafted and approved
- [ ] Principles documented and operationalized
- [ ] AI system inventory/register maintained
- [ ] Approval process defined for new AI systems
- [ ] Change management process defined
- [ ] Third-party governance requirements established
- [ ] Reporting cadence established
- [ ] Annual governance review scheduled
- [ ] Ethics committee/advisor appointed (if required: Colombia, South Korea, Peru)

---

*This template supports compliance evidence gathering. It is not legal advice.*
