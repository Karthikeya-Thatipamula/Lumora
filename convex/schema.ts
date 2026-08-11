import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
        })
      )
    ),
  }).index("by_user", ["userId"]),

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
  }).index("by_user", ["userId"]),
});
