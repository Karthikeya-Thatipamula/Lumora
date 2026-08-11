import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserId } from './model';

const REMINDER_DAY_OPTIONS = [1, 3, 7];
const MAX_MONTHLY_BUDGET = 1_000_000;

export const get = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireUserId(ctx);
        return await ctx.db
            .query('userSettings')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .unique();
    },
});

/**
 * Erases everything Lumora stores for the signed-in user.
 *
 * Required for the Play Store / App Store data-deletion policy, and the honest version of
 * the privacy promise: the app claims not to hold anything you can't take back, so there
 * has to be a button that proves it. The Clerk account itself is deleted client-side after
 * this succeeds — this owns only the Convex-side data.
 */
export const deleteAllUserData = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await requireUserId(ctx);

        // Account deletion has to see every row to delete every row, and the set is
        // bounded by MAX_SUBSCRIPTIONS_PER_USER.
        // eslint-disable-next-line @convex-dev/no-collect-in-query
        const subscriptions = await ctx.db
            .query('subscriptions')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .collect();

        for (const subscription of subscriptions) {
            await ctx.db.delete('subscriptions', subscription._id);
        }

        const settings = await ctx.db
            .query('userSettings')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .unique();

        if (settings) await ctx.db.delete('userSettings', settings._id);

        return { deletedSubscriptions: subscriptions.length };
    },
});

export const update = mutation({
    args: {
        monthlyBudget: v.optional(v.number()),
        reminderDaysBefore: v.optional(v.number()),
        notificationsEnabled: v.optional(v.boolean()),
        trialAlertsEnabled: v.optional(v.boolean()),
        weeklyDigestEnabled: v.optional(v.boolean()),
        monthlyIncome: v.optional(v.number()),
        themePreference: v.optional(v.string()),
        currency: v.optional(v.string()),
    },
    handler: async (ctx, patch) => {
        const userId = await requireUserId(ctx);

        // Validated here as well as in the UI — a bad budget silently breaks every
        // percentage on the Insights tab, and a bad currency code breaks formatting.
        if (patch.monthlyBudget !== undefined) {
            if (!Number.isFinite(patch.monthlyBudget) || patch.monthlyBudget <= 0) {
                throw new Error('Monthly budget must be greater than zero');
            }
            if (patch.monthlyBudget > MAX_MONTHLY_BUDGET) {
                throw new Error(`Monthly budget must be ${MAX_MONTHLY_BUDGET} or less`);
            }
        }

        if (patch.monthlyIncome !== undefined) {
            if (!Number.isFinite(patch.monthlyIncome) || patch.monthlyIncome <= 0) {
                throw new Error('Monthly income must be greater than zero');
            }
            if (patch.monthlyIncome > MAX_MONTHLY_BUDGET) {
                throw new Error(`Monthly income must be ${MAX_MONTHLY_BUDGET} or less`);
            }
        }

        if (
            patch.reminderDaysBefore !== undefined &&
            !REMINDER_DAY_OPTIONS.includes(patch.reminderDaysBefore)
        ) {
            throw new Error(`Reminder days must be one of: ${REMINDER_DAY_OPTIONS.join(', ')}`);
        }

        if (
            patch.themePreference !== undefined &&
            !['system', 'light', 'dark'].includes(patch.themePreference)
        ) {
            throw new Error('Theme must be system, light or dark');
        }

        if (patch.currency !== undefined && !/^[A-Z]{3}$/.test(patch.currency)) {
            throw new Error('Currency must be a three-letter ISO code');
        }

        const existing = await ctx.db
            .query('userSettings')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .unique();

        if (existing) {
            await ctx.db.patch('userSettings', existing._id, patch);
        } else {
            await ctx.db.insert('userSettings', { userId, ...patch });
        }
    },
});
