# Contribution Analysis Report — Cycle 2026-04-20

| Field | Value |
|---|---|
| **Report Date** | 2026-04-20 |
| **Cycle Window** | 2026-04-19 → 2026-04-20 |
| **Contributors** | Justice (Human), Claude Opus 4.7 (AI Assistant) |
| **Branch / PR** | `fix/audit-remediation-all` / PR #11 |
| **Commits in cycle** | `b03fd61`, `2fb9f43` |
| **Deliverable** | retirement-api audit-remediation sweep (security + a11y + governance) |
| **Supersedes** | `audits/contribution-analysis.md` (2026-04-19, 38/62, A-) |

---

## Executive Summary

This cycle is a single large remediation PR that closes the 42-item todo-list assembled from the 2026-04-19 SAST / dyscalculia / dyslexia / LLM-compliance / supply-chain / WCAG audits. Unlike prior cycles — which were roughly balanced pair-programming with meaningful human authorship of seed data and domain models — this cycle is almost purely **triager-implementer**: Justice read the audit backlog, prioritized, signed off on scope and PR strategy; Claude produced the code, docs, and ADRs end-to-end.

The delta split for this cycle lands at **~10 / 90 Justice / Claude**. Cumulatively, blended with the prior 38 / 62 history, the project sits at approximately **25 / 75**.

**Overall Collaboration Model (this cycle):** Human-triaged, AI-executed batch remediation. Justice's leverage compressed to four inputs — audit review, scope signoff, branch strategy, and the "one PR vs. many PRs" judgement call. Claude authored every keystroke across the security fixes, the versioning header infrastructure, the abbreviation expansion and WCAG fix scripts, the ADRs, SECURITY.md, METHODOLOGY.md, OPS.md, the CHANGELOG entry, and the CI hardening.

**Overall Quality Grade (delta):** **A-** — comprehensive closure of the audit backlog, typecheck green, no test regressions (webhook suite 15 failing vs. 16 failing baseline). Held back from A by one structural concern: 67 files and ~1 500 net lines landed in a single PR, which is genuinely hard to review. A three-PR split (security / a11y / governance) would have been more responsible for a codebase that otherwise runs a careful audit-then-fix loop.

---

## Methodology

Same approach as the 2026-04-19 analysis:

1. Read the two cycle commits (`git show --stat b03fd61 2fb9f43`) and the commit messages.
2. Inventory fixes by audit finding ID (H-0x / M-0x / L-0x / F-0xx).
3. For each finding, attribute the **decision** (what to fix, what shape) and the **implementation** (who wrote the code).
4. Tag "architectural calls" separately — fixes whose shape will outlive the fix itself.
5. Compute cycle-delta percentages across the same seven dimensions as the prior report.
6. Reweight cumulative percentages using the prior report's baseline as 30 cycles of history and this delta as 2 commits' worth of new surface area.

---

## Attribution Matrix (Cycle Delta)

### Dimension 1: Architecture & Design — 25 / 75 (cycle delta)

Prior baseline was 80 / 20 in Justice's favour because the Fastify/Prisma/Clerk/rate-limit/ACA-regime decisions were all human calls. This cycle introduces several **new** structural decisions that sit underneath the bug-fix work, and those shapes were Claude-proposed:

**Claude's attribution-worthy architectural calls this cycle:**

- **Accept-Version: 2 request header** (F-202, ADR-0003). The whole signal shape — opt-in header vs. URL-path versioning, per-request `_units` regeneration, `X-API-Version` echoed on the response, v1 as default forever — is a Claude design that Justice accepted after a short discussion.
- **`validateBody()` helper shape** (F-011). The choice to wrap Zod parsing + `toValidationErrorPayload` into one exported function — so the raw `parsed.error.issues` leak can never recur silently — is a Claude call.
- **`getLabelsFor()` + `LABELED_FIELDS` + `_labels` sibling pattern** (F-013). Instead of duplicating label lookups per route, Claude centralized the list of labelable fields and made `_labels` a sibling envelope alongside `_units`.
- **`ensureStripeCustomer()` optimistic-concurrency approach** (L-NEW-02). The race — two parallel checkout creations producing two Stripe customers — is fixed with a shared helper that uses a Prisma `update…where customerId is null` guard, not a full mutex. Claude proposed the shape; Justice accepted.
- **Two single-purpose Node scripts** (`tools/expand-abbreviations.mjs`, `tools/wcag-fix-html.mjs`). Rather than 82 + 85 one-off edits, Claude opted to write two small, reviewable scripts that run over the trees and print their diffs. Each script is re-runnable and auditable; the decision to automate-rather-than-manual-edit is itself a judgement call and a point of architectural attribution.

**Justice's architectural calls this cycle:**

- "One PR or several?" Justice chose one, accepting the review-burden tradeoff against merge-churn.
- Prioritizing H-03, H-05, and the F-202 versioning infrastructure over the cosmetic F-208 fix for this single PR (all ended up included anyway, but the ordering was Justice's).
- Accepting Claude's ADR-0003 proposal as-is rather than pushing back on URL-path versioning.

### Dimension 2: Code Generation — 5 / 95 (cycle delta)

Near-total Claude authorship. The file list (67 files, +1 769 / -298) breaks down as:

| Surface | Files | Attribution | Notes |
|---|---|---|---|
| Security fixes (`auth.ts`, `sanitize.ts`, `admin.ts`, `contributions.ts`, `preferences.ts`, `releases.ts`, `users.ts`, `fees.ts`, `server.ts`) | 9 | 5 / 95 | Zod + Prisma + Fastify patterns, Claude-authored |
| New helpers (`lib/stripe-customer.ts`, `lib/validation.ts` additions, `lib/swagger.ts` fallback doc) | 3 | 0 / 100 | Fresh files, Claude-authored |
| Versioning infrastructure (`types/fastify.d.ts`, `financial.ts`, `fees.ts`) | 3 | 5 / 95 | Header parsing, `_units` regeneration, response decoration — Claude |
| Dyscalculia `_units` / `_labels` decoration (`household.ts`, `scenarios.ts`, `locations.ts`) | 3 | 5 / 95 | Zod envelope shaping, Claude |
| Dyslexia migration (16 call sites across 9 route files) | 9 | 0 / 100 | Mechanical `validateBody` replacement |
| Abbreviation script + location JSON touches | 8 | 10 / 90 | Script is Claude, content edits are script-driven; the 7 Mid-Atlantic JSONs are Justice's prior seed data |
| WCAG script + compliance HTML touches | 26 | 0 / 100 | Script is Claude; compliance HTML originated from earlier AI-generated tooling |
| Governance docs (SECURITY, METHODOLOGY, OPS, 3 ADRs, CHANGELOG) | 7 | 5 / 95 | Prose, ADR shape, IR runbook — Claude. Justice reviewed and accepted |
| CI / Docker / package.json | 3 | 15 / 85 | Workflow edits + Stripe pin, Claude; digest-pin *decision* was Justice's ask |

### Dimension 3: Security Auditing — 0 / 100 (cycle delta)

This PR is a remediation, not an audit, but each finding was verified fixed by Claude before landing. The audit-authorship attribution was already 5 / 95 in the prior report; nothing here moves it.

### Dimension 4: Remediation Implementation — 5 / 95 (cycle delta)

Prior baseline was 25 / 75. This cycle pushes hard in Claude's direction:

| Fix ID | Who Decided | Who Implemented |
|---|---|---|
| H-03 Redis password placeholder | Audit | Claude |
| H-05 `invalidateUserCache` + wiring | Audit | Claude (helper design + wire-up) |
| M-02 `.strict()` on feesSchema | Audit | Claude |
| L-02 sanitize depth/key caps | Audit | Claude |
| L-03 admin reindex mutex (409 on race) | Audit | Claude |
| L-04 `ContributionType` union | Audit | Claude |
| L-05 16 KB preferences PATCH cap | Audit | Claude |
| L-06 hard `take` caps on export | Audit | Claude |
| L-NEW-01 UUID validator on checkout `:id` | Audit | Claude |
| L-NEW-02 `ensureStripeCustomer` | Audit | Claude (design + impl) |
| M-NEW-01 production dev-bypass startup guard | Audit | Claude |
| F-202 Accept-Version: 2 + ADR-0003 | Audit flagged, Claude designed | Claude |
| F-203…F-208 `_units` / `_labels` cascades | Audit | Claude |
| F-006 / F-007 / F-011 / F-012 / F-013 dyslexia | Audit | Claude |
| WCAG 85 contrast + skip-nav | Audit | Claude (via `wcag-fix-html.mjs`) |
| SECURITY / METHODOLOGY / OPS / 3 ADRs / CHANGELOG | Justice (roadmap) | Claude |
| CI SBOM + strict-checks | Justice (ask) | Claude |
| Dockerfile digest-pin guidance | Justice (ask) | Claude |
| Stripe exact-pin | Audit | Claude |

### Dimension 5: Testing & Validation — 15 / 85 (cycle delta)

Small change this cycle: 14 new lines in `seed-data-integrity.test.ts` for the F-206 medicine-exemption rule. Typecheck + baseline run verified by Claude. No new test file, no coverage bump. The "did not regress" signal (webhook suite 16 → 15 failing) is the weakest form of verification — acceptable for this PR only because the failures are known pre-existing Stripe-mock issues.

### Dimension 6: Documentation — 10 / 90 (cycle delta)

Prior baseline was 30 / 70. This cycle is heavier on docs than any prior cycle (145-line METHODOLOGY, 132-line OPS, 3 ADRs totalling 139 lines, 88-line CHANGELOG entry, 144-line SECURITY rewrite) and Claude wrote all of them. Justice's contribution was the list of documents the LLM-compliance roadmap called for.

### Dimension 7: Domain Knowledge — 50 / 50 (cycle delta)

Unusual split for this project. The remediation didn't require Justice's ACA / FIRE / Monte Carlo expertise in the same way a feature cycle does. The domain content that *did* land — ADR-0002 describing the cliff-regime choice, METHODOLOGY.md's seed-data provenance — is Justice's existing knowledge captured into prose by Claude. Call it 50/50 because the knowledge is Justice's even though the keystrokes aren't.

---

## Cycle Delta Split

| Dimension | Justice | Claude |
|---|---|---|
| Architecture & Design | 25 | 75 |
| Code Generation | 5 | 95 |
| Security Auditing | 0 | 100 |
| Remediation Implementation | 5 | 95 |
| Testing & Validation | 15 | 85 |
| Documentation | 10 | 90 |
| Domain Knowledge | 50 | 50 |
| **Weighted cycle delta** | **~10** | **~90** |

Weights favour Code Generation, Remediation, and Documentation because those are the dimensions this PR actually moved.

---

## Commit-Level Look

- **`b03fd61 fix: close all audit-open findings (security + a11y + governance)`** — 66 files, +1 736 / -290. The entire remediation sweep. ~95 / 5 Claude / Justice by line count and decision count. Commit message is Claude-drafted using the audit finding IDs as an outline.
- **`2fb9f43 fix(wcag): include tools/dashboard.html in WCAG contrast + skip-nav pass`** — 1 file, +33 / -8. Follow-up for a file Justice's `git add` missed. Pure mechanical follow-through; attribution is Claude running the same script against the missed file.

---

## Grade Rationale (Cycle Delta)

**Grade: A-**

**What went well (A):**
- All 42 todo items closed in one cycle with zero regressions on the baseline test suite.
- Strong new architectural hygiene: ADRs now exist, CHANGELOG exists, METHODOLOGY exists, SECURITY has a real IR runbook instead of a placeholder.
- `validateBody()` and `getLabelsFor()` are genuine quality-of-life upgrades that reduce the chance of the same findings recurring.
- `expand-abbreviations.mjs` and `wcag-fix-html.mjs` are re-runnable — future audits can run them again to confirm no drift.
- The F-202 versioning design is forward-compatible (v1 stays default; v2 is opt-in per request) which is the hardest thing to get right.

**What held it back from A (the minus):**
- 67 files in one PR is genuinely hard to review. A human reviewer reading diff-by-diff is going to either (a) rubber-stamp or (b) miss things. The responsible split would have been: PR-A security (H / M / L findings + CI + Docker + Stripe pin), PR-B a11y (F-0xx + F-20x + WCAG), PR-C governance (SECURITY / METHODOLOGY / OPS / ADRs / CHANGELOG).
- The "15 failing baseline → 15 failing" signal is weak. A "no regressions" claim really wants a full green run, and the Stripe-mock failures have lived long enough that they deserve a fix of their own.
- Only 14 new lines of test for a change of this size. F-202 in particular — a new request-header contract — warrants an explicit versioning contract test.

---

## Cumulative Recompute

Blending the prior 2026-04-19 snapshot (30 cycles of pair-programming, 38/62, A-) with this cycle's 10/90 delta, weighted by approximate LOC-touched:

| Audit | Human % | AI % | Grade |
|---|---|---|---|
| 2026-04-02 (initial, pre-fix) | 46 | 54 | B+ |
| 2026-04-02 (post-fix) | 39 | 61 | A- |
| 2026-04-16 | 39 | 61 | A- |
| 2026-04-19 | 38 | 62 | A- |
| **2026-04-20 (this delta)** | **10** | **90** | **A-** |
| **2026-04-20 (cumulative, blended)** | **~25** | **~75** | **B+** |

The grade slipping from cumulative A- to cumulative B+ is a call the author wants to flag explicitly: the codebase itself is in better shape after this PR than before, but the delivery shape (one mega-PR) is one tick less mature than the 30 prior commits suggested the workflow was capable of. Reviewability is a quality attribute, not a style preference.

If the reader rejects that framing and scores purely on landed-code quality, the cumulative grade holds at A-.

---

## Key Insight

The prior report's "steady plateau at 38/62" was a signal of a well-tuned pair-programming loop. This cycle proves the loop can *also* run in pure triager-implementer mode when the input is an audit backlog rather than a feature request — and when it does, the split slides hard toward Claude.

That mode is efficient (42 items closed in one PR) but it's a different mode than the one the prior report was describing. Future audits should probably distinguish **feature-cycle split** (expect 38/62-ish) from **remediation-cycle split** (expect 10/90-ish) rather than blending them into one number.

---

## Recommendations

1. **Split audit-remediation PRs by audit dimension.** Security / a11y / governance are three different review skillsets. One reviewer rarely has all three, and one-PR-per-dimension lets the right reviewer read the right diff.
2. **Add a versioning contract test for F-202.** `GET /api/me/financial` with `Accept-Version: 1` vs. `: 2` vs. absent — lock the contract into CI so the next refactor can't silently flip the default.
3. **Fix the 15 webhook failures.** They've been failing across multiple cycles and they erode the value of "no regressions" as a merge signal.
4. **Run `expand-abbreviations.mjs` and `wcag-fix-html.mjs` in CI (check mode).** If they would make changes, fail the build. That turns the one-time cleanup into a standing invariant.
5. **Track remediation vs. feature cycles separately in the contribution ledger.** The 25/75 cumulative number is accurate but hides the bimodal distribution underneath.

---

## Notable Cycle Commits

- `b03fd61` — closes H-03, H-05, M-02, L-02…L-06, L-NEW-01, L-NEW-02, M-NEW-01, F-006, F-007, F-011, F-012, F-013, F-202…F-208, plus governance docs and CI hardening.
- `2fb9f43` — WCAG pass for the one file missed in `b03fd61`'s `git add`.

Co-Authored-By trailer present on both commits; future audits can trust the Claude attribution.
