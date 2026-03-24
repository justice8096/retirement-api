# Consent Records Management

> **Laws served:** EU GDPR; UK GDPR; India DPDPA; Brazil LGPD; South Africa POPIA; Canada PIPEDA/Quebec Law 25; Mexico LFPDPPP; South Korea PIPA; Japan APPI; Singapore PDPA; New Zealand Privacy Act; Australia Privacy Act; Botswana DPA; Kenya DPA; Ethiopia PDPP; Illinois AI Video Interview Act
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

---

## 1. Consent Requirements Mapping

| Processing Activity | Legal Basis | Consent Required? | Jurisdiction(s) | Consent Type |
|--------------------|------------|:---:|----------------|-------------|
| Collect personal data for AI input | | [ ] | | [Explicit / Implied / Opt-in / Opt-out] |
| Use personal data for model training | | [ ] | | |
| Automated decision-making | | [ ] | | |
| Cross-border data transfer | | [ ] | | |
| Profiling | | [ ] | | |
| Special category data processing | | [ ] | | |
| AI video interview analysis | | [ ] | Illinois | Explicit written |
| Marketing / secondary use | | [ ] | | |

---

## 2. Consent Collection Design

| Element | Specification |
|---------|--------------|
| Consent language | [Plain language, reading level, available languages] |
| Granularity | [Per purpose / Bundled — EU requires granular] |
| Freely given | [Not conditional on service; no detriment for refusing] |
| Specific | [Tied to specific, stated purpose(s)] |
| Informed | [Data subject knows: what data, what purpose, who processes, their rights] |
| Unambiguous | [Clear affirmative action — no pre-ticked boxes] |
| Withdrawable | [Easy to withdraw as to give — described below] |

### Consent Copy Template

> "We would like to use your [data type] for the purpose of [purpose]. Your data will be processed by [processor] and [retained for X / deleted after X]. You can withdraw consent at any time by [method]. For more information, see our [privacy policy link]."

---

## 3. Consent Record Schema

Each consent event must capture:

| Field | Description | Required By |
|-------|-------------|-------------|
| `consent_id` | Unique identifier | All |
| `data_subject_id` | Pseudonymized identifier of the individual | All |
| `timestamp` | ISO 8601 datetime of consent action | All |
| `purpose` | Specific purpose consented to | EU, India, Brazil, South Korea |
| `data_categories` | What personal data is covered | EU, India |
| `consent_type` | [Opt-in / Explicit / Implied] | All |
| `consent_method` | [Web form / Email / Written / Verbal / In-app] | All |
| `consent_text_version` | Version of consent copy shown | EU, UK (audit trail) |
| `consent_given` | [true / false] | All |
| `withdrawal_timestamp` | When consent was withdrawn (if applicable) | All |
| `withdrawal_method` | How withdrawal was submitted | All |
| `jurisdiction` | Applicable legal jurisdiction | All |
| `evidence_ref` | Link to screenshot, recording, or signed form | Best practice |

---

## 4. Consent Lifecycle Management

| Event | Action | System Behavior | Record Updated? |
|-------|--------|----------------|:---:|
| Consent requested | Present consent UI/form | Log request timestamp | [ ] |
| Consent granted | Record all fields above | Begin permitted processing | [ ] |
| Consent refused | Record refusal | Do not process; offer alternative if available | [ ] |
| Consent withdrawn | Record withdrawal | Cease processing; delete data if no other legal basis | [ ] |
| Purpose change | Request new consent | Pause processing until new consent received | [ ] |
| Consent expires | Notify data subject | Request renewal or cease processing | [ ] |
| Consent re-confirmed | Update record | Continue processing | [ ] |

---

## 5. Withdrawal Mechanism

> **EU GDPR Art. 7(3):** Withdrawal must be as easy as giving consent

| Aspect | Details |
|--------|---------|
| Withdrawal method(s) | [In-app button / Email / Form / Phone] |
| Withdrawal processing time | [Immediate / Within X hours] |
| What happens to data after withdrawal | [Deleted / Anonymized / Retained under different legal basis — specify] |
| Confirmation sent to data subject? | [Yes — method] |

---

## 6. Children's Consent

> **Required when processing children's data:** EU (under 16, or member state threshold); US COPPA (under 13); UK (under 13); India DPDPA (defined by rules); Alberta PIPA amendments

| Aspect | Details |
|--------|---------|
| Age verification method | |
| Parental/guardian consent mechanism | |
| Consent record includes guardian identity? | [ ] |
| Jurisdiction-specific age threshold | |

---

## 7. Audit and Evidence

### Consent Records Sample

| consent_id | data_subject_id | timestamp | purpose | consent_given | consent_text_version | jurisdiction |
|-----------|----------------|-----------|---------|:---:|---------------------|-------------|
| | | | | | | |

### Consent Withdrawal Log

| consent_id | withdrawal_timestamp | withdrawal_method | data_action_taken | confirmed_to_subject |
|-----------|---------------------|------------------|------------------|:---:|
| | | | | |

---

## 8. Evidence Checklist

- [ ] All processing activities mapped to legal basis
- [ ] Consent copy is plain language, specific, granular
- [ ] Consent collection mechanism captures all required fields
- [ ] Consent records stored securely with audit trail
- [ ] Withdrawal mechanism implemented and tested
- [ ] Withdrawal is as easy as giving consent
- [ ] Children's consent mechanism in place (if applicable)
- [ ] Consent text versioned and archived
- [ ] Periodic consent validity review scheduled

---

*This template supports compliance evidence gathering. It is not legal advice.*
