import { describe, expect, test } from 'vitest';
import {
  buildDemoUsername,
  createDemoLoginEmail,
  deriveInitials,
  isSupabaseCredentialError,
  validateContactEmail,
  validateDemoCompanyName,
  validateDemoName,
} from './demoAccess.js';

describe('demo access helpers', () => {
  test('accepts normal visitor contact email', () => {
    expect(validateContactEmail(' User.Name+demo@example.com ')).toBe('user.name+demo@example.com');
  });

  test('rejects invalid visitor contact email', () => {
    expect(() => validateContactEmail('not-an-email')).toThrow('A valid e-mail is required for demo access.');
  });

  test('creates stable demo identifiers without exposing contact email', () => {
    const suffix = '20260510abc123';
    expect(buildDemoUsername(suffix)).toBe('demo_20260510abc123');
    expect(createDemoLoginEmail('demo.example.com', suffix)).toBe('demo+20260510abc123@demo.example.com');
  });

  test('detects demo status from app metadata only', async () => {
    const { isDemoUser } = await import('./demoAccess.js');
    expect(isDemoUser({ app_metadata: { is_demo: true }, user_metadata: {} })).toBe(true);
    expect(isDemoUser({ app_metadata: {}, user_metadata: { is_demo: true } })).toBe(false);
  });

  test('normalises the name and company from the demo welcome step', () => {
    expect(validateDemoName('  Mette   Bak Jensen ')).toBe('Mette Bak Jensen');
    expect(validateDemoCompanyName(' Byggefirma  A/S ')).toBe('Byggefirma A/S');
  });

  test('rejects blank or oversized demo welcome input', () => {
    expect(() => validateDemoName(' M ')).toThrow('Navn skal være mellem 2 og 80 tegn.');
    expect(() => validateDemoName(undefined)).toThrow('Navn skal være mellem 2 og 80 tegn.');
    expect(() => validateDemoName('x'.repeat(81))).toThrow('Navn skal være mellem 2 og 80 tegn.');
    expect(() => validateDemoCompanyName('x'.repeat(121))).toThrow('Firmanavn skal være mellem 2 og 120 tegn.');
  });

  test('derives initials from the visitor name', () => {
    expect(deriveInitials('Mette Bak Jensen')).toBe('MJ');
    expect(deriveInitials('Byggefirma')).toBe('BY');
    expect(deriveInitials('')).toBe('DB');
  });

  test('classifies invalid Supabase admin credentials as server configuration', () => {
    expect(isSupabaseCredentialError(new Error('Invalid API key'))).toBe(true);
    expect(isSupabaseCredentialError({ message: 'JWT expired' })).toBe(true);
    expect(isSupabaseCredentialError(new Error('duplicate key value violates unique constraint'))).toBe(false);
  });
});
