/**
 * Plan limits, defined server-side because that is the only place they mean anything.
 *
 * `FREE_ACTIVE_SUBSCRIPTION_LIMIT` was previously a client-only constant in
 * `lib/purchases.ts`, checked at exactly one call site. CSV import did not check it at
 * all, so a free user could paste two hundred rows and get unlimited tracking in one tap.
 *
 * This module imports nothing, so the client can read the same numbers without pulling
 * any Convex runtime into the bundle.
 */

/** Active subscriptions a free account may track. Pro is unlimited. */
export const FREE_ACTIVE_SUBSCRIPTION_LIMIT = 5;

/** A generous ceiling that still stops a runaway client filling the table. */
export const MAX_SUBSCRIPTIONS_PER_USER = 500;

/**
 * Rows accepted per `createMany` call.
 *
 * Convex transactions have a read/write budget; a single unbounded import would blow it.
 * The client chunks larger files and each chunk lands atomically.
 */
export const MAX_IMPORT_BATCH = 100;

/** Must match the entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

export interface HeadroomInput {
    requested: number;
    /** Rows that fit under the per-user ceiling. */
    ceilingRoom: number;
    /** Rows that fit under the free-plan limit, or null for a Pro account. */
    freeRoom: number | null;
}

export interface HeadroomResult {
    accepted: number;
    rejectedForLimit: number;
    rejectedForCeiling: number;
}

/**
 * How a batch splits into accepted rows and the two reasons for refusing the rest.
 *
 * Extracted as a pure function so it can be tested without a Convex harness — the
 * database work around it is two bounded index probes, but this arithmetic is what
 * decides whether someone's import is silently truncated.
 *
 * The two rejection reasons are kept apart because they need different UI: hitting the
 * free limit is a paywall prompt, hitting the abuse ceiling is an error.
 */
export function splitHeadroom({ requested, ceilingRoom, freeRoom }: HeadroomInput): HeadroomResult {
    const underCeiling = Math.min(Math.max(requested, 0), Math.max(ceilingRoom, 0));
    const rejectedForCeiling = Math.max(requested, 0) - underCeiling;

    if (freeRoom === null) {
        return { accepted: underCeiling, rejectedForLimit: 0, rejectedForCeiling };
    }

    const accepted = Math.min(underCeiling, Math.max(freeRoom, 0));
    return {
        accepted,
        rejectedForLimit: underCeiling - accepted,
        rejectedForCeiling,
    };
}

/**
 * Whether a RevenueCat event leaves the user entitled.
 *
 * The decision is made on the expiry, never on the event type. `CANCELLATION` means
 * auto-renew was switched off — the user has paid through to `expiresAt` and keeps access
 * until then. Revoking on the event type would cut off a paying customer mid-period, and
 * it is the single easiest mistake to make with these webhooks.
 *
 * An absent expiry alongside the entitlement is a non-expiring grant.
 */
export function isEntitledAt(
    grantsEntitlement: boolean,
    expiresAtMs: number | undefined,
    nowMs: number,
): boolean {
    if (!grantsEntitlement) return false;
    return expiresAtMs === undefined || expiresAtMs > nowMs;
}
