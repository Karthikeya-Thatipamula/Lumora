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
  }).index("by_user", ["userId"]),
});
