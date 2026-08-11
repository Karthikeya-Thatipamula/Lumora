/**
 * Shared subscription vocabulary.
 *
 * Lives in `lib/` rather than inside the create/edit modal so that pure logic
 * (`lib/csvImport.ts`, the test suite) can import it without pulling in React Native.
 * The modal re-exports these for the screens that already import from it.
 */

export type Frequency = 'Monthly' | 'Yearly';

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
}
