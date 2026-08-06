import { describe, it, expect } from 'vitest';
import { loginErrorMessage } from './messages';

describe('loginErrorMessage', () => {
  it('maps invalid credentials to a Danish message', () => {
    expect(loginErrorMessage('Invalid login credentials')).toBe('Forkert e-mail eller adgangskode.');
  });
  it('maps unconfirmed email', () => {
    expect(loginErrorMessage('Email not confirmed')).toContain('ikke bekræftet');
  });
  it('maps a network failure', () => {
    expect(loginErrorMessage('Failed to fetch')).toContain('Kunne ikke nå serveren');
  });
  it('passes an unknown message through unchanged', () => {
    expect(loginErrorMessage('Something odd')).toBe('Something odd');
  });
});
