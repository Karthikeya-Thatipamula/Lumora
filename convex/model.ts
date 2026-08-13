import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
    FREE_ACTIVE_SUBSCRIPTION_LIMIT,
    MAX_SUBSCRIPTIONS_PER_USER,
    splitHeadroom,
} from './limits';

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error('Not authenticated');
    }
    return identity.subject;
}

/**
 * Whether this user currently holds the Pro entitlement, according to the server's own
 * mirror of RevenueCat — never according to anything the client sent.
 *
 * An absent row means free, which is the correct default: a fresh deployment, or one
 * where RevenueCat is not configured at all, treats everyone as free rather than failing
 * open.
 */
export async function isProUser(ctx: QueryCtx | MutationCtx, userId: string): Promise<boolean> {
    const entitlement = await ctx.db
        .query('entitlements')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique();

    if (!entitlement?.isPro) return false;
    // An absent expiry is a non-expiring grant.
    return entitlement.expiresAt === undefined || entitlement.expiresAt > Date.now();
}

export interface Headroom {
    /** How many of the requested rows may actually be written. */
    accepted: number;
    /** Rows refused because the free plan is full. */
    rejectedForLimit: number;
    /** Rows refused because the per-user ceiling is full. */
    rejectedForCeiling: number;
    limit: number | null;
    activeCount: number;
}

/**
 * How many new subscriptions this user may create right now.
 *
 * Returns a count rather than throwing so a CSV import can accept what fits and report
 * the rest. All-or-nothing on a two-hundred-row file because row 197 tipped the limit
 * would be worse than a partial import the user is told about.
 *
 * Both probes are bounded: `take(n + 1)` is all that is needed to answer "is the cap
 * reached", so the free-tier check costs six document reads regardless of account size.
 */
export async function getHeadroom(
    ctx: QueryCtx | MutationCtx,
    userId: string,
    requested: number,
): Promise<Headroom> {
    const total = await ctx.db
        .query('subscriptions')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(MAX_SUBSCRIPTIONS_PER_USER + 1);

    const ceilingRoom = MAX_SUBSCRIPTIONS_PER_USER - total.length;

    if (await isProUser(ctx, userId)) {
        return {
            ...splitHeadroom({ requested, ceilingRoom, freeRoom: null }),
            limit: null,
            activeCount: total.filter((doc) => doc.status === 'active').length,
        };
    }

    const active = await ctx.db
        .query('subscriptions')
        .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'active'))
        .take(FREE_ACTIVE_SUBSCRIPTION_LIMIT + 1);

    return {
        ...splitHeadroom({
            requested,
            ceilingRoom,
            freeRoom: FREE_ACTIVE_SUBSCRIPTION_LIMIT - active.length,
        }),
        limit: FREE_ACTIVE_SUBSCRIPTION_LIMIT,
        activeCount: active.length,
    };
}

/**
 * Structured rather than a bare string so the client can route to the paywall on the
 * code instead of matching on the message text.
 */
export function freeLimitError(headroom: Headroom): ConvexError<{
    code: 'FREE_LIMIT_REACHED';
    limit: number;
    activeCount: number;
}> {
    return new ConvexError({
        code: 'FREE_LIMIT_REACHED' as const,
        limit: headroom.limit ?? FREE_ACTIVE_SUBSCRIPTION_LIMIT,
        activeCount: headroom.activeCount,
    });
}
