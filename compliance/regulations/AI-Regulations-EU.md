# AI & LLM Software Development Regulations â€” European Union

**Last Updated:** 2026-03-13
**Tags:** #ai-regulation #eu #eu-ai-act #compliance #software-development

---

## Overview

The EU AI Act (Regulation 2024/1689) is the world's first comprehensive AI-specific law. It entered into force on 1 August 2024 and is being phased in through August 2027. It applies to any organization that develops, deploys, or distributes AI systems in the EU market â€” regardless of where the organization is based.

---

## Key Legislation

### EU AI Act â€” Phased Implementation Timeline

| Date | What Applies |
|------|-------------|
| **2 Feb 2025** | Prohibited AI practices banned; AI literacy obligations begin for all providers and deployers |
| **2 Aug 2025** | Governance infrastructure operational; obligations for general-purpose AI (GPAI) model providers begin |
| **2 Aug 2026** | Full applicability for most operators â€” high-risk AI system rules, transparency duties (Art. 50) |
| **2 Aug 2027** | Rules for high-risk AI systems embedded in regulated products (e.g., medical devices, machinery) |

> **Note:** The Nov 2025 "Digital Omnibus" proposal may push high-risk obligation dates to Dec 2027 / Aug 2028 if adopted.

### EU Cloud and AI Development Act (Proposed Q1 2026)
- Aims to strengthen European computing infrastructure for AI
- Complements the AI Act with cloud capacity and data sovereignty provisions

---

## Risk-Based Classification System

The AI Act categorizes AI systems into four tiers:

### 1. Unacceptable Risk (Prohibited)
- Social scoring by governments
- Real-time remote biometric identification in public spaces (with exceptions)
- AI systems that manipulate behavior through deception
- Predictive policing based solely on profiling
- Emotion recognition in workplace/education settings
- Untargeted scraping of facial images for databases

### 2. High-Risk AI Systems
Systems used in critical areas requiring conformity assessments, technical documentation, risk management, human oversight, and EU database registration:
- Biometric identification and categorization
- Critical infrastructure management
- Education and vocational training (e.g., grading, admissions)
- Employment and worker management (recruitment, evaluation)
- Access to essential services (credit scoring, insurance)
- Law enforcement and border control
- Administration of justice

### 3. Limited Risk (Transparency Obligations)
- Chatbots must disclose they are AI
- AI-generated content must be labeled (deepfakes, synthetic text for public interest)
- Emotion recognition / biometric categorization systems must inform users

### 4. Minimal / No Risk
- No specific obligations (e.g., spam filters, AI in video games)

---

## General-Purpose AI (GPAI) Model Rules

Effective since August 2025, providers of GPAI models must:

- Maintain and provide technical documentation
- Publish a public summary of training data content (using Commission template)
- Comply with EU copyright law
- Cooperate with downstream providers

**GPAI models with systemic risk** (e.g., models trained with >10^25 FLOPS) have additional obligations:
- Model evaluation and adversarial testing
- Incident tracking and reporting
- Cybersecurity protections
- Energy consumption reporting

A **Code of Practice** for GPAI models has been developed to provide a compliance pathway.

---

## Open Source Exemptions

The AI Act provides limited exemptions for open-source AI:
- AI systems released under free/open-source licenses are generally exempt **unless** they fall under prohibited, high-risk, or transparency-risk categories
- Open-source GPAI models are exempt from documentation/summary requirements **unless** they pose systemic risk (>10^25 FLOPS threshold)
- The exemption does **not** apply to providers of GPAI models that make them available with a commercial license or monetize them

---

## Compliance Requirements for Software Developers

### If You Build AI Systems (Provider):
1. **Classify your system's risk level** per Annex III
2. **Conduct conformity assessments** for high-risk systems
3. **Implement risk management systems** â€” ongoing, iterative process
4. **Maintain technical documentation** â€” data governance, training data, testing
5. **Ensure human oversight** â€” design for meaningful human control
6. **Register high-risk systems** in EU database before deployment
7. **Affix CE marking** upon compliance
8. **Report serious incidents** to market surveillance authorities

### If You Deploy AI Systems (Deployer):
1. **Use systems according to provider instructions**
2. **Ensure human oversight** by competent individuals
3. **Monitor system performance** and report issues
4. **Conduct fundamental rights impact assessments** for high-risk public-sector uses
5. **Inform individuals** when subject to high-risk AI decisions

### AI Literacy (All Operators â€” Effective Feb 2025):
- Ensure sufficient AI literacy among staff involved in AI operations
- Consider technical knowledge, experience, education, and training context

---

## Penalties

| Violation | Maximum Fine |
|-----------|-------------|
| Prohibited AI practices | â‚¬35M or 7% of global annual turnover |
| High-risk system non-compliance | â‚¬15M or 3% of global annual turnover |
| Incorrect information to authorities | â‚¬7.5M or 1% of global annual turnover |

Individual Member States may impose additional penalties (e.g., Italy's Law No. 132/2025 adds disqualification measures).

---

## Key Dates for Developers to Watch in 2026

- **By June 2026:** Code of Practice for marking/labeling AI-generated content expected to be finalized
- **2 Aug 2026:** Full applicability â€” high-risk AI, transparency duties, conformity assessments due
- **Throughout 2026:** EU Member States appointing national regulators; country-specific laws (e.g., Italy) adding nuance
- **Late 2026:** Digital Omnibus negotiations may adjust timelines

---

## Resources

- [EU AI Act Official Text](https://artificialintelligenceact.eu/)
- [European Commission AI Page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [GPAI Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [NIST AI RMF](https://www.nist.gov/artificial-intelligence) (complementary US framework)
- [ISO/IEC 42001](https://www.iso.org/standard/81230.html) â€” AI Management System standard
- [Regulations.ai - EU AI Act](https://regulations.ai) - global AI law and regulation database

---

## Key Takeaway for Developers

If you are building LLM-powered applications, chatbots, or AI-integrated software for EU users:
- You **must** disclose AI interaction to users (transparency)
- You **must** label AI-generated content
- You **must** have a risk classification for your system
- High-risk deployments require full conformity assessment and documentation
- GPAI model providers must document training data and comply with copyright
- Start compliance now â€” August 2026 is the hard deadline for most obligations
