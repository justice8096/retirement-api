# Risk Classification Decision Tree

> **Laws served:** EU AI Act Art. 6 + Annex III; South Korea AI Basic Act; Brazil PL 2338/2023; Peru Law No. 31814; Colorado SB 24-205; Vietnam Digital Technology Industry Law; Nigeria Digital Economy Bill (proposed)
> **Template version:** 1.0 | **Last updated:** 2026-03-14

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
| Classification result | [Prohibited / High-risk / Limited risk / Minimal risk] |

---

## 1. Step 1 — Is the System Prohibited?

> If **any** answer is YES → system is **PROHIBITED** under relevant jurisdiction

| Question | EU | Brazil | Peru | Answer |
|----------|:---:|:---:|:---:|:---:|
| Does the system use subliminal, manipulative, or deceptive techniques to distort behavior causing significant harm? | ✅ | ✅ | ✅ | [ ] Y [ ] N |
| Does the system exploit vulnerabilities of specific groups (age, disability, social/economic situation)? | ✅ | ✅ | ✅ | [ ] Y [ ] N |
| Does the system perform social scoring by public authorities? | ✅ | ✅ | — | [ ] Y [ ] N |
| Does the system perform untargeted scraping of facial images for facial recognition databases? | ✅ | — | — | [ ] Y [ ] N |
| Does the system infer emotions in workplace or educational settings (without medical/safety justification)? | ✅ | — | — | [ ] Y [ ] N |
| Does the system perform biometric categorization based on sensitive attributes (race, religion, sexual orientation)? | ✅ | — | — | [ ] Y [ ] N |
| Does the system perform real-time remote biometric identification in public spaces for law enforcement (without exception)? | ✅ | ✅ | ✅ | [ ] Y [ ] N |
| Does the system perform predictive policing based solely on profiling? | ✅ | — | ✅ | [ ] Y [ ] N |
| Is the system an autonomous weapon? | — | — | ✅ | [ ] Y [ ] N |
| Does the system perform unauthorized mass surveillance? | — | — | ✅ | [ ] Y [ ] N |

**Result:** [ ] No prohibited practices identified → proceed to Step 2
**Result:** [ ] Prohibited practice identified → **STOP — system cannot be deployed**

---

## 2. Step 2 — Is the System High-Risk?

### 2.1 EU AI Act — Annex III High-Risk Categories

| Category | Description | Your System? |
|----------|-----------|:---:|
| Biometrics | Remote biometric identification, biometric categorization | [ ] |
| Critical infrastructure | Safety components of critical infrastructure management | [ ] |
| Education | Access to education, assessment of students, exam proctoring | [ ] |
| Employment | Recruitment, hiring screening, task allocation, performance monitoring, promotion/termination | [ ] |
| Essential services | Access to essential private/public services (credit, insurance, emergency services) | [ ] |
| Law enforcement | Risk assessment of individuals, polygraph, evidence evaluation, profiling | [ ] |
| Migration/border | Risk assessment at borders, visa/asylum applications | [ ] |
| Justice/democracy | Legal interpretation assistance, influence on elections/referendums | [ ] |

### 2.2 Colorado SB 24-205 — Consequential Decisions

| Decision Area | Description | Your System? |
|--------------|-----------|:---:|
| Education | Enrollment, disciplinary actions | [ ] |
| Employment | Hiring, termination, compensation, promotion | [ ] |
| Financial services | Lending, credit, insurance underwriting | [ ] |
| Healthcare | Diagnosis, treatment, cost/coverage decisions | [ ] |
| Housing | Rental, sale, mortgage decisions | [ ] |
| Legal services | Legal rights, immigration, parole/sentencing | [ ] |
| Essential government services | Benefits, licensing, permits | [ ] |

### 2.3 South Korea AI Basic Act — High-Impact AI

| Category | Your System? |
|----------|:---:|
| Healthcare decisions | [ ] |
| Education assessment | [ ] |
| Financial services (credit, insurance) | [ ] |
| Employment decisions | [ ] |
| Essential services access | [ ] |

### 2.4 Brazil PL 2338/2023 — High-Risk

| Category | Your System? |
|----------|:---:|
| Autonomous vehicles | [ ] |
| Healthcare diagnosis/treatment | [ ] |
| Critical infrastructure | [ ] |
| Education assessment | [ ] |
| Employment decisions | [ ] |
| Credit/insurance decisions | [ ] |
| Justice system | [ ] |
| Public security | [ ] |
| Biometric identification | [ ] |

**Result:** [ ] High-risk in one or more frameworks → proceed with full compliance obligations
**Result:** [ ] Not high-risk → proceed to Step 3

---

## 3. Step 3 — Limited or Minimal Risk?

### EU AI Act — Limited Risk (Art. 50 transparency obligations only)

| Question | Answer |
|----------|:---:|
| Does the system interact directly with humans (chatbot, conversational AI)? | [ ] Y [ ] N |
| Does the system generate synthetic content (text, image, audio, video)? | [ ] Y [ ] N |
| Does the system perform emotion recognition? | [ ] Y [ ] N |
| Does the system perform biometric categorization? | [ ] Y [ ] N |

If **any** YES → **Limited risk** — transparency/disclosure obligations apply (see templates 02, 03)
If **all** NO → **Minimal risk** — no specific EU AI Act obligations (general law still applies)

---

## 4. Classification Summary

| Framework | Classification | Justification |
|-----------|---------------|---------------|
| EU AI Act | [ ] Prohibited [ ] High-risk [ ] Limited [ ] Minimal | |
| Colorado SB 24-205 | [ ] High-risk (consequential) [ ] Not high-risk | |
| South Korea AI Basic Act | [ ] High-impact [ ] General | |
| Brazil PL 2338/2023 | [ ] Prohibited [ ] High-risk [ ] General | |
| Peru Law No. 31814 | [ ] Prohibited [ ] High-risk [ ] Low-risk | |

---

## 5. Obligations Triggered

| Classification | Obligations | Templates to Complete |
|---------------|------------|----------------------|
| **Prohibited** | Cannot deploy | N/A — redesign or abandon |
| **High-risk** | Full compliance: risk management, data governance, technical docs, transparency, human oversight, accuracy/robustness, conformity assessment, registration | 01, 04, 05, 06, 07, 08, 09, 12, 13, 14, 15, 18, 19 |
| **Limited risk** | Transparency obligations | 02, 03 |
| **Minimal risk** | No specific AI Act obligations | Recommended: 01, 07, 12 |

---

## 6. Classification Review

| Review Item | Details |
|-------------|---------|
| Classified by | [Name, role] |
| Classification date | |
| Reviewed by | [Legal/compliance reviewer] |
| Next review date | [At minimum: annually or upon material system change] |
| Triggers for reclassification | [New use case, new jurisdiction, regulatory update, system capability change] |

---

*This template supports compliance evidence gathering. It is not legal advice.*
