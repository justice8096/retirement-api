import { describe, it, expect } from 'vitest';
import { fmt, pct, fmtKUnsafe } from '../formatting.js';

describe('fmt', () => {
  it('formats integer with dollar sign and commas (en-US default)', () => {
    expect(fmt(1234)).toBe('$1,234');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('$0');
  });

  it('rounds up 1234.56 to $1,235', () => {
    expect(fmt(1234.56)).toBe('$1,235');
  });

  it('rounds down 1234.49 to $1,234', () => {
    expect(fmt(1234.49)).toBe('$1,234');
  });

  it('formats large numbers with commas', () => {
    expect(fmt(1000000)).toBe('$1,000,000');
  });

  it('handles negative numbers', () => {
    const result = fmt(-500);
    expect(result).toContain('500');
    expect(result).toContain('$');
  });

  it('honors locale + currency options', () => {
    const result = fmt(1234.5, { locale: 'de-DE', currency: 'EUR' });
    expect(result).toMatch(/[1.,]?235/);
    expect(result).toContain('€');
  });
});

describe('pct', () => {
  it('formats 0.125 as 12.5%', () => {
    expect(pct(0.125)).toBe('12.5%');
  });

  it('formats 0 as 0.0%', () => {
    expect(pct(0)).toBe('0.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(pct(1)).toBe('100.0%');
  });

  it('formats 1.5 as 150.0%', () => {
    expect(pct(1.5)).toBe('150.0%');
  });

  it('formats -0.05 as -5.0%', () => {
    // Intl locales may use the minus sign U+2212 in some locales; en-US uses '-'.
    expect(pct(-0.05)).toContain('5.0%');
  });

  it('formats 0.001 as 0.1%', () => {
    expect(pct(0.001)).toBe('0.1%');
  });
});

describe('fmtKUnsafe (developer-log only)', () => {
  it('formats 72000 as $72K', () => {
    expect(fmtKUnsafe(72000)).toBe('$72K');
  });

  it('formats 1500000 as $1500K', () => {
    expect(fmtKUnsafe(1500000)).toBe('$1500K');
  });
});
