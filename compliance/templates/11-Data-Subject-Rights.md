# Data Subject Rights Implementation Checklist

> **Laws served:** EU GDPR; UK GDPR/DUA Act; India DPDPA; Brazil LGPD; South Africa POPIA; Canada PIPEDA; Mexico LFPDPPP; Australia Privacy Act; New Zealand Privacy Act; South Korea PIPA; Singapore PDPA; Kenya DPA; Ethiopia PDPP; Botswana DPA
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

## 1. Rights Implementation Matrix

| Right | EU | UK | India | Brazil | S. Africa | Canada | Australia | S. Korea | Implemented? | Response Time |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Right to be informed** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | At collection |
| **Right of access** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | 30 days |
| **Right to rectification** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | 30 days |
| **Right to erasure/deletion** | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | [ ] | 30 days |
| **Right to restrict processing** | ✅ | ✅ | — | — | — | — | — | — | [ ] | 30 days |
| **Right to data portability** | ✅ | ✅ | — | ✅ | — | — | — | ✅ | [ ] | 30 days |
| **Right to object** | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | 30 days |
| **Right re: automated decisions** | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | [ ] | 30 days |
| **Right to withdraw consent** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | Immediate |
| **Right to complain to authority** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [ ] | Inform |

---

## 2. Request Handling Process

### 2.1 Request Intake

| Channel | Available? | How It Works |
|---------|:---:|-------------|
| Online form / portal | [ ] | |
| Email address | [ ] | |
| In-app mechanism | [ ] | |
| Physical mail | [ ] | |
| Phone | [ ] | |

### 2.2 Identity Verification

| Method | Description |
|--------|-------------|
| Verification required? | [Yes — describe method] |
| Over-collection risk | [Do not collect more data to verify than necessary] |
| Failed verification process | [Inform requestor, provide alternative] |

### 2.3 Processing Workflow

| Step | Action | Responsible | SLA |
|------|--------|-------------|-----|
| 1 | Receive and log request | [Team/system] | Day 0 |
| 2 | Acknowledge receipt | | [Within X days] |
| 3 | Verify identity | | [Within X days] |
| 4 | Locate all relevant data | | |
| 5 | Assess any exemptions | | |
| 6 | Execute request | | |
| 7 | Notify data subject of outcome | | [Within 30 days of receipt] |
| 8 | Log completion | | |

---

## 3. AI-Specific Considerations

### 3.1 Right to Erasure in AI Systems

| Challenge | How Addressed |
|-----------|--------------|
| Data in training set | [Retrain without data / Machine unlearning / Document inability and justification] |
| Data memorized by model | [Model evaluation for memorization / Document risk] |
| Data in logs and caches | [Purge procedure] |
| Data in backups | [Backup purge schedule] |
| Data shared with third parties | [Notify and confirm deletion] |

### 3.2 Right Regarding Automated Decisions

> **Key jurisdictions:** EU, UK, South Africa, South Korea, Ethiopia, Ghana, Botswana

| Aspect | Implementation |
|--------|---------------|
| How user requests human review | |
| Who performs the review | [Role, qualifications] |
| Review turnaround time | |
| Can the automated decision be overturned? | [Yes — fully / Yes — within limits / No — explain] |
| Explanation of decision logic provided? | [See template 04-Automated-Decision-Logic] |

### 3.3 Right to Data Portability for AI

| Aspect | Implementation |
|--------|---------------|
| Data format provided | [JSON / CSV / XML / Machine-readable] |
| What data is included | [Input data / Profile data / Interaction history] |
| Transmission method | [Download / API / Direct transfer to another controller] |

---

## 4. Exemptions and Refusal

| Exemption | Applicable When | Jurisdiction | Documentation Required |
|-----------|----------------|-------------|----------------------|
| Manifestly unfounded/excessive request | Repetitive, unreasonable volume | EU, UK | Written justification |
| Legal obligation to retain | Regulatory retention requirement | All | Cite specific law |
| Legal claims | Data needed for legal proceedings | EU, UK | Document proceedings |
| Public interest | Processing necessary for public task | EU, UK | Document basis |
| Freedom of expression | Journalism, research | EU | Document balancing test |

---

## 5. Request Log

| Request ID | Date Received | Subject ID | Right Exercised | Verified? | Outcome | Response Date | Days Taken |
|-----------|--------------|-----------|----------------|:---:|---------|--------------|:---:|
| | | | | | [Fulfilled / Partially fulfilled / Refused] | | |

---

## 6. Evidence Checklist

- [ ] All applicable rights identified per jurisdiction
- [ ] Request intake channels operational
- [ ] Identity verification process documented
- [ ] Processing workflow documented with SLAs
- [ ] AI-specific challenges addressed (erasure from models, automated decisions)
- [ ] Exemptions documented with legal basis
- [ ] Request log system operational
- [ ] Staff trained on request handling
- [ ] Response times meet jurisdiction requirements (30 days EU/UK)
- [ ] Periodic audit of request handling quality

---

*This template supports compliance evidence gathering. It is not legal advice.*
