# ADR 0001 — Runtime stack: Fastify 5 + Prisma 6 + PostgreSQL

**Status:** Accepted — 2026-04-19
**Decision owner:** @justice8096

## Context
The API needs a TypeScript HTTP server with strong schema validation, a
production-grade ORM against PostgreSQL, and first-class streaming + hook
semantics for request-lifecycle concerns (auth, rate-limit, audit, locale).

## Alternatives considered
- **Express + TypeORM** — the incumbent in the Node ecosystem. Rejected:
  Express 4 has no native async-error propagation; TypeORM's migration
  story is weaker than Prisma's.
- **Nest.js** — opinionated DI framework over Express/Fastify. Rejected:
  the module-boundary overhead doesn't pay for a ~20-route API, and the
  decorator-heavy surface is harder for dyslexic readers per BDA guidance.
- **Hono / Elysia** — promising micro-frameworks. Rejected as of 2026-04:
  smaller plugin ecosystems, and Clerk's official Node SDK targets Fastify.

## Decision
- **Fastify 5** for HTTP routing, hooks, plugins, and error handling.
  `@fastify/swagger` + `@fastify/swagger-ui` provide OpenAPI automation.
- **Prisma 6** for the ORM layer. Single source of truth (`prisma/schema.prisma`)
  generates both TypeScript types and SQL migrations.
- **PostgreSQL 15+** for the database. JSONB columns for flexible blobs
  (`preferences`, `scenarioData`, `groceryData`) alongside strongly-typed
  relational columns for indexed access.
- **Zod** for every request-body / query-param schema, with `.strict()` by
  default to reject unknown keys.

## Consequences
- Strong IDE support via Prisma-generated types and Zod inference.
- Required: careful handling of Prisma `Decimal` string-arrival in arithmetic
  paths (see `Number(x)` guard idiom in every numeric route).
- Required: Fastify's async-hook model means every `preHandler` must either
  `return` or mutate `reply`; easy to get wrong, so the `requireAuth` /
  `requireAdmin` factories encapsulate the pattern.

## Follow-ups
- When Angular 19 dashboard moves off whole-number-percent wire-encoding
  (v2 contract per ADR 0003), the Fastify `Accept-Version` onRequest hook
  controls the switch.
