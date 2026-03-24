# Impact and Risk Assessment

> **Laws served:** EU AI Act Art. 9 (risk management), Art. 27 (fundamental rights); Colorado SB 24-205; South Korea AI Basic Act; Brazil PL 2338/2023; Peru Law No. 31814; Nigeria GAID/NDPA
> **Template version:** 1.0 | **Last updated:** 2026-03-14

---

## Metadata

| Field | Value |
|-------|-------|
| AI System Name | |
| Assessment type | [Pre-deployment / Periodic review / Triggered by change] |
| Organization | |
| Document owner | |
| Session/GitHub ref | |
| Date created | [YYYY-MM-DD] |
| Author | [Human name or LLM model] |
| Assessor(s) | [Names, roles, qualifications] |
| Next review date | |

---

## 1. System Context

| Field | Details |
|-------|---------|
| System purpose | |
| Decision domain | [Employment / Credit / Insurance / Healthcare / Education / Law enforcement / General] |
| Affected population | [Who and how many people are affected?] |
| Deployment jurisdictions | |
| Risk classification assigned | [See template 17-Risk-Classification] |

---

## 2. Fundamental Rights Impact Assessment

> **Required by:** EU AI Act Art. 27 (public-sector deployers of high-risk); South Korea AI Basic Act (high-impact)

| Fundamental Right | Potentially Affected? | Severity | Likelihood | Mitigation |
|------------------|:---:|---------|-----------|------------|
| Right to non-discrimination | [ ] | [High/Med/Low] | [High/Med/Low] | |
| Right to privacy and data protection | [ ] | | | |
| Right to human dignity | [ ] | | | |
| Freedom of expression | [ ] | | | |
| Right to an effective remedy | [ ] | | | |
| Presumption of innocence | [ ] | | | |
| Right to education | [ ] | | | |
| Workers' rights | [ ] | | | |
| Consumer protection rights | [ ] | | | |
| Rights of the child | [ ] | | | |
| Right to good administration | [ ] | | | |
| Right of access to documents | [ ] | | | |

---

## 3. Risk Identification

### 3.1 Technical Risks

| Risk | Description | Likelihood | Impact | Risk Score | Mitigation | Residual Risk |
|------|-------------|-----------|--------|:---:|------------|:---:|
| Model accuracy failure | | [H/M/L] | [H/M/L] | | | |
| Bias / discrimination | | | | | | |
| Hallucination / false output | | | | | | |
| Adversarial attack vulnerability | | | | | | |
| Data poisoning | | | | | | |
| Privacy leakage | | | | | | |
| System availability failure | | | | | | |
| Output manipulation | | | | | | |

### 3.2 Societal Risks

| Risk | Description | Likelihood | Impact | Risk Score | Mitigation | Residual Risk |
|------|-------------|-----------|--------|:---:|------------|:---:|
| Disproportionate impact on vulnerable groups | | | | | | |
| Erosion of human autonomy | | | | | | |
| Democratic process impact | | | | | | |
| Environmental impact | | | | | | |
| Economic displacement | | | | | | |
| Power concentration | | | | | | |

### 3.3 Operational Risks

| Risk | Description | Likelihood | Impact | Risk Score | Mitigation | Residual Risk |
|------|-------------|-----------|--------|:---:|------------|:---:|
| Misuse by users | | | | | | |
| Scope creep beyond intended use | | | | | | |
| Over-reliance by operators | | | | | | |
| Inadequate human oversight | | | | | | |
| Regulatory non-compliance | | | | | | |

---

## 4. Algorithmic Impact Evaluation

> **Required by:** Colorado SB 24-205 (consequential decisions); Brazil PL 2338/2023; Canada Directive on ADM

### 4.1 Consequential Decision Assessment (Colorado)

| Question | Answer |
|----------|--------|
| Does this system make or substantially assist decisions about consumers? | [Yes / No] |
| Decision categories affected | [Employment / Education / Financial services / Healthcare / Housing / Insurance / Legal services / Essential government services] |
| Is the system "high-risk" under Colorado definition? | [Yes / No — justify] |

### 4.2 Discrimination Testing

| Protected Characteristic | Tested? | Disparate Impact Found? | Ratio | Mitigation |
|------------------------|:---:|:---:|-------|------------|
| Race / Ethnicity | [ ] | [ ] | | |
| Gender / Sex | [ ] | [ ] | | |
| Age | [ ] | [ ] | | |
| Disability | [ ] | [ ] | | |
| Religion | [ ] | [ ] | | |
| National origin | [ ] | [ ] | | |
| Sexual orientation | [ ] | [ ] | | |
| Socioeconomic status | [ ] | [ ] | | |

---

## 5. Risk Management Plan

> **Required by:** EU AI Act Art. 9 (iterative, ongoing process); Colorado; South Korea

| Phase | Activity | Frequency | Responsible |
|-------|----------|-----------|-------------|
| Identification | Review risks against this template | [Per release / Quarterly / Annually] | |
| Assessment | Score likelihood × impact | [Per release / Quarterly] | |
| Mitigation | Implement controls per risk | [Continuous] | |
| Monitoring | Track risk indicators and incidents | [Real-time / Weekly / Monthly] | |
| Reporting | Report to governance body | [Monthly / Quarterly] | |
| Review | Full reassessment | [Annually / Upon material change] | |

### 5.1 Key Risk Indicators (KRIs)

| Indicator | Threshold | Current Value | Status |
|-----------|-----------|:---:|--------|
| Model accuracy degradation | [> X% drop triggers review] | | [Green/Amber/Red] |
| Bias metric drift | [> X% change triggers review] | | |
| User complaint rate | [> X per 1000 interactions] | | |
| Override rate | [> X% suggests model issues] | | |
| Incident count | [> X per period] | | |

---

## 6. Risk Acceptance

| Residual Risk | Accepted By | Date | Conditions |
|--------------|------------|------|------------|
| [Risk description] | [Name, role — must be senior] | | [Any conditions on acceptance] |

---

## 7. Evidence Checklist

- [ ] All applicable risks identified and scored
- [ ] Fundamental rights assessment completed (if EU/South Korea)
- [ ] Discrimination testing completed (if Colorado/NYC/employment use)
- [ ] Risk management plan established with monitoring cadence
- [ ] Key risk indicators defined and being tracked
- [ ] Residual risks formally accepted by accountable person
- [ ] Assessment reviewed by legal/compliance
- [ ] Next review date scheduled

---

## 8. Version History

| Version | Date | Author | Trigger | Changes |
|---------|------|--------|---------|---------|
| 1.0 | | | Initial assessment | |

---

*This template supports compliance evidence gathering. It is not legal advice.*
