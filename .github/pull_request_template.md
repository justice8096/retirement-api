<!-- PR template. Delete sections that don't apply. -->

## Summary
<!-- What this PR does and why. One or two sentences. -->

## Change type
- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / cleanup
- [ ] Security
- [ ] Docs / audits
- [ ] Dependency bump
- [ ] Other

## Test plan
- [ ] `npm run typecheck` clean
- [ ] `npm test` passes (or noted delta vs baseline)
- [ ] `npm run test:shared` passes
- [ ] Manual verification (describe):
- [ ] No new audit findings introduced

## Audit impact
<!-- If this touches security, accessibility, or governance, name the
finding / ADR / audit section that applies. -->

## Breaking changes
- [ ] No breaking changes
- [ ] Breaking change — describe migration:

## Checklist
- [ ] No secrets added (grep for `sk_live_`, `whsec_live_`, etc.)
- [ ] No silent downgrades to existing security posture
- [ ] `CHANGELOG.md` updated if user-visible behavior changed
