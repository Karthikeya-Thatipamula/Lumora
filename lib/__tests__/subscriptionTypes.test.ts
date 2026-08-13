import { CATEGORIES, toCategory, toFrequency } from '@/lib/subscriptionTypes';

/**
 * The database stores `category` and `billing` as strings on purpose, so every read
 * boundary narrows rather than casts. The detail screen used to do
 * `(subscription.billing as Frequency) ?? 'Monthly'` — a cast that always "succeeded",
 * with a `??` fallback that could never fire because the field is non-optional.
 */

describe('toFrequency', () => {
    it('recognises the canonical values', () => {
        expect(toFrequency('Monthly')).toBe('Monthly');
        expect(toFrequency('Yearly')).toBe('Yearly');
    });

    it('is case-insensitive, which is where the 12x cost bug came from', () => {
        // "monthly" used to fall through to the yearly branch and divide by twelve.
        expect(toFrequency('monthly')).toBe('Monthly');
        expect(toFrequency('YEARLY')).toBe('Yearly');
    });

    it('defaults unrecognised values to monthly, never annual', () => {
        // Guessing annual understates spend by 12x; guessing monthly overstates by at
        // most the same factor but is visible to the user immediately.
        expect(toFrequency('weekly')).toBe('Monthly');
        expect(toFrequency('')).toBe('Monthly');
        expect(toFrequency(undefined)).toBe('Monthly');
    });
});

describe('toCategory', () => {
    it('recognises every category the UI offers', () => {
        for (const category of CATEGORIES) {
            expect(toCategory(category)).toBe(category);
        }
    });

    it('is case- and whitespace-insensitive', () => {
        expect(toCategory('  entertainment ')).toBe('Entertainment');
        expect(toCategory('ai tools')).toBe('AI Tools');
    });

    it('files anything unrecognised under Other', () => {
        expect(toCategory('Groceries')).toBe('Other');
        expect(toCategory('')).toBe('Other');
        expect(toCategory(undefined)).toBe('Other');
    });
});
