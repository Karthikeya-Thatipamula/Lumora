/**
 * Logic suite for Lumora's pure modules — the ones deliberately kept free of React and
 * native code so their maths can be checked headlessly.
 *
 * Ported from scripts/logic-tests/run.ts, which staged rewritten copies of these modules
 * into a temp dir, compiled them with tsc and ran them under plain node. Jest resolves
 * `@/` natively, so the staging is gone.
 *
 * The assertions are unchanged, including their comparison semantics. The original
 * `check` compared `JSON.stringify` output, which differs from `toEqual` on key order and
 * on `undefined`; swapping matchers would have quietly changed what 265 assertions mean.
 * So the string comparison is kept, with a structural `toEqual` fired first purely to get
 * a readable diff when the shapes differ.
 *
 * Cases are registered eagerly, as they were in the script, and handed to Jest at the
 * bottom of the file. That preserves the original top-to-bottom evaluation order and lets
 * fixtures declared in one section stay visible to later ones.
 */
import dayjs from 'dayjs';
import { easeOutCubic, interpolateValue, shouldAnimateChange } from '@/lib/animation';
import { buildSubscriptionsCsv, escapeCsv } from '@/lib/csv';
import { findImportDuplicates, parseCsvLine, parseSubscriptionsCsv } from '@/lib/csvImport';
import { getCancellationUrl, getDiscoveryCoverage, getDiscoveryPrompts } from '@/lib/discovery';
import { getAvatarColor, getInitials, resolveIconKey } from '@/lib/icon-resolver';
import {
    detectAnnualUpgradeCandidates,
    detectPriceHikes,
    detectStalePaused,
    findDuplicateName,
    getActiveTrials,
    getCategoryBreakdown,
    getCostPerUse,
    getEndingTrials,
    getIncomeContext,
    getMonthlySpend,
    getMostExpensive,
    getNextRenewal,
    getReclaimedSavings,
    getRenewalCalendar,
    getRenewalTimeline,
    getSharingSavings,
    getSpendHistory,
    getSpendRates,
    getUnusedSubscriptions,
    getUsageRanking,
    getSpendTrend,
    getTrialCommitment,
    getUpcomingRenewals,
    getYearlySpend,
    householdSizeOf,
    isInMonth,
    isTrialing,
    personalPrice,
    priceAt,
    simulateCancellations,
} from '@/lib/insights';
import { describePasswordStrength } from '@/lib/passwordStrength';
import {
    countsByFilter,
    filterAndSort,
    knownPaymentMethods,
    matchesSearch,
} from '@/lib/subscriptionFilters';
import { formatCurrency, formatStatusLabel, formatSubscriptionDateTime } from '@/lib/utils';

interface LogicCase {
    name: string;
    run: () => void;
}

const groups: { name: string; cases: LogicCase[] }[] = [];
let current: LogicCase[] = [];

function section(name: string) {
    current = [];
    groups.push({ name, cases: current });
}

function check(name: string, actual: unknown, expected: unknown) {
    current.push({
        name,
        run: () => {
            const a = JSON.stringify(actual);
            const e = JSON.stringify(expected);
            if (a === e) return;
            // Structural first, for the diff; then the exact comparison the suite used.
            expect(actual).toEqual(expected);
            expect(a).toBe(e);
        },
    });
}

const iso = (daysFromNow: number) => dayjs().add(daysFromNow, 'day').toISOString();

function sub(
    overrides: Partial<Subscription> & { id: string; name: string; price: number },
): Subscription {
    return { billing: 'Monthly', status: 'active', currency: 'USD', ...overrides } as Subscription;
}

section('Spend normalisation');
const monthly = sub({ id: '1', name: 'Netflix', price: 15 });
const yearly = sub({ id: '2', name: 'Adobe', price: 120, billing: 'Yearly' });
check('monthly + yearly/12', getMonthlySpend([monthly, yearly]), 25);
check('yearly spend is x12', getYearlySpend([monthly, yearly]), 300);
check(
    'paused excluded',
    getMonthlySpend([monthly, sub({ id: '3', name: 'Gym', price: 50, status: 'paused' })]),
    15,
);
check(
    'cancelled excluded',
    getMonthlySpend([monthly, sub({ id: '4', name: 'Old', price: 99, status: 'cancelled' })]),
    15,
);
check('most expensive by monthly equivalent', getMostExpensive([monthly, yearly])?.name, 'Netflix');
check('empty list is zero', getMonthlySpend([]), 0);

section('Household splitting');
const split4 = sub({ id: 'h1', name: 'Family', price: 20, householdSize: 4 });
check('personal price divides', personalPrice(split4), 5);
check('split reflected in spend', getMonthlySpend([split4]), 5);
check(
    'householdSize 0 treated as 1',
    householdSizeOf(sub({ id: 'h2', name: 'X', price: 10, householdSize: 0 })),
    1,
);
check(
    'negative householdSize treated as 1',
    householdSizeOf(sub({ id: 'h3', name: 'X', price: 10, householdSize: -3 })),
    1,
);
check(
    'fractional householdSize floors',
    householdSizeOf(sub({ id: 'h4', name: 'X', price: 10, householdSize: 2.9 })),
    2,
);
check('missing householdSize is 1', householdSizeOf(monthly), 1);
check(
    'no division by zero',
    Number.isFinite(personalPrice(sub({ id: 'h5', name: 'X', price: 10, householdSize: 0 }))),
    true,
);
check('sharing savings', getSharingSavings([split4]), 15);
check('unshared saves nothing', getSharingSavings([monthly]), 0);
check(
    'yearly split normalises',
    getMonthlySpend([
        sub({ id: 'h6', name: 'Y', price: 120, billing: 'Yearly', householdSize: 2 }),
    ]),
    5,
);

section('Trials');
const runningTrial = sub({
    id: 't1',
    name: 'Spotify',
    price: 12,
    isTrial: true,
    trialEndsAt: iso(5),
    renewalDate: iso(5),
});
const trialToday = sub({
    id: 't2',
    name: 'Hulu',
    price: 8,
    isTrial: true,
    trialEndsAt: iso(0),
    renewalDate: iso(0),
});
const expiredTrial = sub({
    id: 't3',
    name: 'Max',
    price: 20,
    isTrial: true,
    trialEndsAt: iso(-3),
    renewalDate: iso(-3),
});
const farTrial = sub({
    id: 't4',
    name: 'Duolingo',
    price: 7,
    isTrial: true,
    trialEndsAt: iso(20),
    renewalDate: iso(20),
});

check('running trial is trialing', isTrialing(runningTrial), true);
check('trial ending today still counts', isTrialing(trialToday), true);
check('lapsed trial is not trialing', isTrialing(expiredTrial), false);
check(
    'isTrial without date is not trialing',
    isTrialing(sub({ id: 't5', name: 'Z', price: 5, isTrial: true })),
    false,
);
check(
    'invalid trial date is not trialing',
    isTrialing(sub({ id: 't6', name: 'Z', price: 5, isTrial: true, trialEndsAt: 'nope' })),
    false,
);
check('trials excluded from spend', getMonthlySpend([monthly, runningTrial]), 15);
check('lapsed trial counts as spend', getMonthlySpend([expiredTrial]), 20);
check(
    'trial commitment sums running trials',
    getTrialCommitment([monthly, runningTrial, farTrial]),
    19,
);
check(
    'active trials sorted soonest first',
    getActiveTrials([farTrial, runningTrial, trialToday]).map((t) => t.subscription.name),
    ['Hulu', 'Spotify', 'Duolingo'],
);
check('daysUntilCharge for today is 0', getActiveTrials([trialToday])[0].daysUntilCharge, 0);
check(
    'ending trials respects window',
    getEndingTrials([runningTrial, farTrial], 7).map((t) => t.subscription.name),
    ['Spotify'],
);
check(
    'cancelled trial is not surfaced',
    getEndingTrials([sub({ ...runningTrial, status: 'cancelled' })], 7).length,
    0,
);

section('Reclaimed savings');
const cancelledMonthly = sub({
    id: 'c1',
    name: 'Gone',
    price: 10,
    status: 'cancelled',
    statusChangedAt: iso(-40),
});
const cancelledYearly = sub({
    id: 'c2',
    name: 'Gone2',
    price: 120,
    billing: 'Yearly',
    status: 'cancelled',
    statusChangedAt: iso(-10),
});
const savings = getReclaimedSavings([monthly, cancelledMonthly, cancelledYearly]);
check('reclaimed monthly', savings.monthly, 20);
check('reclaimed yearly', savings.yearly, 240);
check('reclaimed count', savings.count, 2);
check(
    'since = earliest cancellation',
    dayjs(savings.since!).isSame(dayjs(cancelledMonthly.statusChangedAt), 'day'),
    true,
);
check('no cancellations = zeroed', getReclaimedSavings([monthly]), {
    monthly: 0,
    yearly: 0,
    count: 0,
    since: null,
});
check(
    'cancelled split counts only share',
    getReclaimedSavings([
        sub({
            id: 'c3',
            name: 'S',
            price: 40,
            status: 'cancelled',
            householdSize: 4,
            statusChangedAt: iso(-5),
        }),
    ]).monthly,
    10,
);
check(
    'cancelled without timestamp still counts',
    getReclaimedSavings([sub({ id: 'c4', name: 'S', price: 10, status: 'cancelled' })]).count,
    1,
);
check(
    'invalid statusChangedAt ignored for since',
    getReclaimedSavings([
        sub({ id: 'c5', name: 'S', price: 10, status: 'cancelled', statusChangedAt: 'bad' }),
    ]).since,
    null,
);

section('Annual upgrade advisor');
const annual = detectAnnualUpgradeCandidates([monthly, yearly]);
check(
    'only monthly plans suggested',
    annual.map((n) => n.subscription.name),
    ['Netflix'],
);
check('estimated saving is two months', Math.round(annual[0].estimatedSaving * 100) / 100, 30);
check(
    'cheap plans filtered out',
    detectAnnualUpgradeCandidates([sub({ id: 'a1', name: 'Tiny', price: 1 })]).length,
    0,
);
check('running trials excluded', detectAnnualUpgradeCandidates([runningTrial]).length, 0);
check(
    'paused excluded',
    detectAnnualUpgradeCandidates([sub({ id: 'a2', name: 'P', price: 20, status: 'paused' })])
        .length,
    0,
);
check(
    'sorted by biggest saving',
    detectAnnualUpgradeCandidates([
        sub({ id: 'a3', name: 'Small', price: 6 }),
        sub({ id: 'a4', name: 'Big', price: 60 }),
    ]).map((n) => n.subscription.name),
    ['Big', 'Small'],
);

section('Renewals');
const soon = sub({ id: 'r1', name: 'Soon', price: 5, renewalDate: iso(3) });
const later = sub({ id: 'r2', name: 'Later', price: 5, renewalDate: iso(20) });
const past = sub({ id: 'r3', name: 'Past', price: 5, renewalDate: iso(-2) });
const todayRenewal = sub({ id: 'r4', name: 'Today', price: 5, renewalDate: iso(0) });

check('next renewal picks soonest', getNextRenewal([later, soon, past])?.subscription.name, 'Soon');
check(
    'renewal due today is included',
    getNextRenewal([later, todayRenewal])?.subscription.name,
    'Today',
);
check(
    'invalid date ignored',
    getNextRenewal([sub({ id: 'r5', name: 'Bad', price: 5, renewalDate: 'not-a-date' })]),
    null,
);
check('no renewals = null', getNextRenewal([]), null);
check(
    'missing renewalDate ignored',
    getNextRenewal([sub({ id: 'r6', name: 'None', price: 5 })]),
    null,
);
check(
    'upcoming 7d window',
    getUpcomingRenewals([soon, later, past], 7).map((s) => s.name),
    ['Soon'],
);
check(
    'upcoming 30d window',
    getUpcomingRenewals([soon, later, past], 30).map((s) => s.name),
    ['Soon', 'Later'],
);
check('timeline daysUntil', getRenewalTimeline([soon], 30)[0].daysUntil, 3);
check('timeline excludes past', getRenewalTimeline([past], 30).length, 0);

section('Category breakdown');
const breakdown = getCategoryBreakdown([
    sub({ id: 'b1', name: 'A', price: 30, category: 'Entertainment' }),
    sub({ id: 'b2', name: 'B', price: 10, category: 'Entertainment' }),
    sub({ id: 'b3', name: 'C', price: 60, category: 'AI Tools' }),
]);
check(
    'sorted by spend desc',
    breakdown.map((b) => b.category),
    ['AI Tools', 'Entertainment'],
);
check('percentages sum to 100', Math.round(breakdown.reduce((s, b) => s + b.percentage, 0)), 100);
check(
    'counts per category',
    breakdown.map((b) => b.count),
    [1, 2],
);
check(
    'uncategorised falls back to Other',
    getCategoryBreakdown([sub({ id: 'b4', name: 'D', price: 5 })])[0].category,
    'Other',
);
check(
    'whitespace category falls back',
    getCategoryBreakdown([sub({ id: 'b5', name: 'E', price: 5, category: '   ' })])[0].category,
    'Other',
);
check('breakdown ignores running trials', getCategoryBreakdown([runningTrial]).length, 0);
check('empty input is empty', getCategoryBreakdown([]), []);

section('Nudges');
check(
    'stale pause detected',
    detectStalePaused([
        sub({ id: 'p1', name: 'Old', price: 5, status: 'paused', statusChangedAt: iso(-45) }),
    ]).length,
    1,
);
check(
    'recent pause ignored',
    detectStalePaused([
        sub({ id: 'p2', name: 'New', price: 5, status: 'paused', statusChangedAt: iso(-2) }),
    ]).length,
    0,
);
check(
    'price hike detected',
    detectPriceHikes([
        sub({
            id: 'h7',
            name: 'Hiked',
            price: 20,
            priceHistory: [
                { price: 10, changedAt: iso(-60) },
                { price: 20, changedAt: iso(-5) },
            ],
        }),
    ]).map((n) => n.subscription.name),
    ['Hiked'],
);
check(
    'price drop not flagged',
    detectPriceHikes([
        sub({
            id: 'h8',
            name: 'D',
            price: 5,
            priceHistory: [
                { price: 10, changedAt: iso(-60) },
                { price: 5, changedAt: iso(-5) },
            ],
        }),
    ]).length,
    0,
);
check(
    'single history entry ignored',
    detectPriceHikes([
        sub({ id: 'h9', name: 'S', price: 5, priceHistory: [{ price: 5, changedAt: iso(-5) }] }),
    ]).length,
    0,
);
check(
    'stale hike outside window ignored',
    detectPriceHikes([
        sub({
            id: 'h10',
            name: 'O',
            price: 20,
            priceHistory: [
                { price: 10, changedAt: iso(-400) },
                { price: 20, changedAt: iso(-200) },
            ],
        }),
    ]).length,
    0,
);

section('Filtering + sorting');
const active1 = sub({ id: 'f1', name: 'Zeta', price: 30, renewalDate: iso(10) });
const active2 = sub({ id: 'f2', name: 'Alpha', price: 5, renewalDate: iso(2) });
const pausedSub = sub({ id: 'f3', name: 'Paused', price: 9, status: 'paused' });
const cancelledSub = sub({ id: 'f4', name: 'Gone', price: 9, status: 'cancelled' });
const trialSub = sub({
    id: 'f5',
    name: 'Trialing',
    price: 12,
    isTrial: true,
    trialEndsAt: iso(4),
    renewalDate: iso(4),
});
const allSubs = [active1, active2, pausedSub, cancelledSub, trialSub];

check(
    'all excludes archive',
    filterAndSort(allSubs, { query: '', status: 'all', order: 'name' }).map((x) => x.name),
    ['Alpha', 'Paused', 'Trialing', 'Zeta'],
);
check(
    'active excludes trials',
    filterAndSort(allSubs, { query: '', status: 'active', order: 'name' }).map((x) => x.name),
    ['Alpha', 'Zeta'],
);
check(
    'trials filter',
    filterAndSort(allSubs, { query: '', status: 'trials', order: 'name' }).map((x) => x.name),
    ['Trialing'],
);
check(
    'paused filter',
    filterAndSort(allSubs, { query: '', status: 'paused', order: 'name' }).map((x) => x.name),
    ['Paused'],
);
check(
    'archive filter',
    filterAndSort(allSubs, { query: '', status: 'cancelled', order: 'name' }).map((x) => x.name),
    ['Gone'],
);
check(
    'sort by renewal soonest first',
    filterAndSort([active1, active2], { query: '', status: 'all', order: 'renewal' }).map(
        (x) => x.name,
    ),
    ['Alpha', 'Zeta'],
);
check(
    'undated sinks to bottom',
    filterAndSort([sub({ id: 'f6', name: 'NoDate', price: 1 }), active2], {
        query: '',
        status: 'all',
        order: 'renewal',
    }).map((x) => x.name),
    ['Alpha', 'NoDate'],
);
check(
    'sort priciest first',
    filterAndSort([active2, active1], { query: '', status: 'all', order: 'priceHigh' }).map(
        (x) => x.name,
    ),
    ['Zeta', 'Alpha'],
);
check(
    'sort cheapest first',
    filterAndSort([active1, active2], { query: '', status: 'all', order: 'priceLow' }).map(
        (x) => x.name,
    ),
    ['Alpha', 'Zeta'],
);
check(
    'sort A-Z is case insensitive',
    filterAndSort(
        [sub({ id: 'f7', name: 'beta', price: 1 }), sub({ id: 'f8', name: 'Alpha', price: 1 })],
        { query: '', status: 'all', order: 'name' },
    ).map((x) => x.name),
    ['Alpha', 'beta'],
);
check('search matches name', matchesSearch(active1, 'zet'), true);
check('search is case insensitive', matchesSearch(active1, 'ZETA'), true);
check(
    'search matches payment method',
    matchesSearch(sub({ id: 'f9', name: 'X', price: 1, paymentMethod: 'Amex 1004' }), 'amex'),
    true,
);
check(
    'search matches category',
    matchesSearch(sub({ id: 'f10', name: 'X', price: 1, category: 'Design' }), 'desi'),
    true,
);
check('blank query matches all', matchesSearch(active1, '   '), true);
check('no match returns false', matchesSearch(active1, 'nonexistent'), false);
check(
    'filter and search compose',
    filterAndSort(allSubs, { query: 'alpha', status: 'all', order: 'name' }).map((x) => x.name),
    ['Alpha'],
);
check(
    'sort does not mutate input',
    (() => {
        const input = [active1, active2];
        filterAndSort(input, { query: '', status: 'all', order: 'name' });
        return input[0].name;
    })(),
    'Zeta',
);
const filterCounts = countsByFilter(allSubs);
check('counts all', filterCounts.all, 4);
check('counts trials', filterCounts.trials, 1);
check('counts archive', filterCounts.cancelled, 1);
check(
    'payment methods dedupe case-insensitively',
    knownPaymentMethods([
        sub({ id: 'pm1', name: 'A', price: 1, paymentMethod: 'Amex' }),
        sub({ id: 'pm2', name: 'B', price: 1, paymentMethod: 'amex' }),
        sub({ id: 'pm3', name: 'C', price: 1, paymentMethod: 'Visa' }),
    ]).length,
    2,
);
check(
    'blank payment methods ignored',
    knownPaymentMethods([sub({ id: 'pm4', name: 'A', price: 1, paymentMethod: '  ' })]),
    [],
);

section('Spend history');
const historyStart = dayjs().subtract(5, 'month').toISOString();
const longRunning = sub({ id: 'sh1', name: 'Old', price: 10, startDate: historyStart });
const history = getSpendHistory([longRunning], 6);
check('six points returned', history.length, 6);
check('last point is current month', history[5].label, dayjs().format('MMM'));
check(
    'steady subscription is flat',
    history.every((p) => Math.abs(p.amount - 10) < 0.001),
    true,
);
check('trend of flat series is zero', Math.round(getSpendTrend(history) ?? -1), 0);
const newHistory = getSpendHistory(
    [
        sub({
            id: 'sh2',
            name: 'New',
            price: 20,
            startDate: dayjs().subtract(1, 'month').toISOString(),
        }),
    ],
    6,
);
check('pre-start months are zero', newHistory[0].amount, 0);
check('recent months counted', newHistory[5].amount, 20);
check(
    'empty list is all zeros',
    getSpendHistory([], 3).every((p) => p.amount === 0),
    true,
);
check('single point has no trend', getSpendTrend(getSpendHistory([longRunning], 1)), null);
check(
    'zero baseline has no trend',
    getSpendTrend([
        { label: 'Jan', monthStart: '', amount: 0 },
        { label: 'Feb', monthStart: '', amount: 5 },
    ]),
    null,
);
check(
    'rising trend is positive',
    (getSpendTrend([
        { label: 'Jan', monthStart: '', amount: 10 },
        { label: 'Feb', monthStart: '', amount: 15 },
    ]) ?? 0) > 0,
    true,
);
check(
    'split counted at share in history',
    getSpendHistory(
        [sub({ id: 'sh3', name: 'S', price: 40, householdSize: 4, startDate: historyStart })],
        2,
    )[1].amount,
    10,
);
check(
    'yearly normalised in history',
    getSpendHistory(
        [sub({ id: 'sh6', name: 'Y', price: 120, billing: 'Yearly', startDate: historyStart })],
        2,
    )[1].amount,
    10,
);
check(
    'priceAt uses historic price',
    priceAt(
        sub({
            id: 'sh4',
            name: 'H',
            price: 20,
            priceHistory: [
                { price: 10, changedAt: iso(-400) },
                { price: 20, changedAt: iso(-5) },
            ],
        }),
        dayjs().subtract(100, 'day'),
    ),
    10,
);
check(
    'priceAt falls back to current price',
    priceAt(sub({ id: 'sh5', name: 'H', price: 20 }), dayjs()),
    20,
);

section('Spend rates');
const rates = getSpendRates([sub({ id: 'sr1', name: 'A', price: 30 })]);
check('monthly is the base', rates.monthly, 30);
check('yearly is twelve months', rates.yearly, 360);
check(
    'daily derives from the year',
    Math.round(rates.daily * 100) / 100,
    Math.round((360 / 365) * 100) / 100,
);
check(
    'weekly derives from the year',
    Math.round(rates.weekly * 100) / 100,
    Math.round((360 / 52) * 100) / 100,
);
check('empty list is all zeros', getSpendRates([]), { daily: 0, weekly: 0, monthly: 0, yearly: 0 });
check('rates exclude running trials', getSpendRates([runningTrial]).monthly, 0);

section('Renewal calendar');
const calMonth = dayjs();
const calendar = getRenewalCalendar(
    [sub({ id: 'cal1', name: 'C', price: 9, renewalDate: calMonth.date(15).toISOString() })],
    calMonth,
);
check('grid is whole weeks', calendar.length % 7, 0);
check('grid covers the month', calendar.length >= 28, true);
check('at most one day is today', calendar.filter((d) => d.isToday).length <= 1, true);
check('renewal lands on its day', calendar.find((d) => d.renewals.length > 0)?.dayOfMonth, 15);
check('day total uses personal share', calendar.find((d) => d.renewals.length > 0)?.total, 9);
check('only one day has renewals', calendar.filter((d) => d.renewals.length > 0).length, 1);
check(
    'split counted at share on calendar',
    getRenewalCalendar(
        [
            sub({
                id: 'cal2',
                name: 'S',
                price: 40,
                householdSize: 4,
                renewalDate: calMonth.date(10).toISOString(),
            }),
        ],
        calMonth,
    ).find((d) => d.renewals.length > 0)?.total,
    10,
);
check(
    'cancelled not on calendar',
    getRenewalCalendar(
        [
            sub({
                id: 'cal3',
                name: 'X',
                price: 9,
                status: 'cancelled',
                renewalDate: calMonth.date(12).toISOString(),
            }),
        ],
        calMonth,
    ).every((d) => d.renewals.length === 0),
    true,
);
check(
    'invalid renewal date skipped',
    getRenewalCalendar(
        [sub({ id: 'cal4', name: 'X', price: 9, renewalDate: 'nope' })],
        calMonth,
    ).every((d) => d.renewals.length === 0),
    true,
);
check(
    'isInMonth flags padding days',
    calendar.filter((d) => isInMonth(d, calMonth)).length >= 28,
    true,
);

section('Discovery audit');
check('nothing tracked means nothing covered', getDiscoveryCoverage([]).percentage, 0);
check('all groups missing when empty', getDiscoveryCoverage([]).missingGroups.length > 0, true);
check(
    'music recognised as covered',
    getDiscoveryCoverage([sub({ id: 'd1', name: 'Spotify', price: 10 })]).coveredGroups.includes(
        'music',
    ),
    true,
);
check(
    'streaming recognised as covered',
    getDiscoveryCoverage([
        sub({ id: 'd7', name: 'YouTube Premium', price: 14 }),
    ]).coveredGroups.includes('streaming'),
    true,
);
check(
    'music no longer prompted',
    getDiscoveryCoverage([sub({ id: 'd1', name: 'Spotify', price: 10 })]).missingGroups.some(
        (g) => g.id === 'music',
    ),
    false,
);
check(
    'coverage percentage rises',
    getDiscoveryCoverage([sub({ id: 'd1', name: 'Spotify', price: 10 })]).percentage > 0,
    true,
);
check(
    'matching is case insensitive',
    getDiscoveryCoverage([
        sub({ id: 'd2', name: 'SPOTIFY premium', price: 10 }),
    ]).coveredGroups.includes('music'),
    true,
);
check(
    'category text also counts',
    getDiscoveryCoverage([
        sub({ id: 'd3', name: 'Anon', price: 5, category: 'vpn' }),
    ]).coveredGroups.includes('security'),
    true,
);
check(
    'cancelled still counts as known',
    getDiscoveryCoverage([
        sub({ id: 'd4', name: 'Spotify', price: 10, status: 'cancelled' }),
    ]).coveredGroups.includes('music'),
    true,
);
check('prompts respect the limit', getDiscoveryPrompts([], 3).length, 3);
check(
    'prompts skip covered groups',
    getDiscoveryPrompts([sub({ id: 'd5', name: 'Spotify', price: 10 })], 9).some(
        (p) => p.group.id === 'music',
    ),
    false,
);
check(
    'already-tracked names not re-suggested',
    getDiscoveryPrompts([sub({ id: 'd6', name: 'Dropbox', price: 12 })], 9)
        .find((p) => p.group.id === 'cloud')
        ?.quickAdds.some((e) => e.name === 'Dropbox') ?? false,
    false,
);

section('Cancellation links');
check('known service resolves', getCancellationUrl('Netflix')?.startsWith('https://'), true);
check('match is case insensitive', getCancellationUrl('netflix') !== null, true);
check('partial name matches', getCancellationUrl('Netflix Premium 4K') !== null, true);
check('unknown service returns null', getCancellationUrl('My Local Gym'), null);
check('empty name returns null', getCancellationUrl('   '), null);

section('CSV import');
check('splits simple line', parseCsvLine('a,b,c'), ['a', 'b', 'c']);
check('honours quoted commas', parseCsvLine('"Netflix, Standard",15.49'), [
    'Netflix, Standard',
    '15.49',
]);
check('unescapes doubled quotes', parseCsvLine('"say ""hi""",1'), ['say "hi"', '1']);
check('trims whitespace', parseCsvLine(' a , b '), ['a', 'b']);
check('empty cells preserved', parseCsvLine('a,,c'), ['a', '', 'c']);
const basic = parseSubscriptionsCsv('Name,Price\nNetflix,15.49\nSpotify,11.99');
check('parses rows', basic.rows.length, 2);
check('no errors on clean input', basic.errors.length, 0);
check('reads price', basic.rows[0].values.price, 15.49);
check('defaults to monthly', basic.rows[0].values.frequency, 'Monthly');
check('defaults category to Other', basic.rows[0].values.category, 'Other');
const rich = parseSubscriptionsCsv(
    'Service,Cost,Cycle,Type,CCY,Card\nAdobe,"59.99",Yearly,Design,GBP,Amex',
);
check('accepts alias headers', rich.rows.length, 1);
check('maps yearly', rich.rows[0].values.frequency, 'Yearly');
check('maps category', rich.rows[0].values.category, 'Design');
check('maps currency', rich.rows[0].values.currency, 'GBP');
check('maps payment method', rich.rows[0].values.paymentMethod, 'Amex');
check(
    'strips currency symbols',
    parseSubscriptionsCsv('Name,Price\nX,"$1,299.00"').rows[0].values.price,
    1299,
);
check('rejects missing name', parseSubscriptionsCsv('Name,Price\n,9.99').errors.length, 1);
check('rejects unusable price', parseSubscriptionsCsv('Name,Price\nX,free').errors.length, 1);
check('rejects negative price', parseSubscriptionsCsv('Name,Price\nX,-5').errors.length, 1);
check(
    'reports the right line number',
    parseSubscriptionsCsv('Name,Price\nGood,1\nBad,zero').errors[0].line,
    3,
);
check(
    'good rows survive bad ones',
    parseSubscriptionsCsv('Name,Price\nGood,1\nBad,zero').rows.length,
    1,
);
check(
    'missing required columns rejected',
    parseSubscriptionsCsv('Foo,Bar\n1,2').errors[0].reason.includes('Name'),
    true,
);
check('empty input rejected', parseSubscriptionsCsv('').errors.length, 1);
check(
    'unknown category warns not fails',
    parseSubscriptionsCsv('Name,Price,Category\nX,5,Wombat').rows[0].warnings.length,
    1,
);
check(
    'unsupported currency dropped',
    parseSubscriptionsCsv('Name,Price,Currency\nX,5,ZZZ').rows[0].values.currency,
    undefined,
);
check(
    'long names truncated',
    parseSubscriptionsCsv('Name,Price\n' + 'a'.repeat(200) + ',5').rows[0].values.name.length,
    60,
);
check('CRLF handled', parseSubscriptionsCsv('Name,Price\r\nX,5\r\n').rows.length, 1);
check('duplicates detected', Array.from(findImportDuplicates(basic.rows, ['netflix'])), [
    'Netflix',
]);
check('no false duplicates', findImportDuplicates(basic.rows, ['Hulu']).size, 0);

section('Income context');
check('no income means no context', getIncomeContext([monthly], undefined), null);
check('zero income means no context', getIncomeContext([monthly], 0), null);
check('negative income means no context', getIncomeContext([monthly], -100), null);
check(
    'percentage computed',
    getIncomeContext([sub({ id: 'i1', name: 'A', price: 100 })], 2000)?.percentage,
    5,
);
check('low band', getIncomeContext([sub({ id: 'i2', name: 'A', price: 20 })], 2000)?.band, 'low');
check(
    'typical band',
    getIncomeContext([sub({ id: 'i3', name: 'A', price: 100 })], 2000)?.band,
    'typical',
);
check(
    'high band',
    getIncomeContext([sub({ id: 'i4', name: 'A', price: 400 })], 2000)?.band,
    'high',
);
check('trials excluded from ratio', getIncomeContext([runningTrial], 2000)?.percentage, 0);

section('What-if simulator');
const whatIfSet = [
    sub({ id: 'w1', name: 'A', price: 10 }),
    sub({ id: 'w2', name: 'B', price: 20 }),
];
check('nothing removed saves nothing', simulateCancellations(whatIfSet, []).yearlySaving, 0);
check('removing one saves its year', simulateCancellations(whatIfSet, ['w2']).yearlySaving, 240);
check('new monthly reflects removal', simulateCancellations(whatIfSet, ['w2']).newMonthly, 10);
check('removed count', simulateCancellations(whatIfSet, ['w1', 'w2']).removedCount, 2);
check(
    'removing everything zeroes spend',
    simulateCancellations(whatIfSet, ['w1', 'w2']).newMonthly,
    0,
);
check('unknown id is a no-op', simulateCancellations(whatIfSet, ['nope']).monthlySaving, 0);
check(
    'removing a trial saves nothing yet',
    simulateCancellations([runningTrial], [runningTrial.id]).monthlySaving,
    0,
);
check(
    'split counted at share',
    simulateCancellations([sub({ id: 'w3', name: 'S', price: 40, householdSize: 4 })], ['w3'])
        .yearlySaving,
    120,
);

section('Duplicate detection');
check('exact match found', findDuplicateName([monthly], 'Netflix')?.id, '1');
check('case insensitive', findDuplicateName([monthly], 'netflix')?.id, '1');
check('whitespace tolerant', findDuplicateName([monthly], '  Netflix  ')?.id, '1');
check('no match returns null', findDuplicateName([monthly], 'Hulu'), null);
check('blank returns null', findDuplicateName([monthly], '   '), null);

section('Animation maths');
check('ease starts at zero', easeOutCubic(0), 0);
check('ease ends at one', easeOutCubic(1), 1);
check('ease clamps below zero', easeOutCubic(-1), 0);
check('ease clamps above one', easeOutCubic(5), 1);
check('ease is front-loaded', easeOutCubic(0.5) > 0.5, true);
check('interpolate start', interpolateValue(0, 100, 0), 0);
check('interpolate end', interpolateValue(0, 100, 1), 100);
check(
    'interpolate returns target for NaN input',
    Number.isNaN(interpolateValue(0, NaN, 0.5)),
    true,
);
check('tiny change is not animated', shouldAnimateChange(10, 10.001), false);
check('real change is animated', shouldAnimateChange(0, 50), true);
check('NaN is never animated', shouldAnimateChange(NaN, 10), false);

section('Currency formatting');
check('formats USD', formatCurrency(15.5, 'USD'), '$15.50');
check('defaults to USD', formatCurrency(15.5), '$15.50');
check('NaN renders a dash', formatCurrency(NaN), '—');
check('Infinity renders a dash', formatCurrency(Infinity), '—');
check('zero formats', formatCurrency(0), '$0.00');
check('negative formats', formatCurrency(-5, 'USD'), '-$5.00');
check('bad code falls back to USD', formatCurrency(10, 'NOTACODE'), '$10.00');
check('empty code falls back', formatCurrency(10, ''), '$10.00');
check('lowercase code normalised', formatCurrency(10, 'eur').includes('10.00'), true);
check('INR supported', formatCurrency(100, 'INR').includes('100.00'), true);

section('Date + status formatting');
check('missing date', formatSubscriptionDateTime(undefined), 'Not provided');
check('empty date', formatSubscriptionDateTime(''), 'Not provided');
check('garbage date', formatSubscriptionDateTime('banana'), 'Not provided');
check('valid date', formatSubscriptionDateTime('2026-01-15T00:00:00.000Z').length, 10);
check('status capitalised', formatStatusLabel('active'), 'Active');
check('missing status', formatStatusLabel(undefined), 'Unknown');

section('Initials + avatar');
check('two words', getInitials('YouTube Premium'), 'YP');
check('one word takes two chars', getInitials('Netflix'), 'NE');
check('empty is question mark', getInitials(''), '?');
check('whitespace only', getInitials('    '), '?');
check('emoji not split into surrogate halves', Array.from(getInitials('🎬')).length, 1);
check('non-latin handled', getInitials('日本 語').length > 0, true);
check('extra spaces collapse', getInitials('  Apple   TV  '), 'AT');
check('avatar colour is deterministic', getAvatarColor('Netflix'), getAvatarColor('Netflix'));
check('avatar colour is a hex value', /^#[0-9a-f]{6}$/i.test(getAvatarColor('Netflix')), true);
check('icon resolves by keyword', resolveIconKey('Spotify Premium'), 'spotify');
check('unknown name resolves to null', resolveIconKey('Some Random Thing'), null);
check('explicit key wins', resolveIconKey('Anything', 'figma'), 'figma');
check('bogus explicit key falls through', resolveIconKey('Some Random Thing', 'nope'), null);

section('Password strength');
check('empty scores zero', describePasswordStrength('').score, 0);
check('short password rejected', describePasswordStrength('abc').label.includes('Too short'), true);
check('eight chars is at least weak', describePasswordStrength('abcdefgh').score >= 1, true);
check(
    'complex long password is strong',
    describePasswordStrength('Str0ng!Passw0rd').label,
    'Strong',
);
check(
    'score never exceeds four',
    describePasswordStrength('Str0ng!Passw0rdVeryLong').score <= 4,
    true,
);

section('CSV export');
check('formula injection neutralised', escapeCsv('=HYPERLINK("evil")'), `"'=HYPERLINK(""evil"")"`);
check('plus prefix escaped', escapeCsv('+1'), `"'+1"`);
check('at prefix escaped', escapeCsv('@SUM(A1)'), `"'@SUM(A1)"`);
check('quotes doubled', escapeCsv('say "hi"'), '"say ""hi"""');
check('empty for null', escapeCsv(null), '""');
check('leading minus escaped', escapeCsv('-5+3'), `"'-5+3"`);
const csv = buildSubscriptionsCsv([
    sub({
        id: 'x',
        name: 'Netflix',
        price: 15.5,
        category: 'Entertainment',
        startDate: '2026-01-15T10:00:00.000Z',
    }),
]);
const lines = csv.split('\r\n');
check('header row present', lines[0].startsWith('"Name","Category","Price"'), true);
check('row count', lines.length, 2);
check('price formatted to 2dp', lines[1].includes('"15.50"'), true);
check('trial column defaults to No', lines[1].includes('"No"'), true);
check('date rendered YYYY-MM-DD', lines[1].includes('"2026-01-15"'), true);
check('empty list still has header', buildSubscriptionsCsv([]).split('\r\n').length, 1);
check(
    'invalid date renders empty',
    buildSubscriptionsCsv([sub({ id: 'y', name: 'N', price: 1, startDate: 'bad' })]).includes(
        '"bad"',
    ),
    false,
);

section('Cost per use');
const usedMonthly = sub({ id: 'u1', name: 'Gym', price: 30, usageCount: 10 });
check('no uses returns null', getCostPerUse(sub({ id: 'u2', name: 'X', price: 30 })), null);
check(
    'zero uses returns null',
    getCostPerUse(sub({ id: 'u3', name: 'X', price: 30, usageCount: 0 })),
    null,
);
check('perUse divides spend by uses', getCostPerUse(usedMonthly)?.perUse, 3);
check('uses reported', getCostPerUse(usedMonthly)?.uses, 10);
check('months floored at one', getCostPerUse(usedMonthly)?.monthsTracked, 1);
check('good value not flagged', getCostPerUse(usedMonthly)?.isPoorValue, false);
// One use per month is exactly break-even, so the flag must not fire there...
check(
    'one use a month is break-even, not poor value',
    getCostPerUse(sub({ id: 'u4', name: 'Even', price: 30, usageCount: 1 }))?.isPoorValue,
    false,
);
// ...but one use across three months means each cost three months of the plan.
check(
    'under one use a month is poor value',
    getCostPerUse(
        sub({
            id: 'u9',
            name: 'Rare',
            price: 30,
            usageCount: 1,
            usageSince: dayjs().subtract(2, 'month').toISOString(),
        }),
    )?.isPoorValue,
    true,
);
check(
    'multi-month window scales spend',
    getCostPerUse(
        sub({
            id: 'u5',
            name: 'M',
            price: 10,
            usageCount: 5,
            usageSince: dayjs().subtract(2, 'month').toISOString(),
        }),
    )?.perUse,
    6,
);
check(
    'split counted at share',
    getCostPerUse(sub({ id: 'u6', name: 'S', price: 40, householdSize: 4, usageCount: 2 }))?.perUse,
    5,
);
check(
    'yearly normalised per month',
    getCostPerUse(sub({ id: 'u7', name: 'Y', price: 120, billing: 'Yearly', usageCount: 2 }))
        ?.perUse,
    5,
);
check(
    'invalid usageSince falls back to one month',
    getCostPerUse(sub({ id: 'u8', name: 'B', price: 30, usageCount: 3, usageSince: 'nope' }))
        ?.monthsTracked,
    1,
);

section('Usage ranking + unused');
check(
    'worst value first',
    getUsageRanking([
        sub({ id: 'k1', name: 'Cheap', price: 10, usageCount: 10 }),
        sub({ id: 'k2', name: 'Expensive', price: 100, usageCount: 1 }),
    ]).map((r) => r.subscription.name),
    ['Expensive', 'Cheap'],
);
check(
    'untracked excluded from ranking',
    getUsageRanking([sub({ id: 'k3', name: 'None', price: 10 })]).length,
    0,
);
check(
    'cancelled excluded from ranking',
    getUsageRanking([
        sub({ id: 'k4', name: 'Gone', price: 10, usageCount: 5, status: 'cancelled' }),
    ]).length,
    0,
);
check(
    'old and never used is flagged',
    getUnusedSubscriptions([sub({ id: 'n1', name: 'Idle', price: 10, startDate: iso(-60) })]).map(
        (x) => x.name,
    ),
    ['Idle'],
);
check(
    'recently added not flagged',
    getUnusedSubscriptions([sub({ id: 'n2', name: 'New', price: 10, startDate: iso(-5) })]).length,
    0,
);
check(
    'used ones not flagged',
    getUnusedSubscriptions([
        sub({ id: 'n3', name: 'Used', price: 10, startDate: iso(-60), usageCount: 1 }),
    ]).length,
    0,
);
check(
    'trials not flagged',
    getUnusedSubscriptions([
        sub({
            id: 'n4',
            name: 'T',
            price: 10,
            startDate: iso(-60),
            isTrial: true,
            trialEndsAt: iso(5),
        }),
    ]).length,
    0,
);
check(
    'paused not flagged',
    getUnusedSubscriptions([
        sub({ id: 'n5', name: 'P', price: 10, startDate: iso(-60), status: 'paused' }),
    ]).length,
    0,
);
check(
    'missing startDate not flagged',
    getUnusedSubscriptions([sub({ id: 'n6', name: 'NoDate', price: 10 })]).length,
    0,
);

section('Discovery: streaming group');
check(
    'streaming recognised as covered',
    getDiscoveryCoverage([sub({ id: 'ds1', name: 'Netflix', price: 10 })]).coveredGroups.includes(
        'streaming',
    ),
    true,
);
check(
    'YouTube Premium counts as streaming',
    getDiscoveryCoverage([
        sub({ id: 'ds2', name: 'YouTube Premium', price: 14 }),
    ]).coveredGroups.includes('streaming'),
    true,
);

for (const group of groups) {
    describe(group.name, () => {
        for (const logicCase of group.cases) {
            it(logicCase.name, logicCase.run);
        }
    });
}

describe('suite integrity', () => {
    it('still registers every assertion carried over from the node runner', () => {
        const total = groups.reduce((sum, group) => sum + group.cases.length, 0);
        expect(total).toBeGreaterThanOrEqual(265);
    });
});
