# ADR 0003 — API versioning for percent-encoding wire format

**Status:** Accepted — 2026-04-20. Opt-in via `Accept-Version: 2` header.
Default = 1 for backward compatibility.
**Decision owner:** @justice8096

## Context
The API emits percentage-shaped values in two conventions depending on
history:
- **Whole-number percent** — `financial.ts` (`equityPct: 60`), `fees.ts`
  (`brokerageFeePct: 0.5`). DB stores fractions; the route multiplies by 100
  on read and divides on write.
- **Decimal fraction** — `withdrawal.ts` (`withdrawalRate: 0.04`). No
  conversion.

Dashboard Dyscalculia audits F-001 / F-202 (2026-04-16 and -19) flagged
this as a cognitive-load defect: a dyscalculic reader (and the developer
integrating the API) must remember per-field which convention applies.

## Alternatives considered
- **Big-bang rewrite** to fractions — rejected: every dashboard call site,
  scenario export, and cached payload would need to flip on the same deploy.
- **Migrate only on write, leave reads whole-number** — rejected: the schism
  remains and re-inverts the documentation burden.
- **URL-path versioning (`/v2/api/me/financial`)** — rejected: doubles the
  router surface, makes the "only thing that differs" (wire encoding) look
  like two separate APIs.

## Decision
- Introduce an `Accept-Version: 2` request header. The value is parsed in
  the global `onRequest` hook and exposed as `request.apiVersion ∈ {1, 2}`.
- `financial.ts` and `fees.ts` gate their percentage conversion on
  `apiVersion`:
  - v1 (default): whole-number percents on the wire (existing behaviour).
  - v2: decimal fractions everywhere.
- Every v2 response carries an `X-API-Version: 2` response header so
  consumers can cross-check.
- The `_units` envelope's `encoding` and `meaning` fields are regenerated
  per request so the metadata always matches the body.
- `withdrawal.ts` is already fractions — no gating needed.

## Consequences
- Clients (dashboard, scenarios export, AI assistants) migrate at their own
  pace. The default remains v1 until every known consumer is on v2.
- Cache Key — when a CDN fronts the API, `Accept-Version` must be in the
  cache key. Currently no CDN in the path, so deferred.
- Sunset — v1 will be retired after a 6-month deprecation window begins (TBD,
  tracked separately). `X-API-Deprecated` response header will announce the
  retirement date when the window opens.

## References
- Dyscalculia audit F-202 (2026-04-19).
- `src/server.ts` onRequest hook.
- `src/routes/financial.ts` + `src/routes/fees.ts`.
