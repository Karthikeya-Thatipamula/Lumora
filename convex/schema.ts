import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
    subscriptions: defineTable({
        userId: v.string(),
        name: v.string(),
        plan: v.optional(v.string()),
        category: v.optional(v.string()),
        paymentMethod: v.optional(v.string()),
        status: v.string(),
        statusChangedAt: v.optional(v.string()),
        startDate: v.optional(v.string()),
        price: v.number(),
        currency: v.optional(v.string()),
        billing: v.string(),
        renewalDate: v.optional(v.string()),
        color: v.optional(v.string()),
        iconKey: v.optional(v.string()),
        // Free-trial tracking. `trialEndsAt` doubles as the first paid renewal date:
        // that is the moment the card actually gets charged.
        isTrial: v.optional(v.boolean()),
        trialEndsAt: v.optional(v.string()),
        // Total people splitting the cost, including the owner. 1 or absent = not shared.
        householdSize: v.optional(v.number()),
        // Overrides the account-wide reminder lead time for this one subscription.
        reminderDaysBefore: v.optional(v.number()),
        // Times the user logged actually using this, and when the count last reset.
        usageCount: v.optional(v.number()),
        usageSince: v.optional(v.string()),
        priceHistory: v.optional(
            v.array(
                v.object({
                    price: v.number(),
                    changedAt: v.string(),
                }),
            ),
        ),
    })
        .index('by_user', ['userId'])
        // The free-tier limit counts *active* subscriptions, which a plain `by_user`
        // probe cannot express. This compound index answers it exactly, in six reads,
        // with none of the drift surface a denormalised counter would add.
        .index('by_user_status', ['userId', 'status']),

    /**
     * RevenueCat's view of who is Pro, mirrored so the server can enforce plan limits.
     *
     * The client cannot be asked whether it is Pro — a mutation argument is
     * attacker-controlled, and anyone with a session could call `create({ isPro: true })`.
     * The webhook in `convex/http.ts` and the reconcile action in `entitlements.ts` are
     * the only writers.
     *
     * Keyed by the Clerk user id, which is also RevenueCat's `appUserID`, so no mapping
     * table is needed.
     */
    entitlements: defineTable({
        userId: v.string(),
        isPro: v.boolean(),
        productId: v.optional(v.string()),
        /** Epoch ms. Absent means a non-expiring grant. */
        expiresAt: v.optional(v.number()),
        store: v.optional(v.string()),
        environment: v.optional(v.string()),
        /**
         * The source event's timestamp, used for ordering. RevenueCat retries for days
         * and can deliver out of order, so an older event must never overwrite a newer
         * one.
         */
        eventTimestampMs: v.optional(v.number()),
        updatedAt: v.number(),
    }).index('by_user', ['userId']),

    userSettings: defineTable({
        userId: v.string(),
        monthlyBudget: v.optional(v.number()),
        reminderDaysBefore: v.optional(v.number()),
        notificationsEnabled: v.optional(v.boolean()),
        trialAlertsEnabled: v.optional(v.boolean()),
        weeklyDigestEnabled: v.optional(v.boolean()),
        monthlyIncome: v.optional(v.number()),
        themePreference: v.optional(v.string()),
        currency: v.optional(v.string()),
    }).index('by_user', ['userId']),
});
