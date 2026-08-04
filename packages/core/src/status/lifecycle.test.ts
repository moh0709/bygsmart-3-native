import { describe, it, expect } from 'vitest';
import type { ProjectStatus } from '../types';
import { applyLifecycleEvent, canReopen, REOPENABLE_FROM } from './lifecycle';

describe('applyLifecycleEvent', () => {
  it('close/archive/cancel are always allowed', () => {
    const from: ProjectStatus[] = ['I gang', 'Afsluttet', 'ARCHIVED', 'CANCELLED'];
    for (const s of from) {
      expect(applyLifecycleEvent(s, 'close')).toBe('Afsluttet');
      expect(applyLifecycleEvent(s, 'archive')).toBe('ARCHIVED');
      expect(applyLifecycleEvent(s, 'cancel')).toBe('CANCELLED');
    }
  });

  it('reopen only from Afsluttet or ARCHIVED', () => {
    expect(applyLifecycleEvent('Afsluttet', 'reopen')).toBe('I gang');
    expect(applyLifecycleEvent('ARCHIVED', 'reopen')).toBe('I gang');
  });

  it('reopen is illegal from active or cancelled (terminal)', () => {
    expect(applyLifecycleEvent('I gang', 'reopen')).toBeNull();
    expect(applyLifecycleEvent('CANCELLED', 'reopen')).toBeNull();
  });
});

describe('canReopen', () => {
  it('matches REOPENABLE_FROM', () => {
    expect(canReopen('Afsluttet')).toBe(true);
    expect(canReopen('ARCHIVED')).toBe(true);
    expect(canReopen('I gang')).toBe(false);
    expect(canReopen('CANCELLED')).toBe(false);
    expect(REOPENABLE_FROM).toEqual(['Afsluttet', 'ARCHIVED']);
  });
});
