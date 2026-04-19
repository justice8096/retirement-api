import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { rateLimitConfig, DEFAULT_LIMIT, TIER_LIMITS } from '../middleware/rate-limit.js';

describe('rateLimitConfig', () => {
  it('returns DEFAULT_LIMIT for unauthenticated requests', () => {
    const request = {} as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(DEFAULT_LIMIT);
  });

  it('returns TIER_LIMITS.free for free tier', () => {
    const request = { user: { tier: 'free' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(TIER_LIMITS.free);
  });

  it('returns TIER_LIMITS.basic for basic tier', () => {
    const request = { user: { tier: 'basic' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(TIER_LIMITS.basic);
  });

  it('returns TIER_LIMITS.premium for premium tier', () => {
    const request = { user: { tier: 'premium' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(TIER_LIMITS.premium);
  });

  it('returns TIER_LIMITS.admin for admin tier', () => {
    const request = { user: { tier: 'admin' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(TIER_LIMITS.admin);
  });

  it('returns DEFAULT_LIMIT for unknown tier', () => {
    const request = { user: { tier: 'unknown' } } as FastifyRequest;
    expect(rateLimitConfig.max(request)).toBe(DEFAULT_LIMIT);
  });

  it('keyGenerator uses userId when authenticated', () => {
    const request = { userId: 'user-123', ip: '127.0.0.1' } as FastifyRequest;
    expect(rateLimitConfig.keyGenerator(request)).toBe('user-123');
  });

  it('keyGenerator falls back to IP when unauthenticated', () => {
    const request = { userId: undefined, ip: '192.168.1.1' } as unknown as FastifyRequest;
    expect(rateLimitConfig.keyGenerator(request)).toBe('192.168.1.1');
  });

  it('errorResponseBuilder returns an Error with structured fields', () => {
    const result = rateLimitConfig.errorResponseBuilder(
      {} as FastifyRequest,
      { ttl: 30000, max: 60, statusCode: 429, after: '30s' },
    ) as Error & { statusCode: number; retryAfter: number; limit: number };
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Too many requests');
    expect(result.statusCode).toBe(429);
    expect(result.retryAfter).toBe(30);
    expect(result.limit).toBe(60);
  });
});
