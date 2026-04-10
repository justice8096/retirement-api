---
name: Post-Commit Audit
description: >-
  This skill should be used when the user asks to "post-commit audit", "audit last commit",
  "review my commit", "check what I just committed", "audit recent changes",
  "post-commit review", "commit audit", "verify commit quality",
  "check commit for issues", "review recent commits", "audit HEAD",
  or mentions reviewing changes after committing for security, quality, or compliance.
version: 1.0.0
---

# Post-Commit Audit

Reviews the most recent commit(s) for security issues, code quality, compliance gaps, and adherence to project conventions. Designed to catch problems immediately after committing, before pushing.

## When to Use

- After making a commit, before pushing
- After merging a branch
- When reviewing recent changes for security or quality issues
- As a pre-push sanity check

## Audit Procedure

### 1. Identify Changes

Run from the project root:

```bash
git log --oneline -5
git diff HEAD~1 --stat
git diff HEAD~1 --name-only
```

If the user specifies a commit range, use that instead of `HEAD~1`.

### 2. Security Scan

For each changed file, check:

- **Secrets**: No hardcoded API keys, tokens, passwords, or connection strings (Stripe live/test keys, webhook secrets, encryption keys, database URLs)
- **Auth gaps**: Any new route in `src/routes/` has appropriate auth middleware (JWT for `/api/me/*`, admin guard for `/api/admin/*`)
- **Input validation**: New endpoints have Zod schema validation on request body/params
- **SQL injection**: No raw SQL — all queries through Prisma ORM
- **Data isolation**: Prisma queries include `where: { userId }` or equivalent ownership check (prevent IDOR)
- **Financial data**: Any new fields handling money/PIA/portfolio use AES-256-GCM encryption via the encryption middleware
- **XSS prevention**: No unsafe HTML rendering with user-supplied data in React components
- **Code execution**: No dynamic code execution patterns with untrusted input

Use the Grep tool to scan changed files for secret patterns (case-insensitive):
- `password`, `secret`, `api_key`, `token`, `private_key`
- Prisma queries without `userId` constraint

### 3. Code Quality

For each changed file, check:

- **TypeScript strict mode**: No `any` types added, no `@ts-ignore` without justification
- **Error handling**: New async routes have proper try/catch or Fastify error handling
- **Logging**: No `console.log` left in production code (use Fastify logger)
- **Tests**: If a new route or shared function was added, corresponding tests should exist
- **Dependencies**: If `package.json` changed, verify no unnecessary or deprecated packages added

### 4. Schema & Migration Check

If `prisma/schema.prisma` was modified:

- Verify a migration was created (`prisma/migrations/` has a new directory)
- Check cascade delete rules on new relations (important for GDPR deletion)
- Sensitive financial fields should be typed as `String` (encrypted at rest), not `Float`/`Decimal`
- New models should have `userId` or relation to `User` for data isolation

### 5. Data Integrity

If files in `data/` or `prisma/seed.ts` were modified:

- Location JSON files have all required fields (verify against existing location schema)
- Seed data doesn't contain test/dummy financial values that could leak to production
- No duplicate location entries

### 6. Compliance Check

For changes touching user data:

- **GDPR**: New user data fields are included in the data export endpoint (`/api/me` GDPR export)
- **GDPR**: New user data is covered by cascade delete on account deletion
- **Financial disclaimer**: No changes imply financial advice without appropriate disclaimers
- **Encryption**: New fields storing financial data use the encryption middleware

### 7. Commit Message Quality

Check the commit message:
- Is it descriptive of the actual changes?
- Does it follow the project's commit message conventions?
- For breaking changes, is there a clear note?

## Report Format

```
## Post-Commit Audit: <commit hash short>

### Summary
<one-line description of what the commit does>

### Files Changed
<list of changed files>

### Findings

#### CRITICAL (block push)
- [C1] file:line - Description. Fix: ...

#### WARNING (fix before merge to master)
- [W1] file:line - Description. Fix: ...

#### INFO (non-blocking suggestions)
- [I1] file:line - Description.

### Passed Checks
- [P1] No hardcoded secrets detected
- [P2] Auth middleware present on new routes
- ...

### Verdict
PASS / PASS WITH WARNINGS / FAIL (do not push)
```
