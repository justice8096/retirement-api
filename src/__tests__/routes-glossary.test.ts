/**
 * Tests for the public glossary route (GET /api/glossary).
 *
 * Added alongside the CAPE strategy-persistence work: the Angular
 * withdrawal screen maps strategy `cape` to glossary key `cape`
 * (STRATEGY_GLOSSARY_KEY) and titles the card "CAPE-Based (Shiller PE)" —
 * these tests pin the server-side definition and its lookup aliases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import glossaryRoutes from '../routes/glossary.js';

describe('Glossary routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(glossaryRoutes, { prefix: '/api/glossary' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists all terms with a count', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/glossary' });
    const body = JSON.parse(res.payload);

    expect(res.statusCode).toBe(200);
    expect(body.count).toBe(body.terms.length);
    expect(body.count).toBeGreaterThan(0);
  });

  it('defines a cape entry with the standard plain/example/technical shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/glossary?key=cape' });
    const body = JSON.parse(res.payload);

    expect(res.statusCode).toBe(200);
    expect(body.key).toBe('cape');
    // The dashboard's strategy card is titled "CAPE-Based (Shiller PE)";
    // both names must resolve to this entry via aliases.
    expect(body.aliases).toContain('CAPE');
    expect(body.aliases).toContain('Shiller PE');
    expect(body.plain).toBeTruthy();
    expect(body.example).toBeTruthy();
    expect(body.technical).toBeTruthy();
    expect(Array.isArray(body.seeAlso)).toBe(true);
  });

  it('404s with a plain-language envelope for unknown keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/glossary?key=nope' });
    const body = JSON.parse(res.payload);

    expect(res.statusCode).toBe(404);
    expect(body.fieldLabel).toBe('Glossary term key');
  });
});
