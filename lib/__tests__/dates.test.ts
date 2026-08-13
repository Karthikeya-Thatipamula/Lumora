import { daysUntil, daysUntilSigned, isTodayOrLater } from '@/lib/dates';
import dayjs from 'dayjs';

const at = (days: number) => dayjs().add(days, 'day').toISOString();

describe('daysUntil', () => {
    it('counts whole calendar days ahead', () => {
        expect(daysUntil(at(5))).toBe(5);
    });

    it('is zero for today', () => {
        expect(daysUntil(at(0))).toBe(0);
    });

    it('clamps a past date to zero rather than going negative', () => {
        expect(daysUntil(at(-9))).toBe(0);
    });

    it('compares calendar days, not elapsed hours', () => {
        // 09:00 tomorrow is one day away regardless of the time of day right now.
        const tomorrowMorning = dayjs().add(1, 'day').hour(9).minute(0).toISOString();
        expect(daysUntil(tomorrowMorning)).toBe(1);
    });

    it('returns null for a missing date so callers can tell it apart from today', () => {
        expect(daysUntil(undefined)).toBeNull();
        expect(daysUntil(null)).toBeNull();
        expect(daysUntil('')).toBeNull();
    });

    it('returns null for an unparseable date', () => {
        expect(daysUntil('not a date')).toBeNull();
    });
});

describe('daysUntilSigned', () => {
    it('reports overdue dates as negative', () => {
        expect(daysUntilSigned(at(-3))).toBe(-3);
    });

    it('agrees with daysUntil for future dates', () => {
        expect(daysUntilSigned(at(4))).toBe(4);
    });

    it('returns null for a missing date', () => {
        expect(daysUntilSigned(undefined)).toBeNull();
    });
});

describe('isTodayOrLater', () => {
    it('is true for today and the future', () => {
        expect(isTodayOrLater(at(0))).toBe(true);
        expect(isTodayOrLater(at(1))).toBe(true);
    });

    it('is false for the past', () => {
        expect(isTodayOrLater(at(-1))).toBe(false);
    });

    it('is false for a missing or invalid date', () => {
        expect(isTodayOrLater(undefined)).toBe(false);
        expect(isTodayOrLater('nope')).toBe(false);
    });
});
