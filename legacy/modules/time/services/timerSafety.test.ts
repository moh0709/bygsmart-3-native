import { describe, expect, test } from 'vitest';
import {
    AUTO_CHECKOUT_NOTE,
    AUTO_CHECKOUT_SECONDS,
    EIGHT_HOUR_REMINDER_SECONDS,
    getTimerSafetyAction,
} from './timerSafety';

const runningTimer = {
    isRunning: true,
    isPaused: false,
    seconds: 0,
    eightHourReminderSent: false,
};

describe('getTimerSafetyAction', () => {
    test('requests one reminder when an active timer reaches eight hours', () => {
        expect(getTimerSafetyAction({
            ...runningTimer,
            seconds: EIGHT_HOUR_REMINDER_SECONDS,
        })).toBe('eight-hour-reminder');

        expect(getTimerSafetyAction({
            ...runningTimer,
            seconds: EIGHT_HOUR_REMINDER_SECONDS,
            eightHourReminderSent: true,
        })).toBeNull();
    });

    test('prioritizes automatic checkout when an active timer reaches eighteen hours', () => {
        expect(getTimerSafetyAction({
            ...runningTimer,
            seconds: AUTO_CHECKOUT_SECONDS,
        })).toBe('auto-checkout');
        expect(AUTO_CHECKOUT_NOTE).toBe(
            'Automatisk afsluttet tid. Venligst juster til korrekt tidsforbrug.',
        );
    });

    test('does not alert or check out a paused or stopped timer', () => {
        expect(getTimerSafetyAction({
            ...runningTimer,
            seconds: AUTO_CHECKOUT_SECONDS,
            isPaused: true,
        })).toBeNull();

        expect(getTimerSafetyAction({
            ...runningTimer,
            seconds: AUTO_CHECKOUT_SECONDS,
            isRunning: false,
        })).toBeNull();
    });
});
