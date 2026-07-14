import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./model";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await ctx.db.insert("subscriptions", {
      ...args,
      userId,
      statusChangedAt: new Date().toISOString(),
      priceHistory: [{ price: args.price, changedAt: new Date().toISOString() }],
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("subscriptions"),
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
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Subscription not found");
    }

    let priceHistory = existing.priceHistory ?? [
      { price: existing.price, changedAt: new Date().toISOString() },
    ];
    if (patch.price !== undefined && patch.price !== existing.price) {
      priceHistory = [...priceHistory, { price: patch.price, changedAt: new Date().toISOString() }];
    }

    await ctx.db.patch(id, { ...patch, priceHistory });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("subscriptions"),
    status: v.string(),
  },
  handler: async (ctx, { id, status }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Subscription not found");
    }
    await ctx.db.patch(id, { status, statusChangedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Subscription not found");
    }
    await ctx.db.delete(id);
  },
});
