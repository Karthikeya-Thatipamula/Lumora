import type { Doc } from '@/convex/_generated/dataModel';
import type { Frequency, SubscriptionStatus } from '@/convex/domain';

/**
 * Shared subscription vocabulary.
 *
 * Lives in `lib/` rather than inside the create/edit modal so that pure logic
 * (`lib/csvImport.ts`, the test suite) can import it without pulling in React Native.
 *
 * `Frequency` and `SubscriptionStatus` are re-exported from `convex/domain.ts`, where
 * they are derived from the Convex validators. Declaring them here as well is what let
 * the client and the database drift apart in the first place.
 */

export type { Frequency, SubscriptionStatus };

/**
 * A subscription as the app sees it: the stored document with Convex's bookkeeping
 * fields swapped for a plain `id`.
 *
 * Derived from `Doc<'subscriptions'>`, so `convex/schema.ts` is the single source of
 * truth. Add a field to the schema and every consumer gains it; remove one and every
 * consumer fails to compile. The hand-written version of this type had already grown a
 * `frequency` field with no database counterpart.
 *
 * `id` stays a plain `string` rather than `Id<'subscriptions'>`. Branding it would ripple
 * into `simulateCancellations`, `useLocalSearchParams` and every test fixture for no
 * safety the casts at the mutation boundary do not already provide.
 */
export type Subscription = Omit<Doc<'subscriptions'>, '_id' | '_creationTime' | 'userId'> & {
    id: string;
};

export type Category =
    'Entertainment' | 'AI Tools' | 'Developer Tools' | 'Design' | 'Productivity' | 'Other';

export const CATEGORIES: Category[] = [
    'Entertainment',
    'AI Tools',
    'Developer Tools',
    'Design',
    'Productivity',
    'Other',
];

/**
 * Narrows a stored category string to one the UI understands.
 *
 * The database keeps `category` as a free string on purpose (see convex/domain.ts), so
 * every read boundary needs this rather than a cast. `as Category` on the detail screen
 * was a lie that happened to hold.
 */
export function toCategory(raw: string | undefined): Category {
    if (!raw) return 'Other';
    return (
        CATEGORIES.find((category) => category.toLowerCase() === raw.trim().toLowerCase()) ??
        'Other'
    );
}

/** Narrows a stored billing string. Anything unrecognised bills monthly, never annually. */
export function toFrequency(raw: string | undefined): Frequency {
    return raw?.trim().toLowerCase() === 'yearly' ? 'Yearly' : 'Monthly';
}

export const CATEGORY_COLORS: Record<Category, string> = {
    Entertainment: '#ff6b6b',
    'AI Tools': '#b8d4e3',
    'Developer Tools': '#e8def8',
    Design: '#f5c542',
    Productivity: '#95e1d3',
    Other: '#d4d4d4',
};

export const TRIAL_LENGTH_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_TRIAL_LENGTH = 7;
export const HOUSEHOLD_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Guards against fat-finger entries like a 12-digit price breaking every total. */
export const MAX_PRICE = 1_000_000;
export const MAX_NAME_LENGTH = 60;

export interface SubscriptionFormValues {
    name: string;
    price: number;
    frequency: Frequency;
    category: Category;
    currency?: string;
    /** Free text, e.g. "Amex ...1004" or "PayPal". */
    paymentMethod?: string;
    isTrial?: boolean;
    /** Trial length in days. Only read when a trial is being started. */
    trialDays?: number;
    /** People splitting the cost, including the user. 1 means not shared. */
    householdSize?: number;
    /**
     * Only set by CSV import, which has to be able to bring a cancelled or paused
     * subscription back as it was. Everything created in the app starts active.
     */
    status?: SubscriptionStatus;
}
