---
name: API Documentation
description: >-
  This skill should be used when the user asks to "generate API docs",
  "create OpenAPI spec", "create Swagger docs", "document endpoints",
  "API documentation", "generate API reference", "list all routes",
  "document the API", or mentions creating developer documentation
  for the REST API.
version: 1.0.0
---

# API Documentation

Generate OpenAPI 3.1 specification and developer documentation from the Fastify API routes.

## When to Use

- After implementing new API endpoints
- When onboarding developers to the API
- Before publishing API for third-party consumption
- When Swagger/OpenAPI spec is needed for client generation

## Documentation Scope

### Route Inventory

Read all files in `packages/api/src/routes/` and catalog:
- HTTP method + path
- Auth requirement (none / authenticated / admin)
- Request body schema (from Zod definitions)
- URL parameters and query strings
- Response schema (success + error shapes)
- Rate limiting tier

### OpenAPI Spec Generation

Create `packages/api/openapi.yaml` with:

```yaml
openapi: 3.1.0
info:
  title: Retirement Planning SaaS API
  version: 1.0.0
  description: Multi-user retirement cost comparison, projection, and simulation API
servers:
  - url: http://localhost:3000
    description: Local development
paths:
  /api/health:
    get: ...
  /api/locations:
    get: ...
  # ... all routes
components:
  schemas:
    Location: ...
    HouseholdProfile: ...
    # ... from Prisma models
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Endpoint Categories

1. **Public** (no auth): `/api/health`, `/api/locations/*`
2. **Authenticated** (JWT required): `/api/me/*`
3. **Admin** (JWT + admin role): `/api/admin/*`

### Response Shapes

Document standard response envelopes:
- Success: `{ data: ... }` or direct object
- Validation error: `{ error: { fieldErrors: {}, formErrors: [] } }`
- Auth error: `{ error: "Unauthorized" }` (401)
- Not found: `{ error: "Not found" }` (404)
- Server error: `{ error: "Internal server error" }` (500)

## Key Files

- `packages/api/src/routes/*.js` — Route definitions
- `packages/api/src/server.js` — Server config, middleware
- `packages/api/prisma/schema.prisma` — Data models
- `packages/api/openapi.yaml` — Output spec (to create)
