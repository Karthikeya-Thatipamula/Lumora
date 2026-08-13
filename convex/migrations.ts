import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES } from './validators';

/**
 * One-off data repairs.
 *
 * These exist because tightening `convex/schema.ts` is the one change in this codebase
 * that can **fail a deploy**: Convex validates every existing document against the new
 * schema, and a single non-conforming row rejects the whole push. Argument validators are
 * checked at call time and are safe to tighten whenever; schema validators are not.
 *
 * So the order is always: tighten the arg validators (done), run the normalizer here
 * against production, verify zero violations, and only then tighten the schema — deployed
 * on its own with nothing else in flight.
 *
 * Run from the CLI:
 *
 *   npx convex run migrations:countNonConformingSubscriptions
 *   npx convex run migrations:normalizeSubscriptionEnums
 *   npx convex run migrations:countNonConformingSubscriptions   # expect all zeroes
 */

/** Documents are walked in pages so a large table cannot blow the transaction budget. */
const PAGE_SIZE = 200;

/** Maps a stored billing value onto the canonical cycle, or null if it is unrecognisable. */
function canonicalBilling(raw: string): string | null {
    const match = BILLING_CYCLES.find((cycle) => cycle.toLowerCase() === raw.trim().toLowerCase());
    if (match) return match;

    // Values the CSV importer and older builds could produce.
    const value = raw.trim().toLowerCase();
    if (['year', 'annual', 'annually', 'y', 'yr'].includes(value)) return 'Yearly';
    if (['month', 'mo', 'm', 'monthly'].includes(value)) return 'Monthly';
    return null;
}

function canonicalStatus(raw: string): string | null {
    const value = raw.trim().toLowerCase();
    return SUBSCRIPTION_STATUSES.find((status) => status === value) ?? null;
}

/**
 * Reports how many documents would be rejected by the tightened schema, without changing
 * anything. Run this first, and again afterwards to confirm the normalizer did its job.
 */
export const countNonConformingSubscriptions = internalMutation({
    args: {},
    handler: async (ctx) => {
        let cursor: string | null = null;
        let scanned = 0;
        let badBilling = 0;
        let badStatus = 0;
        const unrecognised: string[] = [];

        for (;;) {
            const page = await ctx.db.query('subscriptions').paginate({
                cursor,
                numItems: PAGE_SIZE,
            });

            for (const doc of page.page) {
                scanned += 1;
                const billing = canonicalBilling(doc.billing);
                const status = canonicalStatus(doc.status);

                if (billing !== doc.billing) badBilling += 1;
                if (status !== doc.status) badStatus += 1;

                // These cannot be repaired automatically and need a decision.
                if (billing === null) unrecognised.push(`billing="${doc.billing}"`);
                if (status === null) unrecognised.push(`status="${doc.status}"`);
            }

            if (page.isDone) break;
            cursor = page.continueCursor;
        }

        return { scanned, badBilling, badStatus, unrecognised: [...new Set(unrecognised)] };
    },
});

/**
 * Rewrites legacy `billing` and `status` values to the canonical casing.
 *
 * Self-scheduling rather than looping over the whole table in one transaction, so it
 * cannot time out on a large deployment. Anything unrecognisable is left alone and
 * reported by the counter above — silently guessing at a value that drives every total in
 * the app would be worse than a failed deploy.
 */
export const normalizeSubscriptionEnums = internalMutation({
    args: { cursor: v.optional(v.union(v.string(), v.null())) },
    handler: async (ctx, { cursor = null }) => {
        const page = await ctx.db.query('subscriptions').paginate({
            cursor: cursor ?? null,
            numItems: PAGE_SIZE,
        });

        let repaired = 0;
        for (const doc of page.page) {
            const billing = canonicalBilling(doc.billing);
            const status = canonicalStatus(doc.status);

            const patch: { billing?: string; status?: string } = {};
            if (billing !== null && billing !== doc.billing) patch.billing = billing;
            if (status !== null && status !== doc.status) patch.status = status;

            if (Object.keys(patch).length > 0) {
                await ctx.db.patch('subscriptions', doc._id, patch);
                repaired += 1;
            }
        }

        if (!page.isDone) {
            await ctx.scheduler.runAfter(0, internal.migrations.normalizeSubscriptionEnums, {
                cursor: page.continueCursor,
            });
        }

        return { repaired, done: page.isDone };
    },
});
