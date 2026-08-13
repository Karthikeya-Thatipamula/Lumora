import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { frequencyValidator, statusValidator } from './domain';
import { MAX_IMPORT_BATCH, MAX_SUBSCRIPTIONS_PER_USER } from './limits';
import { freeLimitError, getHeadroom, requireUserId } from './model';
import {
    assertValidDate,
    assertValidName,
    assertValidPrice,
    assertValidReminderDays,
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
        status: statusValidator,
        startDate: v.optional(v.string()),
        price: v.number(),
        currency: v.optional(v.string()),
        billing: frequencyValidator,
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
        assertValidReminderDays(args.reminderDaysBefore);
        assertValidDate(args.startDate, 'Start date');
        assertValidDate(args.renewalDate, 'Renewal date');
        assertValidDate(args.trialEndsAt, 'Trial end date');
        const currency = normalizeCurrency(args.currency);

        // The free-plan limit is enforced here, not on the client. It used to be checked
        // at a single screen, and CSV import bypassed it entirely.
        const headroom = await getHeadroom(ctx, userId, 1);
        if (headroom.rejectedForCeiling > 0) {
            throw new Error(`You can track up to ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions.`);
        }
        if (headroom.accepted < 1) {
            throw freeLimitError(headroom);
        }

        const now = new Date().toISOString();
        return await ctx.db.insert('subscriptions', {
            ...args,
            name: name!,
            // Spreading `args` would otherwise write the raw currency straight through,
            // which is how it escaped validation. `billing` and `status` are now literal
            // unions in the arg validator, so a bad value cannot reach this point at all.
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

/** One importable row. Same shape as `create`, minus the fields the server derives. */
const importRowValidator = v.object({
    name: v.string(),
    price: v.number(),
    billing: frequencyValidator,
    status: statusValidator,
    category: v.optional(v.string()),
    currency: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    color: v.optional(v.string()),
    startDate: v.optional(v.string()),
    renewalDate: v.optional(v.string()),
    householdSize: v.optional(v.number()),
});

/**
 * Imports a batch of subscriptions in one transaction.
 *
 * Replaces a client-side loop that called `create` once per row. That loop checked the
 * plan limit not at all, and re-probed the user's whole table on every iteration — a
 * hundred-row import against a large account cost roughly fifty thousand document reads.
 *
 * Semantics are **partial-accept**, not all-or-nothing. A free user with three active
 * subscriptions who pastes ten rows gets two written and eight reported back; refusing
 * the entire file because row nine tipped the limit would be worse. For the same reason
 * per-row validation is caught inside the handler rather than allowed to throw — an
 * uncaught error would roll back the transaction and lose the rows that were fine.
 */
export const createMany = mutation({
    args: { rows: v.array(importRowValidator) },
    handler: async (ctx, { rows }) => {
        const userId = await requireUserId(ctx);

        if (rows.length > MAX_IMPORT_BATCH) {
            throw new Error(`Import up to ${MAX_IMPORT_BATCH} subscriptions at a time.`);
        }

        // One probe for the whole batch, rather than a race-able check per row.
        const headroom = await getHeadroom(ctx, userId, rows.length);

        const failed: { name: string; reason: string }[] = [];
        let imported = 0;
        const now = new Date().toISOString();

        for (const [index, row] of rows.entries()) {
            if (index >= headroom.accepted) {
                failed.push({
                    name: row.name,
                    reason:
                        headroom.limit === null
                            ? `Over the ${MAX_SUBSCRIPTIONS_PER_USER}-subscription ceiling`
                            : 'free_limit',
                });
                continue;
            }

            try {
                const name = assertValidName(row.name);
                assertValidPrice(row.price);
                assertValidDate(row.startDate, 'Start date');
                assertValidDate(row.renewalDate, 'Renewal date');

                await ctx.db.insert('subscriptions', {
                    ...row,
                    name: name!,
                    currency: normalizeCurrency(row.currency),
                    category: normalizeText(row.category),
                    paymentMethod: normalizeText(row.paymentMethod),
                    householdSize: normalizeHouseholdSize(row.householdSize) ?? 1,
                    userId,
                    statusChangedAt: now,
                    priceHistory: [{ price: row.price, changedAt: now }],
                });
                imported += 1;
            } catch (error) {
                failed.push({
                    name: row.name,
                    reason: error instanceof Error ? error.message : 'Could not be imported',
                });
            }
        }

        return {
            imported,
            failed,
            rejectedForLimit: headroom.rejectedForLimit,
            limit: headroom.limit,
        };
    },
});

export const update = mutation({
    args: {
        id: v.id('subscriptions'),
        name: v.optional(v.string()),
        plan: v.optional(v.string()),
        category: v.optional(v.string()),
        paymentMethod: v.optional(v.string()),
        status: v.optional(statusValidator),
        startDate: v.optional(v.string()),
        price: v.optional(v.number()),
        currency: v.optional(v.string()),
        billing: v.optional(frequencyValidator),
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
        assertValidReminderDays(patch.reminderDaysBefore);
        assertValidDate(patch.startDate, 'Start date');
        assertValidDate(patch.renewalDate, 'Renewal date');
        assertValidDate(patch.trialEndsAt, 'Trial end date');
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
        status: statusValidator,
    },
    handler: async (ctx, { id, status }) => {
        const userId = await requireUserId(ctx);
        const existing = await ctx.db.get('subscriptions', id);
        if (!existing || existing.userId !== userId) {
            throw new Error('Subscription not found');
        }
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
