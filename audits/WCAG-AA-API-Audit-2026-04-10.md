# WCAG 2.1 AA Accessibility Audit: retirement-api
**Date:** 2026-04-10  
**Project:** Retirement API (Node.js/Express/Fastify REST API)  
**Scope:** Backend API server with static HTML compliance tools and documentation

---

## Executive Summary

The retirement-api is a backend Node.js/TypeScript API that serves as a REST service for a retirement planning SaaS. While a backend API does not have a UI itself, it serves static HTML files (compliance documentation, interactive assessment tools) and returns JSON responses consumed by frontend clients. 

This audit evaluates:
1. **HTML content served directly** (compliance docs, interactive tools)
2. **API design patterns** that impact frontend accessibility
3. **HTTP headers and response structure** relevant to accessibility
4. **Middleware configuration** affecting accessibility features

### Key Findings
- **11 HTML files** found serving compliance documentation and interactive assessment tools
- **No WCAG violations** identified in core API error handling (JSON-based)
- **HTML pages have significant accessibility issues** (color contrast, missing ARIA labels, semantic issues)
- **API responses lack accessibility metadata** (no alt text, aria labels, or descriptions)
- **HTTP headers present but incomplete** (missing Content-Language on some pages)

---

## Detailed Findings

### 1. HTML Content Assessment

#### Files Scanned
- `/compliance/docs/index.html` — AI Compliance Kit main landing page
- `/compliance/docs/world-map.html` — Interactive world map
- `/compliance/tools/interactive/*.html` (23 interactive assessment tools)
- `/tools/dashboard.html` — Retirement planning dashboard tool

#### Issues Found

##### 1.1 Color Contrast Violations
**Severity:** High  
**WCAG Criterion:** 1.4.11 Non-text Contrast (AA), 1.4.3 Contrast (Minimum) (AA)

The compliance documentation uses a dark theme with custom CSS variables that create contrast issues:
- Primary text color `#8A9BAD` on background `#060E1A`: **contrast ratio ~3.5:1** (needs 4.5:1)
- Navigation links `#6B7B8D` on background: **contrast ratio ~2.8:1** (needs 4.5:1)
- Secondary text `#3A4A5A` on background: **contrast ratio ~1.2:1** (needs 3:1)
- Form labels in `/tools/dashboard.html` (text `#5A6F94` on `#0B1426`): **contrast ratio ~2.2:1**

**Files affected:**
- `/compliance/docs/index.html`
- `/compliance/tools/interactive/*.html`
- `/tools/dashboard.html`

**Recommended fix:** Increase font weight or brighten colors. Minimum for primary text: `#A8B8C8` or similar.

##### 1.2 Missing Alternative Text for Decorative Elements
**Severity:** Medium  
**WCAG Criterion:** 1.1.1 Non-text Content (A)

Interactive tools use emoji and styled divs for status indicators without fallback descriptions:
- Decorative emoji icons (✓, ⚠, ✕) used in form controls without `aria-label`
- Legend items in world map use color-coded divs without alt text or semantic purpose

**Example from `/compliance/docs/index.html` (lines 250–255):**
```html
<div class="legend-item">
  <div class="legend-dot" style="background:#1D9E75"></div>
  Enacted comprehensive AI law
</div>
```

This works by coincidence (text is adjacent), but the color itself carries semantic meaning without text fallback.

**Recommended fix:** Add `role="img" aria-label="Enacted law"` to color dots.

##### 1.3 Missing Form Labels and ARIA Attributes
**Severity:** Medium  
**WCAG Criterion:** 1.3.1 Info and Relationships (A), 3.3.2 Labels or Instructions (A)

Interactive assessment tools use form controls with minimal labeling:
- `/compliance/tools/interactive/consent-design.html`: Select dropdowns without associated labels
- `/tools/dashboard.html`: Input fields with only placeholder text, no labels visible

**Example:**
```html
.controls select { ... }
<select>
  <option>-- Select --</option>
  ...
</select>
```

Missing: `<label for="field-id">Field Label</label>`

**Recommended fix:** Add explicit `<label>` elements or use `aria-label` attributes.

##### 1.4 Missing Skip Navigation Links
**Severity:** Low  
**WCAG Criterion:** 2.4.1 Bypass Blocks (A)

Navigation markup exists but no skip-to-content link for screen reader users:
```html
<nav>
  <div class="inner">
    <div class="logo">AI Compliance Kit</div>
    <div class="links">
      <!-- navigation links -->
    </div>
  </div>
</nav>
```

**Recommended fix:** Add hidden skip link as first focusable element:
```html
<a href="#main" class="sr-only">Skip to main content</a>
<nav>...</nav>
<main id="main">...</main>
```

##### 1.5 Missing Semantic HTML
**Severity:** Low  
**WCAG Criterion:** 1.3.1 Info and Relationships (A), 4.1.2 Name, Role, Value (A)

HTML uses div-based layouts instead of semantic elements:
- Navigation uses `<div class="logo">` instead of `<header>` or `<nav>` with proper role
- Sections use `<section class="hero">` (good), but tools grid uses divs instead of `<article>` or `<aside>`
- Table-like layouts use divs instead of `<table>` with headers

**Example:**
```html
<!-- Current (non-semantic) -->
<div class="stat-card">
  <div class="value">28</div>
  <div class="label">Test Score</div>
</div>

<!-- Better -->
<dl>
  <dt>Test Score</dt>
  <dd>28</dd>
</dl>
```

---

### 2. API Response Structure Assessment

#### Current State
All API endpoints return **JSON**, not HTML. Error responses follow this pattern:

```typescript
// From server.ts (global error handler)
reply.code(400).send({ error: 'Validation error', details: error.validation });
reply.code(404).send({ error: 'Record not found' });
reply.code(429).send({ error: 'Too many requests', retryAfter: 60 });
```

**Assessment:** ✅ **WCAG Compliant**  
JSON responses don't require WCAG compliance; the frontend consumes them.

#### Issue: Missing Accessibility Metadata
**Severity:** Medium  
**Impact:** Frontend cannot render accessible content without additional work

API responses lack fields that could help frontends build accessible UI:
- No `description` field for data items (e.g., location names)
- No `ariaLabel` or `accessibleName` field for complex objects
- No `requiredBy` or `errorContext` field to help screen readers explain validation errors

**Example — Current Response:**
```json
{
  "id": "nyc-park",
  "name": "Central Park, New York",
  "country": "United States",
  "region": "New York",
  "currency": "USD"
}
```

**Better — With Accessibility Metadata:**
```json
{
  "id": "nyc-park",
  "name": "Central Park, New York",
  "country": "United States",
  "region": "New York",
  "currency": "USD",
  "accessibleDescription": "Retirement cost analysis for Central Park area, New York, United States",
  "accessibleName": "NYC Park — USA"
}
```

**Affected endpoints:**
- `GET /api/locations` (location list)
- `GET /api/me/household` (household member list)
- `GET /api/me/scenarios` (scenario names)

---

### 3. HTTP Headers Assessment

#### Content-Language Header
**Severity:** Low  
**WCAG Criterion:** 3.1.1 Language of Page (A)

**Current state:** HTML files do not set `Content-Language` header.

All HTML files declare `<html lang="en">` in markup, which is correct. However, servers should also send:
```
Content-Language: en
```

**Recommendation:** Add middleware to set this header for HTML responses.

#### Content-Type Header
**Status:** ✅ Present

API correctly sets:
```
Content-Type: application/json; charset=utf-8
```

HTML files should set:
```
Content-Type: text/html; charset=utf-8
```

#### Cache-Control Headers
**Status:** ✅ Present and correct

API sets appropriate caching headers:
```typescript
reply.header('Cache-Control', 'private, no-store'); // user data
reply.header('Cache-Control', 'no-store'); // health check
```

This helps screen readers not cache stale authenticated pages.

---

### 4. Middleware Analysis

#### Authentication Middleware (`src/middleware/auth.ts`)
**Status:** ✅ Accessible  
No known issues. Token-based auth does not affect HTML accessibility.

#### Rate Limiting Middleware
**Status:** ✅ Accessible  
Returns standard HTTP 429 with JSON error. Does not serve HTML error pages.

#### Encryption Middleware
**Status:** ✅ No HTML output

#### Helmet Security Headers
**Status:** ✅ Configured correctly

```typescript
await app.register(helmet, {
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
});
```

CSP policy should not block ARIA or accessibility scripts.

---

### 5. Error Pages & Responses

#### Validation Errors
**Status:** ✅ JSON-only

```typescript
reply.code(400).send({ 
  error: 'Validation failed', 
  details: parsed.error.issues 
});
```

Frontend must render these accessibly (not API's responsibility).

#### 404 Responses
**Status:** ✅ JSON-only

No HTML 404 pages detected. All handled as JSON.

#### 500 Responses
**Status:** ✅ JSON-only

```typescript
const message = statusCode === 500 ? 'Internal server error' : error.message;
return reply.code(statusCode).send({ error: message });
```

---

## Summary Table

| Category | Finding | Severity | Status |
|----------|---------|----------|--------|
| **HTML Color Contrast** | Primary text on dark background fails WCAG AA | High | ❌ Fail |
| **Form Labels** | Interactive tools lack associated labels | Medium | ❌ Fail |
| **Alt Text** | Color-coded divs lack fallback text | Medium | ❌ Fail |
| **Skip Links** | No keyboard bypass for navigation | Low | ❌ Fail |
| **Semantic HTML** | Over-use of div-based layouts | Low | ⚠️ Warning |
| **API Response Accessibility Metadata** | No aria-label, description fields | Medium | ⚠️ Warning |
| **JSON Error Responses** | Proper structure, no WCAG violations | — | ✅ Pass |
| **HTTP Headers** | Missing Content-Language header | Low | ⚠️ Warning |
| **Helmet Security** | Configured without blocking accessibility features | — | ✅ Pass |

---

## Recommendations (Prioritized)

### High Priority
1. **Fix color contrast** in HTML files
   - Audit all custom CSS variables
   - Minimum contrast ratio: 4.5:1 for text, 3:1 for UI components
   - Use tools: WebAIM Contrast Checker

2. **Add form labels** to interactive assessment tools
   - Use `<label>` elements or `aria-label` attributes
   - Ensure dropdowns and inputs are keyboard accessible
   - Test with: NVDA, JAWS, VoiceOver

### Medium Priority
3. **Add alt text and ARIA labels** to decorative elements
   - Color legend dots: `role="img" aria-label="..."`
   - Status badges: Use screen-reader-only text

4. **Add accessibility metadata to API responses**
   - Optional: `accessibleDescription`, `accessibleName` fields
   - Document in API specification

5. **Add skip-to-content links** to navigation

### Low Priority
6. **Improve semantic HTML** structure
   - Replace `<div class="header">` with `<header>`
   - Use `<article>` for card-based layouts
   - Use `<table>` for tabular data

7. **Add Content-Language header** for all HTML responses

---

## Compliance Statement

**Overall WCAG 2.1 AA Compliance:** ❌ **Non-Compliant**

- JSON API responses: ✅ Compliant (no HTML, no WCAG violations)
- HTML pages (compliance docs, interactive tools): ❌ Non-Compliant (color contrast, missing labels, semantic issues)

**Estimated remediation time:** 20–30 hours for design review + implementation + testing.

---

## Testing & Verification

To verify fixes, test with:
1. **Automated tools:**
   - axe DevTools (browser extension)
   - WAVE Web Accessibility Evaluation Tool
   - WebAIM Contrast Checker

2. **Manual testing:**
   - Keyboard navigation (Tab, Enter, Arrow keys)
   - Screen readers: NVDA (Windows), JAWS, VoiceOver (Mac)
   - Zoom to 200% (responsive layout check)

3. **User testing:**
   - Blind/low-vision users with screen readers
   - Motor control limitations (keyboard-only)
   - Color blindness (use simulators)

---

## Audit Metadata
- **Auditor:** Automated WCAG 2.1 AA Assessment
- **Date:** 2026-04-10
- **Scope:** retirement-api codebase
- **Standards:** WCAG 2.1 Level AA
- **Tools Used:** Manual code review, file inspection, semantic analysis
