import dayjs from "dayjs";

const MONTHLY_BILLING_VALUES = new Set(["monthly", "month"]);

/** Normalizes any billing cadence to an equivalent monthly cost. */
export function monthlyEquivalent(sub: Subscription): number {
    const billing = sub.billing?.toLowerCase() ?? "";
    return MONTHLY_BILLING_VALUES.has(billing) ? sub.price : sub.price / 12;
}

function isActive(sub: Subscription): boolean {
    return sub.status === "active";
}

export function getMonthlySpend(subscriptions: Subscription[]): number {
    return subscriptions.filter(isActive).reduce((sum, sub) => sum + monthlyEquivalent(sub), 0);
}

export function getYearlySpend(subscriptions: Subscription[]): number {
    return getMonthlySpend(subscriptions) * 12;
}

export interface CategoryBreakdownEntry {
    category: string;
    monthlyTotal: number;
    percentage: number;
    count: number;
}

export function getCategoryBreakdown(subscriptions: Subscription[]): CategoryBreakdownEntry[] {
    const active = subscriptions.filter(isActive);
    const totalMonthly = getMonthlySpend(subscriptions);
    const byCategory = new Map<string, { total: number; count: number }>();

    for (const sub of active) {
        const category = sub.category?.trim() || "Other";
        const entry = byCategory.get(category) ?? { total: 0, count: 0 };
        entry.total += monthlyEquivalent(sub);
        entry.count += 1;
        byCategory.set(category, entry);
    }

    return Array.from(byCategory.entries())
        .map(([category, { total, count }]) => ({
            category,
            monthlyTotal: total,
            percentage: totalMonthly > 0 ? (total / totalMonthly) * 100 : 0,
            count,
        }))
        .sort((a, b) => b.monthlyTotal - a.monthlyTotal);
}

export interface ForecastEntry {
    label: string;
    amount: number;
}

/** Projects flat monthly spend forward assuming today's active subscriptions hold steady. */
export function getForecast(subscriptions: Subscription[], months = 6): ForecastEntry[] {
    const monthly = getMonthlySpend(subscriptions);
    const start = dayjs();
    return Array.from({ length: months }, (_, i) => ({
        label: start.add(i, "month").format("MMM"),
        amount: monthly,
    }));
}

export interface StatusCounts {
    active: number;
    paused: number;
    cancelled: number;
}

export function getStatusCounts(subscriptions: Subscription[]): StatusCounts {
    return subscriptions.reduce(
        (acc, sub) => {
            if (sub.status === "active") acc.active += 1;
            else if (sub.status === "paused") acc.paused += 1;
            else if (sub.status === "cancelled") acc.cancelled += 1;
            return acc;
        },
        { active: 0, paused: 0, cancelled: 0 }
    );
}

export function getMostExpensive(subscriptions: Subscription[]): Subscription | null {
    const active = subscriptions.filter(isActive);
    if (active.length === 0) return null;
    return active.reduce((max, sub) => (monthlyEquivalent(sub) > monthlyEquivalent(max) ? sub : max));
}

export interface NextRenewal {
    subscription: Subscription;
    date: string;
}

export function getNextRenewal(subscriptions: Subscription[]): NextRenewal | null {
    const now = dayjs();
    const upcoming = subscriptions
        .filter((sub) => isActive(sub) && sub.renewalDate && dayjs(sub.renewalDate).isAfter(now))
        .sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));

    if (upcoming.length === 0) return null;
    return { subscription: upcoming[0], date: upcoming[0].renewalDate! };
}

export function getUpcomingRenewals(subscriptions: Subscription[], withinDays = 7): Subscription[] {
    const now = dayjs();
    const cutoff = now.add(withinDays, "days");
    return subscriptions
        .filter((sub) => isActive(sub) && sub.renewalDate && dayjs(sub.renewalDate).isAfter(now) && dayjs(sub.renewalDate).isBefore(cutoff))
        .sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));
}

export interface BudgetUsage {
    spent: number;
    budget: number;
    percentage: number;
    isOverBudget: boolean;
}

export function getBudgetUsage(subscriptions: Subscription[], monthlyBudget: number): BudgetUsage {
    const spent = getMonthlySpend(subscriptions);
    const percentage = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;
    return { spent, budget: monthlyBudget, percentage, isOverBudget: monthlyBudget > 0 && spent > monthlyBudget };
}

export interface DuplicateCategoryNudge {
    category: string;
    subscriptions: Subscription[];
}

/** Flags categories with 2+ active subscriptions — a common candidate for consolidation. */
export function detectDuplicateCategories(subscriptions: Subscription[]): DuplicateCategoryNudge[] {
    const byCategory = new Map<string, Subscription[]>();
    for (const sub of subscriptions.filter(isActive)) {
        const category = sub.category?.trim();
        if (!category) continue;
        const list = byCategory.get(category) ?? [];
        list.push(sub);
        byCategory.set(category, list);
    }
    return Array.from(byCategory.entries())
        .filter(([, subs]) => subs.length >= 2)
        .map(([category, subs]) => ({ category, subscriptions: subs }));
}

/** Flags subscriptions paused for longer than `days` — likely candidates to cancel outright. */
export function detectStalePaused(subscriptions: Subscription[], days = 30): Subscription[] {
    const now = dayjs();
    return subscriptions.filter(
        (sub) => sub.status === "paused" && sub.statusChangedAt && now.diff(dayjs(sub.statusChangedAt), "day") >= days
    );
}

export interface PriceHikeNudge {
    subscription: Subscription;
    previousPrice: number;
    currentPrice: number;
    changedAt: string;
}

/** Flags subscriptions whose most recent price change was an increase within the last 90 days. */
export function detectPriceHikes(subscriptions: Subscription[], withinDays = 90): PriceHikeNudge[] {
    const cutoff = dayjs().subtract(withinDays, "day");
    const nudges: PriceHikeNudge[] = [];

    for (const sub of subscriptions) {
        const history = sub.priceHistory;
        if (!history || history.length < 2) continue;

        const [previous, current] = history.slice(-2);
        if (current.price > previous.price && dayjs(current.changedAt).isAfter(cutoff)) {
            nudges.push({
                subscription: sub,
                previousPrice: previous.price,
                currentPrice: current.price,
                changedAt: current.changedAt,
            });
        }
    }

    return nudges;
}
