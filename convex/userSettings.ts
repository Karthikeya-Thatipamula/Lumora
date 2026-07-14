import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./model";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const update = mutation({
  args: {
    monthlyBudget: v.optional(v.number()),
    reminderDaysBefore: v.optional(v.number()),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, patch) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("userSettings", { userId, ...patch });
    }
  },
});
