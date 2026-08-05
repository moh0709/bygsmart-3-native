import { describe, it, expect } from 'vitest';
import { createI18n, i18n, SUPPORTED_LANGUAGES } from './config';
import { da } from './resources/da';

describe('i18n instance', () => {
  it('is fixed to da-DK', () => {
    expect(i18n.language).toBe('da');
    expect(SUPPORTED_LANGUAGES).toEqual(['da']);
  });

  it('resolves known keys to Danish', () => {
    expect(i18n.t('nav.home')).toBe('Hjem');
    expect(i18n.t('nav.more')).toBe('Mere');
    expect(i18n.t('projects.emptyBody')).toBe('Projektlisten bygges i P5.');
    expect(i18n.t('states.offlineTitle')).toBe('Offline');
  });

  it('t() works synchronously right after createI18n (initImmediate:false)', () => {
    const fresh = createI18n();
    expect(fresh.t('common.save')).toBe('Gem');
  });

  it('falls back to the key itself for an unknown key', () => {
    // @ts-expect-error — unknown key is a compile error; assert the runtime fallback too
    expect(i18n.t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('da catalog', () => {
  const flatten = (obj: Record<string, unknown>, prefix = ''): [string, unknown][] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
        : [[`${prefix}${k}`, v]],
    );

  it('has no empty or non-string values', () => {
    for (const [key, value] of flatten(da)) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim().length, key).toBeGreaterThan(0);
    }
  });
});
