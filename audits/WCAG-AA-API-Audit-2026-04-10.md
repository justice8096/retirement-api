# WCAG 2.1 AA Accessibility Audit Report
## Retirement API (Node.js/TypeScript/Fastify)
**Date:** April 10, 2026 (Updated)
**Scope:** Backend API + 29 static HTML files (compliance docs, interactive tools, dashboard)
**Overall Status:** NON-COMPLIANT with WCAG 2.1 AA
**Estimated Remediation:** 20-30 hours

---

## Executive Summary

The core REST API handles JSON responses (not subject to WCAG), but serves 29 HTML files containing compliance documentation, interactive assessment tools, and a dashboard. These HTML files have significant accessibility issues, primarily color contrast failures, missing form labels, and semantic HTML gaps.

---

## Critical Issues

### 1. Insufficient Color Contrast Across All HTML Files (1.4.3)

**Files:** compliance/docs/index.html, compliance/tools/interactive/*.html (23 files), tools/dashboard.html

| Element | Color | Background | Ratio | Required | Status |
|---------|-------|-----------|-------|----------|--------|
| Paragraph text | #8A9BAD | #060E1A | 3.5:1 | 4.5:1 | FAIL |
| Nav/footer links | #6B7B8D | #060E1A | 2.8:1 | 4.5:1 | FAIL |
| Footer text | #3A4A5A | #060E1A | 1.2:1 | 3:1 | FAIL |
| Dashboard labels | #8B9DC3 | #0B1426 | 2.2:1 | 4.5:1 | FAIL |

**Fix:** Update color palette — `p { color: #D8DCE4; }` / `nav a { color: #9FC8FF; }` / `footer p { color: #8A9BAD; }`

---

## Major Issues

### 2. Missing Form Labels and `for` Attributes (1.3.1, 3.3.2)

**Files:** tools/dashboard.html, compliance/tools/interactive/*.html

**Issue:** `<label>` elements not associated to controls via `for` attribute. Programmatically-created selects in shared.js lack aria-label.

**Fix:** Add `for` attributes matching input `id`s; update shared.js `createSelect()` to generate proper label-input associations.

### 3. Missing Alt Text / ARIA on Decorative Elements (1.1.1)

**Files:** compliance/docs/index.html (color legend dots), world-map.html (D3 SVG map)

**Fix:** Add `role="img" aria-label="..."` to color legend items. Add `<title>` and `<desc>` to SVG map.

### 4. API Responses Lack Accessibility Metadata (Best Practice)

**Endpoints:** GET /api/locations, GET /api/me/household, GET /api/me/scenarios

**Recommendation:** Add optional `_a11y` field with `description` and `ariaLabel` to help frontends render accessible content.

---

## Minor Issues

### 5. Missing Skip Navigation Links (2.4.1)
**Files:** index.html, world-map.html, dashboard.html — no skip-to-content link.

### 6. Non-Semantic HTML Structure (1.3.1, 4.1.2)
**Issue:** Nav uses `<div class="links">` instead of `<ul>`; cards use `<div>` instead of `<article>`; tabular data in div grids instead of `<table>`.

### 7. Missing Content-Language HTTP Header (3.1.1)
**Issue:** HTML files declare `<html lang="en">` but server doesn't send `Content-Language` header.

**Fix:** Add Fastify hook:
```typescript
app.addHook('onSend', (request, reply, payload, done) => {
  const ct = reply.getHeader('content-type');
  if (typeof ct === 'string' && ct.includes('text/html')) {
    reply.header('Content-Language', 'en');
  }
  done(null, payload);
});
```

---

## Remediation Priority

**Phase 1 (Critical — 8 hrs):** Fix color contrast across all 29 HTML files
**Phase 2 (Major — 10 hrs):** Add form label associations; SVG/map aria-labels; skip links
**Phase 3 (Minor — 6 hrs):** Semantic HTML; Content-Language header; API a11y metadata

---

## Compliance Summary

| Issue | WCAG | Severity | Files Affected |
|-------|------|----------|---------------|
| Color contrast | 1.4.3 AA | CRITICAL | 28 HTML files |
| Form labels | 1.3.1/3.3.2 A | MAJOR | 25 HTML files |
| Alt text/ARIA | 1.1.1 A | MAJOR | 10 HTML files |
| Skip navigation | 2.4.1 A | MINOR | 3 HTML files |
| Semantic HTML | 1.3.1/4.1.2 A | MINOR | 28 HTML files |
| Content-Language | 3.1.1 A | MINOR | All HTML |
