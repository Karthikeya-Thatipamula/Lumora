import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserId } from './model';
import {
    assertValidDate,
    assertValidName,
    assertValidPrice,
    assertValidReminderDays,
    assertValidStatus,
    MAX_SUBSCRIPTIONS_PER_USER,
    normalizeBilling,
    normalizeCurrency,
    normalizeHouseholdSize,
    normalizeText,
    trimPriceHistory,
} from './validators';

export const list = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireUserId(ctx);
        // Bounded by MAX_SUBSCRIPTIONS_PER_USER at the write path, and the client renders
        // the whole list, so there is nothing to paginate towards.
        // eslint-disable-next-line @convex-dev/no-collect-in-query
        return await ctx.db
            .query('subscriptions')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .order('desc')
            .collect();
    },
});

export const get = query({
    args: { id: v.id('subscriptions') },
    handler: async (ctx, { id }) => {
        const userId = await requireUserId(ctx);
        const doc = await ctx.db.get('subscriptions', id);
        if (!doc || doc.userId !== userId) return null;
        return doc;
    },
});

export const create = mutation({
    args: {
        name: v.string(),
        plan: v.optional(v.string()),
        category: v.optional(v.string()),
        paymentMethod: v.optional(v.string()),
        status: v.string(),
        startDate: v.optional(v.string()),
        price: v.number(),
        currency: v.optional(v.string()),
        billing: v.string(),
        renewalDate: v.optional(v.string()),
        color: v.optional(v.string()),
        iconKey: v.optional(v.string()),
        isTrial: v.optional(v.boolean()),
        trialEndsAt: v.optional(v.string()),
        householdSize: v.optional(v.number()),
        reminderDaysBefore: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await requireUserId(ctx);

        const name = assertValidName(args.name);
        assertValidPrice(args.price);
        assertValidStatus(args.status);
        assertValidReminderDays(args.reminderDaysBefore);
        assertValidDate(args.startDate, 'Start date');
        assertValidDate(args.renewalDate, 'Renewal date');
        assertValidDate(args.trialEndsAt, 'Trial end date');
        const billing = normalizeBilling(args.billing);
        const currency = normalizeCurrency(args.currency);

        // Bounded so a looping client can't fill the table for this user. We only need to
        // know whether the cap is reached, so probe one past it rather than reading every
        // document the user owns — a 100-row CSV import used to cost ~50,000 reads here.
        const existing = await ctx.db
            .query('subscriptions')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .take(MAX_SUBSCRIPTIONS_PER_USER + 1);
        if (existing.length >= MAX_SUBSCRIPTIONS_PER_USER) {
            throw new Error(`You can track up to ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions.`);
        }

        const now = new Date().toISOString();
        return await ctx.db.insert('subscriptions', {
            ...args,
            name: name!,
            // Spreading `args` would otherwise write the raw client values straight
            // through, which is how billing and currency escaped validation.
            billing: billing!,
            currency,
            plan: normalizeText(args.plan),
            category: normalizeText(args.category),
            paymentMethod: normalizeText(args.paymentMethod),
            householdSize: normalizeHouseholdSize(args.householdSize) ?? 1,
            userId,
            statusChangedAt: now,
            priceHistory: [{ price: args.price, changedAt: now }],
        });
    },
});

export const update = mutation({
    args: {
        id: v.id('subscriptions'),
        name: v.optional(v.string()),
        plan: v.optional(v.string()),
        category: v.optional(v.string()),
        paymentMethod: v.optional(v.string()),
        status: v.optional(v.string()),
        startDate: v.optional(v.string()),
        price: v.optional(v.number()),
        currency: v.optional(v.string()),
        billing: v.optional(v.string()),
        renewalDate: v.optional(v.string()),
        color: v.optional(v.string()),
        iconKey: v.optional(v.string()),
        isTrial: v.optional(v.boolean()),
        trialEndsAt: v.optional(v.string()),
        householdSize: v.optional(v.number()),
        reminderDaysBefore: v.optional(v.number()),
    },
    handler: async (ctx, { id, ...patch }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }

        const name = assertValidName(patch.name);
        assertValidPrice(patch.price);
        assertValidStatus(patch.status);
        assertValidReminderDays(patch.reminderDaysBefore);
        assertValidDate(patch.startDate, 'Start date');
        assertValidDate(patch.renewalDate, 'Renewal date');
        assertValidDate(patch.trialEndsAt, 'Trial end date');
        const billing = normalizeBilling(patch.billing);
        const currency = normalizeCurrency(patch.currency);

        // Documents predating the priceHistory field get one seeded from their current
        // price. The seed must be dated from when the subscription started, not from now:
        // re-seeding with `new Date()` on every edit slid the "original price" timestamp
        // forward each time the user saved, corrupting the spend-over-time chart.
        let priceHistory = existing.priceHistory ?? [
            {
                price: existing.price,
                // startDate is optional, so fall back to when the document was created.
                changedAt: existing.startDate ?? new Date(existing._creationTime).toISOString(),
            },
        ];
        if (patch.price !== undefined && patch.price !== existing.price) {
            priceHistory = trimPriceHistory([
                ...priceHistory,
                { price: patch.price, changedAt: new Date().toISOString() },
            ]);
        }

        // `undefined` in an arg object is dropped in transit, so clearing a trial has to
        // be decided here on the server rather than sent as an explicit undefined.
        const clearTrial = patch.isTrial === false;

        await ctx.db.patch('subscriptions', id, {
            ...patch,
            ...(name !== undefined ? { name } : {}),
            ...(billing !== undefined ? { billing } : {}),
            ...(currency !== undefined ? { currency } : {}),
            ...(patch.plan !== undefined ? { plan: normalizeText(patch.plan) } : {}),
            ...(patch.category !== undefined ? { category: normalizeText(patch.category) } : {}),
            ...(patch.paymentMethod !== undefined
                ? { paymentMethod: normalizeText(patch.paymentMethod) }
                : {}),
            ...(patch.householdSize !== undefined
                ? { householdSize: normalizeHouseholdSize(patch.householdSize) }
                : {}),
            priceHistory,
            ...(clearTrial ? { trialEndsAt: undefined } : {}),
        });
    },
});

/** Converts a trial to a regular paid subscription and schedules the next cycle. */
export const endTrial = mutation({
    args: {
        id: v.id('subscriptions'),
        renewalDate: v.string(),
    },
    handler: async (ctx, { id, renewalDate }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }
        assertValidDate(renewalDate, 'Renewal date');

        await ctx.db.patch('subscriptions', id, {
            isTrial: false,
            trialEndsAt: undefined,
            renewalDate,
            status: 'active',
            statusChangedAt: new Date().toISOString(),
        });
    },
});

/**
 * Records one use of a subscription. Feeds the cost-per-use figure, which is the number
 * that actually settles "should I cancel this" — a plan costing little but never opened is
 * a worse deal than an expensive one used daily.
 */
export const logUsage = mutation({
    args: {
        id: v.id('subscriptions'),
        /** -1 undoes a mis-tap. Never allowed to push the count below zero. */
        delta: v.optional(v.number()),
    },
    handler: async (ctx, { id, delta }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }

        const step = delta === -1 ? -1 : 1;
        const next = Math.max(0, (existing.usageCount ?? 0) + step);

        await ctx.db.patch('subscriptions', id, {
            usageCount: next,
            // Anchor the window the first time anything is logged, so cost-per-use has a period.
            usageSince: existing.usageSince ?? new Date().toISOString(),
        });

        return next;
    },
});

/** Clears the usage tally and restarts the measurement window. */
export const resetUsage = mutation({
    args: { id: v.id('subscriptions') },
    handler: async (ctx, { id }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }
        await ctx.db.patch('subscriptions', id, {
            usageCount: 0,
            usageSince: new Date().toISOString(),
        });
    },
});

export const setStatus = mutation({
    args: {
        id: v.id('subscriptions'),
        status: v.string(),
    },
    handler: async (ctx, { id, status }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }
        assertValidStatus(status);

        await ctx.db.patch('subscriptions', id, {
            status,
            statusChangedAt: new Date().toISOString(),
        });
    },
});

export const remove = mutation({
    args: { id: v.id('subscriptions') },
    handler: async (ctx, { id }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }
        await ctx.db.delete('subscriptions', id);
    },
});
