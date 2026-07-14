import BudgetCard from '@/components/insights/BudgetCard';
import CategoryBreakdownChart from '@/components/insights/CategoryBreakdownChart';
import ForecastChart from '@/components/insights/ForecastChart';
import ProGate from '@/components/insights/ProGate';
import SmartSuggestionsCard from '@/components/insights/SmartSuggestionsCard';
import SpendSummaryCard from '@/components/insights/SpendSummaryCard';
import WrappedCard from '@/components/insights/WrappedCard';
import {
    detectDuplicateCategories,
    detectPriceHikes,
    detectStalePaused,
    getCategoryBreakdown,
    getForecast,
    getMonthlySpend,
    getMostExpensive,
    getStatusCounts,
    getYearlySpend,
} from '@/lib/insights';
import { useProStatus } from '@/lib/useProStatus';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useUserSettings } from '@/lib/useUserSettings';
import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Insights = () => {
    const posthog = usePostHog();
    const { subscriptions, isLoading } = useSubscriptions();
    const { monthlyBudget, updateSettings } = useUserSettings();
    const { isPro } = useProStatus();

    useEffect(() => {
        if (isLoading) return;
        posthog.capture('insights_screen_viewed', {
            total_subscriptions: subscriptions.length,
        });
    }, [isLoading]);

    const monthlySpend = useMemo(() => getMonthlySpend(subscriptions), [subscriptions]);
    const yearlySpend = useMemo(() => getYearlySpend(subscriptions), [subscriptions]);
    const breakdown = useMemo(() => getCategoryBreakdown(subscriptions), [subscriptions]);
    const forecast = useMemo(() => getForecast(subscriptions), [subscriptions]);
    const statusCounts = useMemo(() => getStatusCounts(subscriptions), [subscriptions]);
    const mostExpensive = useMemo(() => getMostExpensive(subscriptions), [subscriptions]);
    const duplicateCategories = useMemo(() => detectDuplicateCategories(subscriptions), [subscriptions]);
    const stalePaused = useMemo(() => detectStalePaused(subscriptions), [subscriptions]);
    const priceHikes = useMemo(() => detectPriceHikes(subscriptions), [subscriptions]);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator color="#ea7a53" />
            </SafeAreaView>
        );
    }

    if (statusCounts.active === 0) {
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
            <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
                <Text className="text-3xl font-sans-bold text-primary">Insights</Text>

                <SpendSummaryCard monthlyTotal={monthlySpend} yearlyTotal={yearlySpend} activeCount={statusCounts.active} />

                <CategoryBreakdownChart breakdown={breakdown} />

                <BudgetCard
                    monthlyBudget={monthlyBudget}
                    monthlySpend={monthlySpend}
                    onSave={(budget) => updateSettings({ monthlyBudget: budget })}
                />

                <ProGate isPro={isPro} title="6-Month Forecast" description="See where your spending is headed if nothing changes.">
                    <ForecastChart forecast={forecast} />
                </ProGate>

                <ProGate isPro={isPro} title="Smart Suggestions" description="Duplicate categories, stale pauses, and price hikes — spotted automatically.">
                    <SmartSuggestionsCard duplicateCategories={duplicateCategories} stalePaused={stalePaused} priceHikes={priceHikes} />
                </ProGate>

                <ProGate isPro={isPro} title="Wrapped" description="A shareable recap of your year in subscriptions.">
                    <WrappedCard
                        yearlyTotal={yearlySpend}
                        activeCount={statusCounts.active}
                        topCategory={breakdown[0] ?? null}
                        mostExpensive={mostExpensive}
                    />
                </ProGate>
            </ScrollView>
        </SafeAreaView>
    )
}
export default Insights
