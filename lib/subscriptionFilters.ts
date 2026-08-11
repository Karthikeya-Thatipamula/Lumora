import { isTrialing, monthlyEquivalent } from '@/lib/insights';
import dayjs from 'dayjs';

export type StatusFilter = 'all' | 'active' | 'trials' | 'paused' | 'cancelled';
export type SortOrder = 'renewal' | 'priceHigh' | 'priceLow' | 'name';

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'trials', label: 'Trials' },
    { key: 'paused', label: 'Paused' },
    { key: 'cancelled', label: 'Archive' },
];

export const SORT_ORDERS: { key: SortOrder; label: string }[] = [
    { key: 'renewal', label: 'Next renewal' },
    { key: 'priceHigh', label: 'Priciest' },
    { key: 'priceLow', label: 'Cheapest' },
    { key: 'name', label: 'A–Z' },
];

export function matchesStatusFilter(sub: Subscription, filter: StatusFilter): boolean {
    switch (filter) {
        case 'all':
            // "All" means everything still in play — cancelled lives in the archive tab.
            return sub.status !== 'cancelled';
        case 'active':
            return sub.status === 'active' && !isTrialing(sub);
        case 'trials':
            return sub.status === 'active' && isTrialing(sub);
        case 'paused':
            return sub.status === 'paused';
        case 'cancelled':
            return sub.status === 'cancelled';
    }
}

/** Case-insensitive match across the fields a user would plausibly search by. */
export function matchesSearch(sub: Subscription, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;

    return [sub.name, sub.category, sub.plan, sub.paymentMethod]
        .some((field) => field?.toLowerCase().includes(needle));
}

function compare(a: Subscription, b: Subscription, order: SortOrder): number {
    switch (order) {
        case 'priceHigh':
            return monthlyEquivalent(b) - monthlyEquivalent(a);
        case 'priceLow':
            return monthlyEquivalent(a) - monthlyEquivalent(b);
        case 'name':
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'renewal': {
            // Undated subscriptions sink to the bottom rather than sorting as epoch 0.
            const aDate = a.renewalDate ? dayjs(a.renewalDate) : null;
            const bDate = b.renewalDate ? dayjs(b.renewalDate) : null;
            const aValid = aDate?.isValid() ? aDate.valueOf() : Number.POSITIVE_INFINITY;
            const bValid = bDate?.isValid() ? bDate.valueOf() : Number.POSITIVE_INFINITY;
            return aValid - bValid;
        }
    }
}

export function filterAndSort(
    subscriptions: Subscription[],
    { query, status, order }: { query: string; status: StatusFilter; order: SortOrder }
): Subscription[] {
    return subscriptions
        .filter((sub) => matchesStatusFilter(sub, status) && matchesSearch(sub, query))
        .slice()
        .sort((a, b) => compare(a, b, order));
}

/** How many subscriptions each filter would show, for the counts on the chips. */
export function countsByFilter(subscriptions: Subscription[]): Record<StatusFilter, number> {
    return STATUS_FILTERS.reduce(
        (acc, { key }) => {
            acc[key] = subscriptions.filter((sub) => matchesStatusFilter(sub, key)).length;
            return acc;
        },
        {} as Record<StatusFilter, number>
    );
}

/** Distinct payment methods actually in use, for the quick-pick chips on the form. */
export function knownPaymentMethods(subscriptions: Subscription[]): string[] {
    const seen = new Map<string, string>();
    for (const sub of subscriptions) {
        const method = sub.paymentMethod?.trim();
        if (method) seen.set(method.toLowerCase(), method);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
