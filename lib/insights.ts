import dayjs from 'dayjs';

const MONTHLY_BILLING_VALUES = new Set(['monthly', 'month']);

/** People splitting a subscription, including the owner. Never less than one. */
export function householdSizeOf(sub: Subscription): number {
    const size = sub.householdSize ?? 1;
    return Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
}

/** The owner's share of the sticker price once a shared plan is split. */
export function personalPrice(sub: Subscription): number {
    return sub.price / householdSizeOf(sub);
}

/**
 * Normalizes any billing cadence to an equivalent monthly cost, counting only the
 * owner's share — someone splitting a family plan four ways is not spending the full
 * sticker price, and every total in the app should reflect what they actually pay.
 */
export function monthlyEquivalent(sub: Subscription): number {
    const billing = sub.billing?.toLowerCase() ?? '';
    const share = personalPrice(sub);
    return MONTHLY_BILLING_VALUES.has(billing) ? share : share / 12;
}

function isActive(sub: Subscription): boolean {
    return sub.status === 'active';
}

/** True while a free trial is still running — i.e. nothing has been charged yet. */
export function isTrialing(sub: Subscription): boolean {
    if (!sub.isTrial || !sub.trialEndsAt) return false;
    const endsAt = dayjs(sub.trialEndsAt);
    return endsAt.isValid() && !endsAt.startOf('day').isBefore(dayjs().startOf('day'));
}

/** Active *and* actually being charged. Trials are excluded until they convert. */
function isBilling(sub: Subscription): boolean {
    return isActive(sub) && !isTrialing(sub);
}

export function getMonthlySpend(subscriptions: Subscription[]): number {
    return subscriptions.filter(isBilling).reduce((sum, sub) => sum + monthlyEquivalent(sub), 0);
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
    const active = subscriptions.filter(isBilling);
    const totalMonthly = getMonthlySpend(subscriptions);
    const byCategory = new Map<string, { total: number; count: number }>();

    for (const sub of active) {
        const category = sub.category?.trim() || 'Other';
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
        label: start.add(i, 'month').format('MMM'),
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
            if (sub.status === 'active') acc.active += 1;
            else if (sub.status === 'paused') acc.paused += 1;
            else if (sub.status === 'cancelled') acc.cancelled += 1;
            return acc;
        },
        { active: 0, paused: 0, cancelled: 0 },
    );
}

export function getMostExpensive(subscriptions: Subscription[]): Subscription | null {
    const active = subscriptions.filter(isBilling);
    if (active.length === 0) return null;
    return active.reduce((max, sub) =>
        monthlyEquivalent(sub) > monthlyEquivalent(max) ? sub : max,
    );
}

export interface NextRenewal {
    subscription: Subscription;
    date: string;
}

export function getNextRenewal(subscriptions: Subscription[]): NextRenewal | null {
    const today = dayjs().startOf('day');
    const upcoming = subscriptions
        .filter((sub) => {
            if (!isActive(sub) || !sub.renewalDate) return false;
            const renewalDate = dayjs(sub.renewalDate);
            return renewalDate.isValid() && !renewalDate.startOf('day').isBefore(today);
        })
        .sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));

    if (upcoming.length === 0) return null;
    return { subscription: upcoming[0], date: upcoming[0].renewalDate! };
}

export function getUpcomingRenewals(subscriptions: Subscription[], withinDays = 7): Subscription[] {
    const today = dayjs().startOf('day');
    const cutoff = today.add(withinDays, 'days');
    return subscriptions
        .filter((sub) => {
            if (!isActive(sub) || !sub.renewalDate) return false;
            const renewalDate = dayjs(sub.renewalDate);
            const renewalDay = renewalDate.startOf('day');
            return (
                renewalDate.isValid() && !renewalDay.isBefore(today) && !renewalDay.isAfter(cutoff)
            );
        })
        .sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));
}

export interface RenewalTimelineEntry {
    subscription: Subscription;
    date: string;
    daysUntil: number;
}

export function getRenewalTimeline(
    subscriptions: Subscription[],
    withinDays = 30,
): RenewalTimelineEntry[] {
    const today = dayjs().startOf('day');

    return getUpcomingRenewals(subscriptions, withinDays).map((subscription) => ({
        subscription,
        date: subscription.renewalDate!,
        daysUntil: Math.max(0, dayjs(subscription.renewalDate).startOf('day').diff(today, 'day')),
    }));
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
    return {
        spent,
        budget: monthlyBudget,
        percentage,
        isOverBudget: monthlyBudget > 0 && spent > monthlyBudget,
    };
}

export interface TrialEntry {
    subscription: Subscription;
    endsAt: string;
    daysUntilCharge: number;
}

/** Every trial that hasn't converted yet, soonest charge first. */
export function getActiveTrials(subscriptions: Subscription[]): TrialEntry[] {
    const today = dayjs().startOf('day');

    return subscriptions
        .filter((sub) => isActive(sub) && isTrialing(sub))
        .map((subscription) => ({
            subscription,
            endsAt: subscription.trialEndsAt!,
            daysUntilCharge: Math.max(
                0,
                dayjs(subscription.trialEndsAt).startOf('day').diff(today, 'day'),
            ),
        }))
        .sort((a, b) => a.daysUntilCharge - b.daysUntilCharge);
}

/** Trials close enough to converting that the user still has time to act. */
export function getEndingTrials(subscriptions: Subscription[], withinDays = 7): TrialEntry[] {
    return getActiveTrials(subscriptions).filter((entry) => entry.daysUntilCharge <= withinDays);
}

/** What monthly spend becomes if every running trial converts instead of being cancelled. */
export function getTrialCommitment(subscriptions: Subscription[]): number {
    return subscriptions
        .filter((sub) => isActive(sub) && isTrialing(sub))
        .reduce((sum, sub) => sum + monthlyEquivalent(sub), 0);
}

export interface ReclaimedSavings {
    monthly: number;
    yearly: number;
    count: number;
    /** ISO date of the first cancellation, or null when nothing has been cancelled yet. */
    since: string | null;
}

/**
 * Money the user stopped paying by cancelling through Lumora. Derived from the
 * cancelled set rather than stored, so it stays correct if history is edited.
 */
export function getReclaimedSavings(subscriptions: Subscription[]): ReclaimedSavings {
    const cancelled = subscriptions.filter((sub) => sub.status === 'cancelled');
    const monthly = cancelled.reduce((sum, sub) => sum + monthlyEquivalent(sub), 0);

    const firstCancelledAt = cancelled
        .map((sub) => sub.statusChangedAt)
        .filter((value): value is string => Boolean(value) && dayjs(value).isValid())
        .sort()[0];

    return {
        monthly,
        yearly: monthly * 12,
        count: cancelled.length,
        since: firstCancelledAt ?? null,
    };
}

export interface CostPerUse {
    /** Effective cost each time the user actually used it. */
    perUse: number;
    uses: number;
    /** Months the tally has been running, floored at one so the maths stays sane. */
    monthsTracked: number;
    /** Costs more per use than the whole plan costs per month — a clear cancel signal. */
    isPoorValue: boolean;
}

/**
 * What each actual use costs. This is the number that settles "should I cancel this":
 * a cheap plan opened twice a year is a worse deal than an expensive one used daily,
 * and nothing else in the app surfaces that.
 *
 * Returns null until there is something to divide — a zero-use subscription has an
 * infinite cost per use, which is a statement about the data rather than the value.
 */
export function getCostPerUse(sub: Subscription): CostPerUse | null {
    const uses = sub.usageCount ?? 0;
    if (uses <= 0) return null;

    const since = sub.usageSince ? dayjs(sub.usageSince) : null;
    const monthsTracked = since?.isValid() ? Math.max(1, dayjs().diff(since, 'month') + 1) : 1;

    const spentOverPeriod = monthlyEquivalent(sub) * monthsTracked;
    const perUse = spentOverPeriod / uses;

    return {
        perUse,
        uses,
        monthsTracked,
        isPoorValue: perUse > monthlyEquivalent(sub),
    };
}

/** Active subscriptions with a usage tally, worst value first. */
export function getUsageRanking(
    subscriptions: Subscription[],
): { subscription: Subscription; costPerUse: CostPerUse }[] {
    return subscriptions
        .filter((sub) => sub.status === 'active' && (sub.usageCount ?? 0) > 0)
        .map((subscription) => ({ subscription, costPerUse: getCostPerUse(subscription)! }))
        .sort((a, b) => b.costPerUse.perUse - a.costPerUse.perUse);
}

/** Active subscriptions tracked long enough to expect a use, but never opened. */
export function getUnusedSubscriptions(
    subscriptions: Subscription[],
    minDays = 30,
): Subscription[] {
    const cutoff = dayjs().subtract(minDays, 'day');
    return subscriptions.filter((sub) => {
        if (sub.status !== 'active' || isTrialing(sub)) return false;
        if ((sub.usageCount ?? 0) > 0) return false;
        const started = sub.startDate ? dayjs(sub.startDate) : null;
        return Boolean(started?.isValid() && started.isBefore(cutoff));
    });
}

export interface IncomeContext {
    /** Share of monthly income going to subscriptions, 0–100. */
    percentage: number;
    /** Rough guidance band. Not financial advice — see the copy in the UI. */
    band: 'low' | 'typical' | 'high';
    monthlyIncome: number;
}

/**
 * Frames spend against income. "£140 a month" means nothing on its own; "9% of what you
 * earn" is the number that actually lands. Bands are a widely-cited rule of thumb rather
 * than a regulated benchmark, and the UI labels them that way.
 */
export function getIncomeContext(
    subscriptions: Subscription[],
    monthlyIncome: number | undefined,
): IncomeContext | null {
    if (!monthlyIncome || !Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return null;

    const percentage = (getMonthlySpend(subscriptions) / monthlyIncome) * 100;
    const band = percentage < 3 ? 'low' : percentage <= 8 ? 'typical' : 'high';

    return { percentage, band, monthlyIncome };
}

export interface WhatIfResult {
    /** Monthly spend once the selected subscriptions are removed. */
    newMonthly: number;
    monthlySaving: number;
    yearlySaving: number;
    removedCount: number;
}

/**
 * Models cancelling a set of subscriptions without touching any data.
 *
 * The gap between "I should cancel something" and actually doing it is where these apps
 * lose people. Letting someone try combinations first, and see the annual number before
 * committing, is the nudge that turns intent into a cancellation.
 */
export function simulateCancellations(
    subscriptions: Subscription[],
    removedIds: string[],
): WhatIfResult {
    const removed = new Set(removedIds);
    const kept = subscriptions.filter((sub) => !removed.has(sub.id));

    const currentMonthly = getMonthlySpend(subscriptions);
    const newMonthly = getMonthlySpend(kept);
    const monthlySaving = currentMonthly - newMonthly;

    return {
        newMonthly,
        monthlySaving,
        yearlySaving: monthlySaving * 12,
        // Only count ones that were actually contributing to spend.
        removedCount: subscriptions.filter((sub) => removed.has(sub.id) && isBilling(sub)).length,
    };
}

/** Case-insensitive duplicate check, so the same service isn't tracked twice. */
export function findDuplicateName(
    subscriptions: Subscription[],
    name: string,
): Subscription | null {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    return subscriptions.find((sub) => sub.name.trim().toLowerCase() === needle) ?? null;
}

export interface SpendRates {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
}

/**
 * The same commitment expressed at four cadences. A daily figure lands very differently
 * from a monthly one — "£1.40 a day" is the number that makes people act.
 */
export function getSpendRates(subscriptions: Subscription[]): SpendRates {
    const monthly = getMonthlySpend(subscriptions);
    const yearly = monthly * 12;

    return {
        // Derived from the annual figure so month length never skews the daily rate.
        daily: yearly / 365,
        weekly: yearly / 52,
        monthly,
        yearly,
    };
}

export interface CalendarDay {
    /** ISO date for the day. */
    date: string;
    dayOfMonth: number;
    isToday: boolean;
    /** Empty on days with nothing due. */
    renewals: Subscription[];
    total: number;
}

/**
 * A month of renewal activity, padded to whole weeks so it renders as a 7-column grid.
 * Leading and trailing days from adjacent months are included but flagged via `dayOfMonth`
 * belonging to a different month — callers dim them.
 */
export function getRenewalCalendar(
    subscriptions: Subscription[],
    monthAnchor = dayjs(),
): CalendarDay[] {
    const monthStart = monthAnchor.startOf('month');
    const monthEnd = monthAnchor.endOf('month');
    const gridStart = monthStart.startOf('week');
    const gridEnd = monthEnd.endOf('week');
    const today = dayjs().startOf('day');

    const dueByDay = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
        if (sub.status !== 'active' || !sub.renewalDate) continue;
        const renewal = dayjs(sub.renewalDate);
        if (!renewal.isValid()) continue;

        const key = renewal.format('YYYY-MM-DD');
        dueByDay.set(key, [...(dueByDay.get(key) ?? []), sub]);
    }

    const days: CalendarDay[] = [];
    for (let cursor = gridStart; !cursor.isAfter(gridEnd); cursor = cursor.add(1, 'day')) {
        const key = cursor.format('YYYY-MM-DD');
        const renewals = dueByDay.get(key) ?? [];

        days.push({
            date: cursor.toISOString(),
            dayOfMonth: cursor.date(),
            isToday: cursor.isSame(today, 'day'),
            renewals,
            total: renewals.reduce((sum, sub) => sum + personalPrice(sub), 0),
        });
    }

    return days;
}

/** True when the day belongs to the month being displayed rather than the padding. */
export function isInMonth(day: CalendarDay, monthAnchor = dayjs()): boolean {
    return dayjs(day.date).isSame(monthAnchor, 'month');
}

export interface SpendHistoryPoint {
    /** Short month label, e.g. "Mar". */
    label: string;
    /** First day of the month, ISO. */
    monthStart: string;
    amount: number;
}

/** The price a subscription was charging at a given moment, from its price history. */
export function priceAt(sub: Subscription, when: dayjs.Dayjs): number {
    const history = sub.priceHistory;
    if (!history || history.length === 0) return sub.price;

    // History is appended in order, so the last entry at or before `when` is the one live then.
    let price = history[0].price;
    for (const entry of history) {
        const changedAt = dayjs(entry.changedAt);
        if (changedAt.isValid() && !changedAt.isAfter(when)) price = entry.price;
    }
    return price;
}

/** Whether a subscription was being billed during the given month. */
function wasBillingDuring(
    sub: Subscription,
    monthStart: dayjs.Dayjs,
    monthEnd: dayjs.Dayjs,
): boolean {
    const started = sub.startDate ? dayjs(sub.startDate) : null;
    if (started?.isValid() && started.isAfter(monthEnd)) return false;

    // A subscription that was stopped counts up to the month it was stopped in.
    if (sub.status === 'cancelled' || sub.status === 'paused') {
        const stoppedAt = sub.statusChangedAt ? dayjs(sub.statusChangedAt) : null;
        if (!stoppedAt?.isValid()) return false;
        if (stoppedAt.isBefore(monthStart)) return false;
    }

    // A trial that hadn't converted yet in that month cost nothing.
    if (sub.isTrial && sub.trialEndsAt) {
        const trialEnd = dayjs(sub.trialEndsAt);
        if (trialEnd.isValid() && trialEnd.isAfter(monthEnd)) return false;
    }

    return true;
}

/**
 * Reconstructs monthly spend over the trailing `months` window from start dates,
 * status changes and price history. Nothing extra is stored — this is derived, so it
 * stays correct when the user edits their history.
 */
export function getSpendHistory(subscriptions: Subscription[], months = 6): SpendHistoryPoint[] {
    const thisMonth = dayjs().startOf('month');

    return Array.from({ length: months }, (_, index) => {
        const monthStart = thisMonth.subtract(months - 1 - index, 'month');
        const monthEnd = monthStart.endOf('month');

        const amount = subscriptions
            .filter((sub) => wasBillingDuring(sub, monthStart, monthEnd))
            .reduce((sum, sub) => {
                const historicPrice = priceAt(sub, monthEnd);
                const share = historicPrice / householdSizeOf(sub);
                const billing = sub.billing?.toLowerCase() ?? '';
                return sum + (MONTHLY_BILLING_VALUES.has(billing) ? share : share / 12);
            }, 0);

        return { label: monthStart.format('MMM'), monthStart: monthStart.toISOString(), amount };
    });
}

/** Percentage change between the first and last month of a history window. */
export function getSpendTrend(history: SpendHistoryPoint[]): number | null {
    if (history.length < 2) return null;
    const first = history[0].amount;
    const last = history[history.length - 1].amount;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
}

/** Typical annual-plan discount across consumer SaaS — roughly "two months free". */
export const ANNUAL_PLAN_DISCOUNT = 1 / 6;

export interface AnnualUpgradeNudge {
    subscription: Subscription;
    currentYearly: number;
    estimatedYearly: number;
    estimatedSaving: number;
}

/**
 * Monthly subscriptions where moving to an annual plan would plausibly pay off.
 * The saving is an estimate from the common "two months free" discount, not a quote —
 * callers must label it as such.
 */
export function detectAnnualUpgradeCandidates(
    subscriptions: Subscription[],
    minMonthlySpend = 4,
): AnnualUpgradeNudge[] {
    return subscriptions
        .filter((sub) => {
            if (!isActive(sub) || isTrialing(sub)) return false;
            if (!MONTHLY_BILLING_VALUES.has(sub.billing?.toLowerCase() ?? '')) return false;
            return monthlyEquivalent(sub) >= minMonthlySpend;
        })
        .map((subscription) => {
            const currentYearly = monthlyEquivalent(subscription) * 12;
            const estimatedYearly = currentYearly * (1 - ANNUAL_PLAN_DISCOUNT);
            return {
                subscription,
                currentYearly,
                estimatedYearly,
                estimatedSaving: currentYearly - estimatedYearly,
            };
        })
        .sort((a, b) => b.estimatedSaving - a.estimatedSaving);
}

/** Active subscriptions being split with other people. */
export function getSharedSubscriptions(subscriptions: Subscription[]): Subscription[] {
    return subscriptions.filter((sub) => isActive(sub) && householdSizeOf(sub) > 1);
}

/** What sharing saves the user each month versus paying every plan alone. */
export function getSharingSavings(subscriptions: Subscription[]): number {
    return getSharedSubscriptions(subscriptions).reduce((sum, sub) => {
        const billing = sub.billing?.toLowerCase() ?? '';
        const fullMonthly = MONTHLY_BILLING_VALUES.has(billing) ? sub.price : sub.price / 12;
        return sum + (fullMonthly - monthlyEquivalent(sub));
    }, 0);
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
        (sub) =>
            sub.status === 'paused' &&
            sub.statusChangedAt &&
            now.diff(dayjs(sub.statusChangedAt), 'day') >= days,
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
    const cutoff = dayjs().subtract(withinDays, 'day');
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
