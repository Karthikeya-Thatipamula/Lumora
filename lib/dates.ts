import dayjs from 'dayjs';

/**
 * Calendar-day arithmetic.
 *
 * Every countdown in the app has to compare whole days, not elapsed time: a renewal
 * tomorrow at 09:00 is "1 day away" whether it is now 08:00 or 23:00 today. That means
 * flooring both sides to the start of the day before diffing, and the same
 * `dayjs(x).startOf('day').diff(dayjs().startOf('day'), 'day')` expression had been
 * written out at five separate call sites.
 *
 * Pure and React-free, so it stays unit-testable.
 */

/**
 * Whole calendar days from today until `date`, never negative.
 *
 * Returns 0 for a date that has already passed, which is what every caller wants — a
 * trial that lapsed yesterday reads "ends today", not "-1 days left". Returns `null`
 * for a missing or unparseable date so callers can tell "no date" apart from "today".
 */
export function daysUntil(date: string | undefined | null): number | null {
    if (!date) return null;

    const target = dayjs(date);
    if (!target.isValid()) return null;

    return Math.max(0, target.startOf('day').diff(dayjs().startOf('day'), 'day'));
}

/**
 * Whole calendar days from today until `date`, allowing negatives.
 *
 * For the cases that genuinely need to know something is overdue rather than clamping
 * it to zero.
 */
export function daysUntilSigned(date: string | undefined | null): number | null {
    if (!date) return null;

    const target = dayjs(date);
    if (!target.isValid()) return null;

    return target.startOf('day').diff(dayjs().startOf('day'), 'day');
}

/** True when `date` is today or later, comparing calendar days. */
export function isTodayOrLater(date: string | undefined | null): boolean {
    const days = daysUntilSigned(date);
    return days !== null && days >= 0;
}
