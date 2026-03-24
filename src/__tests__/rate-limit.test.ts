import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { rateLimitConfig } from '../middleware/rate-limit.js';

describe('rateLimitConfig', () => {
  it('returns 30 for unauthenticated requests', () => {
    const request = {} as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(30);
  });

  it('returns 60 for free tier', () => {
    const request = { user: { tier: 'free' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(60);
  });

  it('returns 120 for basic tier', () => {
    const request = { user: { tier: 'basic' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(120);
  });

  it('returns 300 for premium tier', () => {
    const request = { user: { tier: 'premium' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(300);
  });

  it('returns 600 for admin tier', () => {
    const request = { user: { tier: 'admin' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(600);
  });

  it('returns 30 for unknown tier', () => {
    const request = { user: { tier: 'unknown' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(30);
  });

  it('keyGenerator uses userId when authenticated', () => {
    const request = { userId: 'user-123', ip: '127.0.0.1' } as FastifyRequest;
    expect(rateLimitConfig.keyGenerator(request)).toBe('user-123');
  });

  it('keyGenerator falls back to IP when unauthenticated', () => {
    const request = { userId: undefined, ip: '192.168.1.1' } as unknown as FastifyRequest;
    expect(rateLimitConfig.keyGenerator(request)).toBe('192.168.1.1');
  });

  it('errorResponseBuilder returns structured error', () => {
    const result = rateLimitConfig.errorResponseBuilder(
      {} as FastifyRequest,
      { ttl: 30000, max: 60 },
    );
    expect(result.error).toBe('Too many requests');
    expect(result.retryAfter).toBe(30);
    expect(result.limit).toBe(60);
  });
});
