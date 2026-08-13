import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';
import { isProUser, requireUserId } from './model';

/**
 * The server's mirror of RevenueCat entitlements.
 *
 * Written only by the webhook in `convex/http.ts`. Read by `getHeadroom` in `model.ts`
 * when deciding whether a user may create another subscription.
 */

/**
 * What the server believes about this user's plan.
 *
 * The client keeps its own RevenueCat-derived `isPro` for UI purposes and is deliberately
 * more generous — see `lib/useProStatus.ts`. This is the number that actually gates
 * writes.
 */
export const get = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireUserId(ctx);
        return { isPro: await isProUser(ctx, userId) };
    },
});

/**
 * Upserts an entitlement from a webhook event.
 *
 * Internal: nothing the client sends could be trusted here.
 *
 * Out-of-order delivery is real — RevenueCat retries failed deliveries for days — so an
 * event older than what is already stored is discarded rather than applied. Without that,
 * a delayed CANCELLATION could land after the RENEWAL that superseded it and revoke a
 * paying user's access.
 */
export const upsert = internalMutation({
    args: {
        userId: v.string(),
        isPro: v.boolean(),
        productId: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
        store: v.optional(v.string()),
        environment: v.optional(v.string()),
        eventTimestampMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('entitlements')
            .withIndex('by_user', (q) => q.eq('userId', args.userId))
            .unique();

        if (
            existing &&
            args.eventTimestampMs !== undefined &&
            existing.eventTimestampMs !== undefined &&
            args.eventTimestampMs < existing.eventTimestampMs
        ) {
            return { applied: false, reason: 'stale-event' as const };
        }

        const record = { ...args, updatedAt: Date.now() };

        if (existing) {
            await ctx.db.patch('entitlements', existing._id, record);
        } else {
            await ctx.db.insert('entitlements', record);
        }

        return { applied: true, reason: null };
    },
});
