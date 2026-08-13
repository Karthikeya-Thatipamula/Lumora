import { buildSubscriptionsCsv } from '@/lib/csv';
import { parseSubscriptionsCsv } from '@/lib/csvImport';

/**
 * Exporting and re-importing your own file has to give you back what you had.
 *
 * It did not. The exporter wrote Status but the importer ignored it, so every cancelled
 * and paused subscription came back **active** — and monthly spend jumped. Household size
 * was not exported at all, so shared plans returned at their full sticker price rather
 * than the user's share.
 *
 * The existing CSV test only asserted that the header started with `"Name","Category",
 * "Price"`, which is why neither was caught.
 */

const subscription = (overrides: Partial<Subscription> & { id: string; name: string }) =>
    ({
        billing: 'Monthly',
        status: 'active',
        currency: 'USD',
        price: 10,
        ...overrides,
    }) as Subscription;

/** Exports the given subscriptions and parses the result straight back in. */
const roundTrip = (subscriptions: Subscription[]) =>
    parseSubscriptionsCsv(buildSubscriptionsCsv(subscriptions));

describe('CSV round trip', () => {
    it('preserves the basics', () => {
        const { rows, errors } = roundTrip([
            subscription({
                id: '1',
                name: 'Netflix',
                price: 15.49,
                currency: 'USD',
                category: 'Entertainment',
            }),
        ]);

        expect(errors).toEqual([]);
        expect(rows[0].values).toMatchObject({
            name: 'Netflix',
            price: 15.49,
            currency: 'USD',
            category: 'Entertainment',
            frequency: 'Monthly',
        });
    });

    it('keeps a cancelled subscription cancelled', () => {
        const { rows } = roundTrip([
            subscription({ id: '1', name: 'Old Gym', price: 50, status: 'cancelled' }),
        ]);

        expect(rows[0].values.status).toBe('cancelled');
    });

    it('keeps a paused subscription paused', () => {
        const { rows } = roundTrip([
            subscription({ id: '1', name: 'Storage', price: 8, status: 'paused' }),
        ]);

        expect(rows[0].values.status).toBe('paused');
    });

    it('preserves the household size of a shared plan', () => {
        const { rows } = roundTrip([
            subscription({ id: '1', name: 'Family Plan', price: 20, householdSize: 4 }),
        ]);

        expect(rows[0].values.householdSize).toBe(4);
    });

    it('preserves the yearly billing cycle', () => {
        const { rows } = roundTrip([
            subscription({ id: '1', name: 'Adobe', price: 240, billing: 'Yearly' }),
        ]);

        expect(rows[0].values.frequency).toBe('Yearly');
    });

    it('round-trips a whole mixed list without dropping or inventing rows', () => {
        const { rows, errors } = roundTrip([
            subscription({ id: '1', name: 'Netflix', price: 15.49 }),
            subscription({ id: '2', name: 'Old Gym', price: 50, status: 'cancelled' }),
            subscription({ id: '3', name: 'Adobe', price: 240, billing: 'Yearly' }),
            subscription({ id: '4', name: 'Family', price: 20, householdSize: 4 }),
        ]);

        expect(errors).toEqual([]);
        expect(rows).toHaveLength(4);
        expect(rows.map((row) => row.values.name)).toEqual([
            'Netflix',
            'Old Gym',
            'Adobe',
            'Family',
        ]);
    });

    it('survives a name that would otherwise be a spreadsheet formula', () => {
        const { rows, errors } = roundTrip([
            subscription({ id: '1', name: '=HYPERLINK("evil")', price: 5 }),
        ]);

        expect(errors).toEqual([]);
        // The apostrophe that defuses the formula is expected to come back with it —
        // what matters is that the row survives and stays inert.
        expect(rows[0].values.name).toContain('HYPERLINK');
    });
});

describe('CSV import of a foreign file', () => {
    it('reads a European decimal comma', () => {
        const { rows } = parseSubscriptionsCsv('Name,Price\nSpotify,"1.234,56"');

        expect(rows[0].values.price).toBe(1234.56);
    });

    it('reads a US grouped thousand', () => {
        const { rows } = parseSubscriptionsCsv('Name,Price\nSpotify,"1,234.56"');

        expect(rows[0].values.price).toBe(1234.56);
    });

    it('defaults status to undefined when the file has no status column', () => {
        const { rows } = parseSubscriptionsCsv('Name,Price\nSpotify,9.99');

        expect(rows[0].values.status).toBeUndefined();
    });

    it('ignores a status it does not recognise rather than guessing', () => {
        const { rows } = parseSubscriptionsCsv('Name,Price,Status\nSpotify,9.99,archived');

        expect(rows[0].values.status).toBeUndefined();
    });

    it('rejects a household size below one, which would divide by zero downstream', () => {
        const { rows } = parseSubscriptionsCsv('Name,Price,Household size\nSpotify,9.99,0');

        expect(rows[0].values.householdSize).toBeUndefined();
    });
});
