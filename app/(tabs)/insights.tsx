import { SafeAreaView } from '@/components/SafeAreaView';
import BudgetCard from '@/components/insights/BudgetCard';
import CategoryBreakdownChart from '@/components/insights/CategoryBreakdownChart';
import ForecastChart from '@/components/insights/ForecastChart';
import IncomeContextCard from '@/components/insights/IncomeContextCard';
import InviteCard from '@/components/insights/InviteCard';
import ProGate from '@/components/insights/ProGate';
import RenewalCalendar from '@/components/insights/RenewalCalendar';
import SavingsCard from '@/components/insights/SavingsCard';
import SmartSuggestionsCard from '@/components/insights/SmartSuggestionsCard';
import SpendRatesCard from '@/components/insights/SpendRatesCard';
import SpendSummaryCard from '@/components/insights/SpendSummaryCard';
import SpendTrendChart from '@/components/insights/SpendTrendChart';
import WhatIfCard from '@/components/insights/WhatIfCard';
import WrappedCard from '@/components/insights/WrappedCard';
import { InsightsSkeleton } from '@/components/motion/Skeleton';
import { getTabBarContentInset } from '@/constants/theme';
import { hasMixedCurrencies } from '@/lib/currency';
import {
    detectAnnualUpgradeCandidates,
    detectDuplicateCategories,
    detectPriceHikes,
    detectStalePaused,
    getActiveTrials,
    getCategoryBreakdown,
    getIncomeContext,
    getForecast,
    getMonthlySpend,
    getMostExpensive,
    getReclaimedSavings,
    getSharingSavings,
    getRenewalCalendar,
    getSpendHistory,
    getSpendRates,
    getUnusedSubscriptions,
    getUsageRanking,
    getSpendTrend,
    getStatusCounts,
    getTrialCommitment,
    getYearlySpend,
} from '@/lib/insights';
import { useProStatus } from '@/lib/useProStatus';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useUserSettings } from '@/lib/useUserSettings';
import dayjs from 'dayjs';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Insights = () => {
    const posthog = usePostHog();
    const { subscriptions, isLoading } = useSubscriptions();
    const { monthlyBudget, monthlyIncome, currency, updateSettings } = useUserSettings();
    const { isPro } = useProStatus();
    const insets = useSafeAreaInsets();
    const [monthOffset, setMonthOffset] = useState(0);

    useEffect(() => {
        if (isLoading) return;
        posthog.capture('insights_screen_viewed', {
            total_subscriptions: subscriptions.length,
        });
    }, [isLoading, posthog, subscriptions.length]);

    const monthlySpend = useMemo(() => getMonthlySpend(subscriptions), [subscriptions]);
    const yearlySpend = useMemo(() => getYearlySpend(subscriptions), [subscriptions]);
    const breakdown = useMemo(() => getCategoryBreakdown(subscriptions), [subscriptions]);
    const forecast = useMemo(() => getForecast(subscriptions), [subscriptions]);
    const statusCounts = useMemo(() => getStatusCounts(subscriptions), [subscriptions]);
    const mostExpensive = useMemo(() => getMostExpensive(subscriptions), [subscriptions]);
    const duplicateCategories = useMemo(() => detectDuplicateCategories(subscriptions), [subscriptions]);
    const stalePaused = useMemo(() => detectStalePaused(subscriptions), [subscriptions]);
    const priceHikes = useMemo(() => detectPriceHikes(subscriptions), [subscriptions]);
    const savings = useMemo(() => getReclaimedSavings(subscriptions), [subscriptions]);
    const trialCommitment = useMemo(() => getTrialCommitment(subscriptions), [subscriptions]);
    const annualUpgrades = useMemo(() => detectAnnualUpgradeCandidates(subscriptions), [subscriptions]);
    const sharingSavings = useMemo(() => getSharingSavings(subscriptions), [subscriptions]);
    const mixedCurrencies = useMemo(() => hasMixedCurrencies(subscriptions), [subscriptions]);
    const spendHistory = useMemo(() => getSpendHistory(subscriptions, 6), [subscriptions]);
    const spendRates = useMemo(() => getSpendRates(subscriptions), [subscriptions]);
    const trialCount = useMemo(() => getActiveTrials(subscriptions).length, [subscriptions]);
    const unused = useMemo(() => getUnusedSubscriptions(subscriptions), [subscriptions]);
    const poorValue = useMemo(
        () => getUsageRanking(subscriptions).filter((entry) => entry.costPerUse.isPoorValue),
        [subscriptions]
    );
    const incomeContext = useMemo(
        () => getIncomeContext(subscriptions, monthlyIncome),
        [subscriptions, monthlyIncome]
    );
    const calendarAnchor = useMemo(() => dayjs().add(monthOffset, 'month'), [monthOffset]);
    const calendarDays = useMemo(
        () => getRenewalCalendar(subscriptions, calendarAnchor),
        [subscriptions, calendarAnchor]
    );
    const spendTrend = useMemo(() => getSpendTrend(spendHistory), [spendHistory]);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background px-5 pt-5">
                <Text className="mb-5 text-3xl font-sans-bold text-primary">Insights</Text>
                <InsightsSkeleton />
            </SafeAreaView>
        );
    }

    // Someone whose subscriptions are all cancelled has still earned their savings
    // total — only fall back to the empty state when there's genuinely nothing to show.
    if (statusCounts.active === 0 && savings.count === 0) {
        return (
            <SafeAreaView className="flex-1 bg-background p-5">
                <Text className="text-3xl font-sans-bold text-primary mb-4">Insights</Text>
                <View className="auth-card items-center gap-2 py-10">
                    <Text style={{ fontSize: 32 }}>📊</Text>
                    <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                        Add an active subscription to unlock spending insights, forecasts, and smart suggestions.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: getTabBarContentInset(insets.bottom) }}>
                <Text className="text-3xl font-sans-bold text-primary">Insights</Text>

                <SpendSummaryCard monthlyTotal={monthlySpend} yearlyTotal={yearlySpend} activeCount={statusCounts.active} trialCount={trialCount} currency={currency} />

                {mixedCurrencies && (
                    <View className="rounded-2xl border border-border bg-card p-4">
                        <Text className="text-xs font-sans-medium text-muted-foreground">
                            You track subscriptions in more than one currency. Totals below add the raw
                            amounts together without converting, so treat them as a rough guide.
                        </Text>
                    </View>
                )}

                <SpendRatesCard rates={spendRates} currency={currency} />

                <RenewalCalendar
                    days={calendarDays}
                    monthAnchor={calendarAnchor}
                    onPrevMonth={() => setMonthOffset((offset) => offset - 1)}
                    onNextMonth={() => setMonthOffset((offset) => offset + 1)}
                    currency={currency}
                />

                <SavingsCard savings={savings} trialCommitment={trialCommitment} sharingSavings={sharingSavings} currency={currency} />

                <CategoryBreakdownChart breakdown={breakdown} currency={currency} />

                <IncomeContextCard
                    context={incomeContext}
                    monthlySpend={monthlySpend}
                    currency={currency}
                    onSave={(income) => updateSettings({ monthlyIncome: income })}
                />

                <WhatIfCard subscriptions={subscriptions} currency={currency} />

                <BudgetCard
                    monthlyBudget={monthlyBudget}
                    monthlySpend={monthlySpend}
                    currency={currency}
                    onSave={(budget) => updateSettings({ monthlyBudget: budget })}
                />

                <ProGate isPro={isPro} title="6-Month Forecast" description="See where your spending is headed if nothing changes.">
                    <ForecastChart forecast={forecast} currency={currency} />
                </ProGate>

                <ProGate isPro={isPro} title="Spend Over Time" description="Six months of your real spending, rebuilt from your own history.">
                    <SpendTrendChart history={spendHistory} trend={spendTrend} currency={currency} />
                </ProGate>

                <ProGate isPro={isPro} title="Smart Suggestions" description="Duplicate categories, stale pauses, and price hikes — spotted automatically.">
                    <SmartSuggestionsCard
                        duplicateCategories={duplicateCategories}
                        stalePaused={stalePaused}
                        priceHikes={priceHikes}
                        annualUpgrades={annualUpgrades}
                        unused={unused}
                        poorValue={poorValue}
                        currency={currency}
                    />
                </ProGate>

                <ProGate isPro={isPro} title="Wrapped" description="A shareable recap of your year in subscriptions.">
                    <WrappedCard
                        yearlyTotal={yearlySpend}
                        activeCount={statusCounts.active}
                        topCategory={breakdown[0] ?? null}
                        mostExpensive={mostExpensive}
                        reclaimedYearly={savings.yearly}
                        currency={currency}
                    />
                </ProGate>

                <InviteCard reclaimedYearly={savings.yearly} currency={currency} />
            </ScrollView>
        </SafeAreaView>
    )
}
export default Insights
