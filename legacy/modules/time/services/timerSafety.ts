export const EIGHT_HOUR_REMINDER_SECONDS = 8 * 60 * 60;
export const AUTO_CHECKOUT_SECONDS = 18 * 60 * 60;
export const AUTO_CHECKOUT_NOTE = 'Automatisk afsluttet tid. Venligst juster til korrekt tidsforbrug.';

export type TimerSafetyAction = 'eight-hour-reminder' | 'auto-checkout' | null;

export const getTimerSafetyAction = ({
    isRunning,
    isPaused,
    seconds,
    eightHourReminderSent,
}: {
    isRunning: boolean;
    isPaused: boolean;
    seconds: number;
    eightHourReminderSent?: boolean;
}): TimerSafetyAction => {
    if (!isRunning || isPaused) return null;
    if (seconds >= AUTO_CHECKOUT_SECONDS) return 'auto-checkout';
    if (seconds >= EIGHT_HOUR_REMINDER_SECONDS && !eightHourReminderSent) return 'eight-hour-reminder';
    return null;
};
