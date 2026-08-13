import { Infer, v } from 'convex/values';

/**
 * The subscription vocabulary, defined once.
 *
 * These types were previously declared twice: as a TypeScript union in
 * `lib/subscriptionTypes.ts` and as a bare `v.string()` in the Convex schema and arg
 * validators. Predictably they drifted — the client's `Subscription` grew a `frequency`
 * field the database never had, and `status` was optional on the client while Convex
 * required it.
 *
 * Direction of derivation matters. Declare the **validator** and read the type off it
 * with `Infer<>`, not the other way round: `v.union(...ARRAY.map(v.literal))` loses
 * literal inference under the spread — TypeScript widens the tuple and you get
 * `VUnion<string>`, recreating exactly the drift this is meant to eliminate. Going
 * validator-first also buys runtime rejection at the Convex boundary for free.
 *
 * This file lives in `convex/` and imports only `convex/values`, because `convex/` must
 * never import from the app. The client reaches *down* into it via
 * `lib/subscriptionTypes.ts`.
 */

export const frequencyValidator = v.union(v.literal('Monthly'), v.literal('Yearly'));
export type Frequency = Infer<typeof frequencyValidator>;

export const statusValidator = v.union(
    v.literal('active'),
    v.literal('paused'),
    v.literal('cancelled'),
);
export type SubscriptionStatus = Infer<typeof statusValidator>;

/**
 * `category` stays a free string in the database, deliberately.
 *
 * It is the field most likely to hold arbitrary text — CSV imports from other apps, the
 * `plan` fallback on the detail screen, and any future user-defined categories. Locking
 * *storage* to six literals would foreclose that and add a deploy-failure risk for no
 * benefit. The honest model is: the database stores a string, the UI understands six of
 * them, and `toCategory()` in lib/subscriptionTypes.ts narrows at the boundary.
 */

/** Arrays for rendering pickers. Derived from the validators so they cannot drift. */
export const FREQUENCIES: readonly Frequency[] = ['Monthly', 'Yearly'];
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
    'active',
    'paused',
    'cancelled',
];
