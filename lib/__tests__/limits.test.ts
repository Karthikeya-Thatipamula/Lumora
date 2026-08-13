import { FREE_ACTIVE_SUBSCRIPTION_LIMIT, isEntitledAt, splitHeadroom } from '@/convex/limits';

/**
 * The plan limit was client-side only, checked at exactly one screen, and CSV import
 * bypassed it entirely — a free user could paste two hundred rows and get unlimited
 * tracking in one tap. These cover the arithmetic that now decides it server-side.
 *
 * The database work around `splitHeadroom` is two bounded index probes; this is the part
 * that can silently truncate someone's import.
 */

describe('splitHeadroom', () => {
    const free = (requested: number, freeRoom: number, ceilingRoom = 500) =>
        splitHeadroom({ requested, freeRoom, ceilingRoom });

    it('accepts everything when the free plan has room', () => {
        expect(free(3, 5)).toEqual({
            accepted: 3,
            rejectedForLimit: 0,
            rejectedForCeiling: 0,
        });
    });

    it('accepts what fits and rejects the overflow, rather than refusing the batch', () => {
        // Three active already, ten pasted, limit of five: two get in.
        expect(free(10, 2)).toEqual({
            accepted: 2,
            rejectedForLimit: 8,
            rejectedForCeiling: 0,
        });
    });

    it('rejects everything when the free plan is already full', () => {
        expect(free(4, 0)).toEqual({
            accepted: 0,
            rejectedForLimit: 4,
            rejectedForCeiling: 0,
        });
    });

    it('treats a negative freeRoom as full rather than going inside out', () => {
        // Reachable if a user was over the limit before it was enforced.
        expect(free(3, -2)).toEqual({
            accepted: 0,
            rejectedForLimit: 3,
            rejectedForCeiling: 0,
        });
    });

    it('lets a Pro account through untouched', () => {
        expect(splitHeadroom({ requested: 50, freeRoom: null, ceilingRoom: 500 })).toEqual({
            accepted: 50,
            rejectedForLimit: 0,
            rejectedForCeiling: 0,
        });
    });

    it('still holds Pro to the abuse ceiling', () => {
        expect(splitHeadroom({ requested: 50, freeRoom: null, ceilingRoom: 10 })).toEqual({
            accepted: 10,
            rejectedForLimit: 0,
            rejectedForCeiling: 40,
        });
    });

    it('keeps the two rejection reasons apart, because the UI differs', () => {
        // The ceiling is an error; the free limit is a paywall prompt.
        expect(free(10, 5, 3)).toEqual({
            accepted: 3,
            rejectedForLimit: 0,
            rejectedForCeiling: 7,
        });
    });

    it('handles an empty batch', () => {
        expect(free(0, 5)).toEqual({
            accepted: 0,
            rejectedForLimit: 0,
            rejectedForCeiling: 0,
        });
    });

    it('uses a free limit of five', () => {
        expect(FREE_ACTIVE_SUBSCRIPTION_LIMIT).toBe(5);
    });
});

describe('isEntitledAt', () => {
    const now = Date.UTC(2026, 0, 15);
    const day = 86_400_000;

    it('grants access while the subscription is paid up', () => {
        expect(isEntitledAt(true, now + 10 * day, now)).toBe(true);
    });

    it('keeps a CANCELLED-but-not-yet-expired subscription entitled', () => {
        // The single easiest RevenueCat mistake: CANCELLATION means auto-renew is off,
        // not that access ends. Revoking here cuts off a paying customer mid-period.
        expect(isEntitledAt(true, now + 3 * day, now)).toBe(true);
    });

    it('revokes once the expiry has passed', () => {
        expect(isEntitledAt(true, now - day, now)).toBe(false);
    });

    it('revokes exactly at the expiry instant', () => {
        expect(isEntitledAt(true, now, now)).toBe(false);
    });

    it('treats a missing expiry as a non-expiring grant', () => {
        expect(isEntitledAt(true, undefined, now)).toBe(true);
    });

    it('never grants access when the event carries no entitlement', () => {
        expect(isEntitledAt(false, now + 10 * day, now)).toBe(false);
        expect(isEntitledAt(false, undefined, now)).toBe(false);
    });
});
