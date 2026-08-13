/**
 * Server-side invariants. The client validates too, but the client is not a trust
 * boundary — a stale build, a retried mutation, or a hand-crafted call can all put
 * values here that would corrupt every total in the app.
 */

export const MAX_PRICE = 1_000_000;
export const MAX_NAME_LENGTH = 60;
export const MAX_TEXT_LENGTH = 120;
export const MAX_HOUSEHOLD_SIZE = 20;
/** Keeps a single document from growing without bound over years of price changes. */
export const MAX_PRICE_HISTORY = 50;
/** A generous ceiling that still stops a runaway client filling the table. */
export const MAX_SUBSCRIPTIONS_PER_USER = 500;

export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_CYCLES = ['Monthly', 'Yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** Reminder lead times the UI offers. Anything else has no way to be set deliberately. */
export const REMINDER_DAY_OPTIONS = [1, 3, 7];

export function assertValidPrice(price: number | undefined): void {
    if (price === undefined) return;
    if (!Number.isFinite(price)) throw new Error('Price must be a number');
    if (price <= 0) throw new Error('Price must be greater than zero');
    if (price > MAX_PRICE) throw new Error(`Price must be ${MAX_PRICE} or less`);
}

/** Trims and length-caps free text, returning undefined for anything blank. */
export function normalizeText(
    value: string | undefined,
    maxLength = MAX_TEXT_LENGTH,
): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed.slice(0, maxLength);
}

export function assertValidName(name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const normalized = normalizeText(name, MAX_NAME_LENGTH);
    if (!normalized) throw new Error('Name is required');
    return normalized;
}

export function assertValidStatus(status: string | undefined): void {
    if (status === undefined) return;
    if (!SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) {
        throw new Error(`Status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}`);
    }
}

/**
 * Canonicalises the billing cycle, rejecting anything unrecognised.
 *
 * This field escaped validation entirely, and `monthlyEquivalent` treats anything that
 * isn't monthly as yearly — so a stored value of "weekly" understated that subscription's
 * cost by **twelve times**, in every total in the app, silently.
 *
 * Case is normalised rather than rejected so documents written before this validator
 * existed can still be edited.
 */
export function normalizeBilling(billing: string | undefined): string | undefined {
    if (billing === undefined) return undefined;

    const match = BILLING_CYCLES.find(
        (cycle) => cycle.toLowerCase() === billing.trim().toLowerCase(),
    );
    if (!match) {
        throw new Error(`Billing must be one of: ${BILLING_CYCLES.join(', ')}`);
    }
    return match;
}

/**
 * A three-letter ISO code, upper-cased.
 *
 * userSettings enforced this from the start; subscriptions did not, and `formatCurrency`
 * silently falls back to USD on a bad code — so the amount rendered in the wrong currency
 * rather than erroring.
 */
export function normalizeCurrency(currency: string | undefined): string | undefined {
    if (currency === undefined) return undefined;

    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
        throw new Error('Currency must be a three-letter ISO code');
    }
    return code;
}

/**
 * The per-subscription reminder override.
 *
 * A negative value would make the "renews soon" notification fire *after* the charge,
 * which is worse than no reminder at all.
 */
export function assertValidReminderDays(days: number | undefined): void {
    if (days === undefined) return;
    if (!REMINDER_DAY_OPTIONS.includes(days)) {
        throw new Error(`Reminder days must be one of: ${REMINDER_DAY_OPTIONS.join(', ')}`);
    }
}

/** Clamps to a whole number of people, never below one — division by it must be safe. */
export function normalizeHouseholdSize(size: number | undefined): number | undefined {
    if (size === undefined) return undefined;
    if (!Number.isFinite(size)) return 1;
    return Math.min(MAX_HOUSEHOLD_SIZE, Math.max(1, Math.floor(size)));
}

/** Rejects unparseable dates so they can't poison renewal and trial maths downstream. */
export function assertValidDate(value: string | undefined, label: string): void {
    if (value === undefined) return;
    if (Number.isNaN(Date.parse(value))) throw new Error(`${label} is not a valid date`);
}

export function trimPriceHistory<T>(history: T[]): T[] {
    return history.length > MAX_PRICE_HISTORY ? history.slice(-MAX_PRICE_HISTORY) : history;
}
