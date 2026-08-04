import { describe, expect, test } from 'vitest';
import { diffCalendar, formatCountdown, formatDateWithElapsed, formatElapsed } from './userInsights';

// Local time throughout — the helpers use the viewer's calendar, matching the
// da-DK dates rendered next to them.
const at = (s: string) => new Date(s).getTime();

describe('diffCalendar', () => {
  test('borrows across units like a human reads a date range', () => {
    // 31 Jan → 1 Mar is "1 month 1 day", not "29 days".
    expect(diffCalendar(at('2026-01-31T00:00:00'), at('2026-03-01T00:00:00'))).toMatchObject({
      years: 0, months: 1, days: 1,
    });
  });

  test('handles year rollover', () => {
    expect(diffCalendar(at('2024-11-15T10:00:00'), at('2026-02-17T13:30:45'))).toMatchObject({
      years: 1, months: 3, days: 2, hours: 3, minutes: 30, seconds: 45,
    });
  });

  test('returns zeros when the range is inverted or degenerate', () => {
    expect(diffCalendar(at('2026-05-01T00:00:00'), at('2026-04-01T00:00:00'))).toMatchObject({
      years: 0, months: 0, days: 0,
    });
    expect(diffCalendar(NaN, at('2026-04-01T00:00:00')).days).toBe(0);
  });
});

describe('formatElapsed', () => {
  const now = at('2026-08-02T12:00:00');

  test('shows the two largest units', () => {
    expect(formatElapsed('2024-05-02T12:00:00', now)).toBe('2 år 3 mdr');
    expect(formatElapsed('2026-05-20T12:00:00', now)).toBe('2 mdr 13 dage');
    expect(formatElapsed('2026-07-21T12:00:00', now)).toBe('12 dage');
  });

  test('falls back to hours, minutes, then "lige nu"', () => {
    expect(formatElapsed('2026-08-02T08:00:00', now)).toBe('4 timer');
    expect(formatElapsed('2026-08-02T11:00:00', now)).toBe('1 time');
    expect(formatElapsed('2026-08-02T11:45:00', now)).toBe('15 min');
    expect(formatElapsed('2026-08-02T11:59:59', now)).toBe('lige nu');
  });

  test('handles missing and future dates', () => {
    expect(formatElapsed(null, now)).toBe('–');
    expect(formatElapsed('not-a-date', now)).toBe('–');
    expect(formatElapsed('2027-01-01T00:00:00', now)).toBe('i fremtiden');
  });

  test('singularises Danish day and hour', () => {
    expect(formatElapsed('2026-08-01T12:00:00', now)).toBe('1 dag');
  });
});

describe('formatCountdown', () => {
  const now = at('2026-08-02T12:00:00');

  test('counts down with zero-padded time so the width does not jitter', () => {
    expect(formatCountdown('2026-08-05T14:03:09', now).text).toBe('3d 02t 03m 09s');
  });

  test('adds months and years only once they are reached', () => {
    expect(formatCountdown('2026-09-14T12:00:00', now).text).toBe('1 md 12d 00t 00m 00s');
    expect(formatCountdown('2026-08-02T18:30:00', now).text).toBe('06t 30m 00s');
  });

  test('flags the final 24 hours as urgent', () => {
    expect(formatCountdown('2026-08-03T11:00:00', now).urgent).toBe(true);
    expect(formatCountdown('2026-08-04T11:00:00', now).urgent).toBe(false);
  });

  test('reports an elapsed trial as expired', () => {
    const past = formatCountdown('2026-08-01T12:00:00', now);
    expect(past.expired).toBe(true);
    expect(past.text).toBe('Udløbet');
    expect(formatCountdown(null, now).text).toBe('–');
  });
});

describe('formatDateWithElapsed', () => {
  test('pairs the absolute date with how long ago it was', () => {
    const text = formatDateWithElapsed('2025-05-02T12:00:00', at('2026-08-02T12:00:00'));
    expect(text).toContain('2025');
    expect(text).toContain('(1 år 3 mdr siden)');
  });

  test('degrades to a dash without a date', () => {
    expect(formatDateWithElapsed(null, Date.now())).toBe('–');
  });
});
