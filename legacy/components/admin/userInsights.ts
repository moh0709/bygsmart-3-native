// Time helpers for the admin user cards. Calendar-correct (a "month" is a real
// calendar month, not 30 days) and pure — `now` is always passed in so a single
// ticking clock in the users tab drives every card and the tests are stable.

export interface CalendarDiff {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
}

const EMPTY_DIFF: CalendarDiff = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };

/**
 * `date` shifted by `count` months, clamping a day that the target month does
 * not have: 31 Jan + 1 month → 28 Feb, not 3 Mar.
 */
const addMonthsClamped = (date: Date, count: number): Date => {
    const year = date.getFullYear();
    const month = date.getMonth() + count;
    const lastDayOfTarget = new Date(year, month + 1, 0).getDate();
    return new Date(
        year,
        month,
        Math.min(date.getDate(), lastDayOfTarget),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
    );
};

/**
 * Calendar difference between two instants, the way a human reads a date range:
 * 31 Jan → 1 Mar is "1 måned 1 dag", not "29 dage".
 *
 * Anchors on whole months first (naive per-unit borrowing goes negative when a
 * short month sits in between), then counts the remaining days one at a time so
 * a DST transition can't shift the result by an hour. Returns zeros when `to`
 * is not after `from`.
 */
export const diffCalendar = (fromMs: number, toMs: number): CalendarDiff => {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
        const span = Number.isFinite(fromMs) && Number.isFinite(toMs) ? toMs - fromMs : 0;
        return { ...EMPTY_DIFF, totalMs: Math.max(0, span) };
    }

    const from = new Date(fromMs);
    const to = new Date(toMs);

    let totalMonths =
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (totalMonths > 0 && addMonthsClamped(from, totalMonths).getTime() > toMs) {
        totalMonths -= 1;
    }

    const cursor = addMonthsClamped(from, Math.max(0, totalMonths));

    let days = 0;
    for (;;) {
        const next = new Date(cursor);
        next.setDate(next.getDate() + 1);
        if (next.getTime() > toMs) break;
        cursor.setTime(next.getTime());
        days += 1;
    }

    let remainder = toMs - cursor.getTime();
    const hours = Math.floor(remainder / 3_600_000);
    remainder -= hours * 3_600_000;
    const minutes = Math.floor(remainder / 60_000);
    remainder -= minutes * 60_000;
    const seconds = Math.floor(remainder / 1_000);

    return {
        years: Math.floor(Math.max(0, totalMonths) / 12),
        months: Math.max(0, totalMonths) % 12,
        days,
        hours,
        minutes,
        seconds,
        totalMs: toMs - fromMs,
    };
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Coarse "how long ago", largest two units — "2 år 3 mdr", "12 dage",
 * "4 timer". Used for registration date and last sign-in.
 */
export const formatElapsed = (iso: string | null, nowMs: number): string => {
    if (!iso) return '–';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '–';
    if (then > nowMs) return 'i fremtiden';

    const d = diffCalendar(then, nowMs);
    const parts: string[] = [];
    if (d.years) parts.push(plural(d.years, 'år', 'år'));
    if (d.months) parts.push(`${d.months} mdr`);
    if (!d.years && d.days) parts.push(plural(d.days, 'dag', 'dage'));
    if (!d.years && !d.months && !d.days && d.hours) parts.push(plural(d.hours, 'time', 'timer'));
    if (!parts.length && d.minutes) parts.push(`${d.minutes} min`);
    if (!parts.length) return 'lige nu';

    return parts.slice(0, 2).join(' ');
};

export interface Countdown {
    expired: boolean;
    /** "1 md 12d 04t 31m 09s" — seconds always present so the tick is visible. */
    text: string;
    diff: CalendarDiff;
    /** True inside the last 24 hours, for warning styling. */
    urgent: boolean;
}

/**
 * Live countdown to a trial expiry. Months and days are calendar-correct;
 * hours/minutes/seconds are zero-padded so the text does not jitter in width.
 */
export const formatCountdown = (iso: string | null, nowMs: number): Countdown => {
    if (!iso) return { expired: true, text: '–', diff: EMPTY_DIFF, urgent: false };

    const target = new Date(iso).getTime();
    if (!Number.isFinite(target)) return { expired: true, text: '–', diff: EMPTY_DIFF, urgent: false };
    if (target <= nowMs) return { expired: true, text: 'Udløbet', diff: EMPTY_DIFF, urgent: true };

    const d = diffCalendar(nowMs, target);
    const pad = (n: number) => String(n).padStart(2, '0');

    const parts: string[] = [];
    if (d.years) parts.push(`${d.years} år`);
    if (d.years || d.months) parts.push(`${d.months} md`);
    if (d.years || d.months || d.days) parts.push(`${d.days}d`);
    parts.push(`${pad(d.hours)}t`, `${pad(d.minutes)}m`, `${pad(d.seconds)}s`);

    return {
        expired: false,
        text: parts.join(' '),
        diff: d,
        urgent: d.totalMs <= 24 * 60 * 60 * 1000,
    };
};

/** Absolute date, da-DK medium ("2. aug. 2026"). */
export const formatAbsolute = (iso: string | null): string => {
    if (!iso) return '–';
    try {
        return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' });
    } catch {
        return '–';
    }
};

/** "2. aug. 2026 (1 år 3 mdr siden)" — the registration-line format. */
export const formatDateWithElapsed = (iso: string | null, nowMs: number): string => {
    if (!iso) return '–';
    const elapsed = formatElapsed(iso, nowMs);
    return elapsed === '–' ? formatAbsolute(iso) : `${formatAbsolute(iso)} (${elapsed} siden)`;
};
