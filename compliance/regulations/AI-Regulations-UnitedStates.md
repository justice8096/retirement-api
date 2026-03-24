# AI & LLM Software Development Regulations â€” United States

**Last Updated:** 2026-03-13
**Tags:** #ai-regulation #united-states #state-laws #federal-policy #software-development

---

## Overview

The United States has **no comprehensive federal AI law**. The regulatory landscape is defined by a growing patchwork of state-level laws, federal executive orders, agency guidance, and voluntary frameworks. The Trump administration (since Jan 2025) has pursued an "innovation-first" federal posture â€” revoking Biden-era safety requirements and actively pushing to preempt state regulations. Meanwhile, states have aggressively filled the regulatory gap, with over **1,000 AI-related bills** introduced in 2025 alone.

---

## Federal Framework

### Executive Order 14179 (Jan 20, 2025)
- "Removing Barriers to American Leadership in AI"
- Revoked Biden's EO 14110 on safe and trustworthy AI
- Eliminated prior safety testing and reporting requirements for federal agencies
- Directed development of the federal AI Action Plan

### AI Action Plan (July 2025)
- "America's AI Action Plan" â€” roadmap for federal policy
- Over 90 policy actions across three pillars: accelerating innovation, building infrastructure, international diplomacy
- Not directly enforceable law but influences agency priorities and procurement

### Executive Order 14365 (Dec 11, 2025)
- "Ensuring a National Policy Framework for Artificial Intelligence"
- Most significant federal action â€” aims to preempt state AI laws
- **Key provisions:**
  - **AI Litigation Task Force** â€” Attorney General must establish within 30 days to challenge state AI laws deemed inconsistent with federal policy
  - **Commerce Department evaluation** â€” must publish within 90 days identifying "onerous" state laws (due ~March 2026)
  - **Federal funding restrictions** â€” states with conflicting AI laws may lose eligibility for BEAD broadband funds and discretionary grants
  - **FCC disclosure standard** â€” proceeding to consider federal AI reporting/disclosure standard that would preempt state laws
  - **FTC policy statement** â€” due ~March 2026 on how FTC Act applies to AI
- **Carved-out areas** (exempt from preemption): child safety, AI infrastructure/data centers, state government AI procurement
- Specifically names Colorado AI Act as an example of "excessive state regulation"
- **Legal reality:** Executive orders cannot independently preempt state law â€” only Congress can do that constitutionally

### Federal Statutes
- **National AI Initiative Act (2020):** Funds AI research across federal agencies
- **AI Training Act (2022):** OMB must provide AI training for federal acquisition workforce
- **AI LEAD Act (pending):** Would establish product liability framework for AI systems
- **No broad federal AI compliance law has been passed as of March 2026**

### NIST AI Risk Management Framework (RMF)
- Voluntary guidelines published 2023
- Four functions: Govern, Map, Measure, Manage
- Widely referenced by state laws and industry standards
- Not legally binding but influential for demonstrating due diligence

---

## Major State Laws (Effective 2026)

### Colorado AI Act (SB 24-205) â€” Effective June 30, 2026
- **The most comprehensive state AI law in the US**
- Targets "high-risk" AI systems used for consequential decisions about consumers
- **Developers must:** Exercise reasonable care to prevent algorithmic discrimination, provide documentation to deployers, disclose known limitations
- **Deployers must:** Conduct impact assessments, provide consumer disclosures, implement risk management
- Penalties: Up to **$20,000 per violation**
- No private right of action
- Originally set for Feb 2026, delayed by SB 25B-004

### California â€” Multiple Laws Effective Jan 1, 2026 / Aug 2026

| Law | Effective | Key Requirement |
|-----|-----------|----------------|
| **Transparency in Frontier AI Act (SB 53)** | Jan 1, 2026 | Frontier developers (>10Â²â¶ FLOPS training) must publish risk frameworks, report safety incidents, implement whistleblower protections; large developers (>$500M revenue) face enhanced obligations; penalties up to $1M/violation |
| **AI Training Data Transparency Act (AB 2013)** | Jan 1, 2026 | Disclose training data sources for generative AI |
| **AI Transparency Act (SB 942)** | Aug 2, 2026 | GenAI providers must offer watermarks, latent disclosures, and detection tools for AI-generated content |
| **Civil Rights Dept. AI Regulations** | Oct 2025 | Restrict discriminatory use of AI in employment |
| **Deepfake disclosure laws** | Various | Mandate labeling of AI-generated political advertising |
| **Common Pricing Algorithm ban** | Jan 1, 2026 | Prohibits AI-driven price-fixing algorithms |

### Texas â€” Responsible AI Governance Act (RAIGA) â€” Effective Jan 1, 2026
- Establishes governance requirements for AI systems
- Transparency and accountability provisions

### Illinois â€” Multiple Laws
- **HB 3773 (Public Act 103-0804):** Amends Human Rights Act to prohibit employer use of AI that discriminates against protected classes
- **AI Video Interview Act:** Requires employer notice and candidate consent when AI analyzes video interviews; data retention/destruction requirements

### New York
- **NYC Local Law 144:** Requires bias audits and disclosure for automated employment decision systems (already in effect)
- **RAISE Act (pending Governor signature):** Targets high-cost AI developers, mandating safety policies and risk mitigation
- **Additional bills** on social media AI, synthetic performer disclosure, expanded publicity rights

### Utah
- Requires disclosure when consumers interact with generative AI

---

## Federal-State Tension

The Dec 2025 executive order creates significant uncertainty:
- State laws remain enforceable until Congress passes preemptive federal legislation or courts strike them down
- The Commerce Department's evaluation of state laws was due by ~March 2026
- The AI Litigation Task Force may challenge specific state laws but faces lengthy court processes
- **Prudent approach:** Continue complying with state laws until there is clarity
- The 18 existing state privacy laws with automated decision-making provisions add additional complexity

---

## Sector-Specific Federal Regulation

Federal agencies continue applying existing authority to AI:
- **FTC:** Consumer protection, unfair/deceptive AI practices
- **EEOC:** Employment discrimination via AI hiring tools
- **FDA:** AI in medical devices and healthcare
- **SEC/CFPB:** AI in financial services, lending, credit scoring
- **HUD:** AI in housing decisions
- **DOE/DOD:** AI in energy and defense applications

---

## What This Means for Developers

1. **No single federal compliance standard** â€” prepare for multi-state compliance
2. **Colorado AI Act (June 2026)** is the highest-priority state law for high-risk AI systems
3. **California's frontier AI transparency requirements** apply to large-scale LLM developers from Jan 2026
4. **Employment AI is heavily targeted** â€” bias audits, disclosure, and consent requirements are spreading
5. **Monitor the federal preemption battle** â€” but don't rely on it to eliminate state obligations yet
6. **NIST AI RMF** is a strong voluntary framework for demonstrating responsible practices
7. **Document everything** â€” impact assessments, risk management, training data, and decision processes
8. **Algorithmic discrimination** is the central concern across nearly all state laws
9. **AI-generated content labeling** requirements are proliferating â€” build watermarking/disclosure into your pipeline

---

## Key Compliance Deadlines

| Date | Law/Action |
|------|-----------|
| Jan 1, 2026 | CA SB 53 (Frontier AI), CA AB 2013 (Training Data), TX RAIGA, IL HB 3773 |
| ~Mar 2026 | Commerce Dept evaluation of state laws; FTC AI policy statement |
| Jun 30, 2026 | Colorado AI Act |
| Aug 2, 2026 | CA SB 942 (AI Transparency Act) |
| Jan 1, 2027 | Additional state laws expected |

---

## Resources

- [NIST AI RMF](https://www.nist.gov/artificial-intelligence)
- [NCSL AI Legislation Database](https://www.ncsl.org/technology-and-communication/artificial-intelligence-2025-legislation)
- [Colorado AI Act Text](https://leg.colorado.gov/)
- [White House AI Action Plan](https://www.whitehouse.gov/)
- [Baker Botts US AI Law Update (Jan 2026)](https://www.bakerbotts.com/thought-leadership/publications/2026/january/us-ai-law-update)
- [Regulations.ai - US AI Legislation](https://regulations.ai) - global AI law and regulation database
