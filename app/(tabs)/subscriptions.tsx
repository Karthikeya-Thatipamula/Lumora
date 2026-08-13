import PressableScale from '@/components/motion/PressableScale';
import { SubscriptionListSkeleton } from '@/components/motion/Skeleton';
import { SafeAreaView } from '@/components/SafeAreaView';
import SubscriptionCard from '@/components/SubscriptionCard';
import { getTabBarContentInset } from '@/constants/theme';
import { alertDialog, confirmDeleteSubscription, RETRY_WHEN_LOADED } from '@/lib/dialogs';
import {
    countsByFilter,
    filterAndSort,
    SORT_ORDERS,
    SortOrder,
    STATUS_FILTERS,
    StatusFilter,
} from '@/lib/subscriptionFilters';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useThemeColors } from '@/lib/useThemeColors';
import { clsx } from 'clsx';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Subscriptions = () => {
    const posthog = usePostHog();
    const router = useRouter();
    const themeColors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('renewal');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { subscriptions, isLoading, deleteSubscription } = useSubscriptions();

    const counts = useMemo(() => countsByFilter(subscriptions), [subscriptions]);
    const visibleSubscriptions = useMemo(
        () =>
            filterAndSort(subscriptions, {
                query: searchQuery,
                status: statusFilter,
                order: sortOrder,
            }),
        [subscriptions, searchQuery, statusFilter, sortOrder],
    );

    useEffect(() => {
        if (isLoading) return;
        posthog.capture('subscriptions_screen_viewed', {
            total_subscriptions: subscriptions.length,
        });
    }, [isLoading, posthog, subscriptions.length]);

    // Undebounced, this fired once per keystroke — typing "Netflix" sent seven events —
    // and each carried the raw query, which is user input and has no business in an
    // analytics property. The root layout allow-lists route params for the same reason.
    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        const timer = setTimeout(() => {
            posthog.capture('subscriptions_searched', {
                query_length: trimmed.length,
                result_count: visibleSubscriptions.length,
                found_something: visibleSubscriptions.length > 0,
            });
        }, 600);

        return () => clearTimeout(timer);
    }, [searchQuery, visibleSubscriptions.length, posthog]);

    const handleSubscriptionPress = (id: string) => {
        const isExpanding = expandedId !== id;
        setExpandedId(expandedId === id ? null : id);

        const subscription = subscriptions.find((s) => s.id === id);
        posthog.capture(isExpanding ? 'subscription_expanded' : 'subscription_collapsed', {
            subscription_id: id,
            subscription_name: subscription?.name ?? null,
            source: 'subscriptions_screen',
        });
    };

    const handleDelete = async (subscription: Subscription) => {
        const confirmed = await confirmDeleteSubscription(subscription.name);
        if (!confirmed) return;

        try {
            await deleteSubscription(subscription.id);
            posthog.capture('subscription_deleted', {
                subscription_id: subscription.id,
                source: 'subscriptions_screen',
            });
        } catch (error) {
            console.error('Delete subscription failed:', error);
            alertDialog('Delete failed', RETRY_WHEN_LOADED);
        }
    };

    const emptyMessage = searchQuery.trim()
        ? `Nothing matches “${searchQuery.trim()}”.`
        : statusFilter === 'cancelled'
          ? 'Nothing archived yet. Cancelled subscriptions land here.'
          : statusFilter === 'trials'
            ? 'No free trials running right now.'
            : statusFilter === 'paused'
              ? 'Nothing paused right now.'
              : 'No subscriptions yet. Add one from the Home tab.';

    return (
        <SafeAreaView className="flex-1 bg-background">
            <FlatList
                data={visibleSubscriptions}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View className="pb-4 pt-5">
                        <Text className="mb-5 px-5 text-3xl font-sans-bold text-primary">
                            Subscriptions
                        </Text>

                        <TextInput
                            className="mx-5 mb-4 rounded-xl bg-card px-4 py-3 text-primary"
                            placeholder="Search name, category or card..."
                            placeholderTextColor={themeColors.placeholder}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            accessibilityLabel="Search subscriptions"
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{
                                gap: 8,
                                paddingHorizontal: 20,
                                paddingBottom: 12,
                            }}
                        >
                            {STATUS_FILTERS.map((filter) => (
                                <PressableScale
                                    key={filter.key}
                                    className={clsx(
                                        'category-chip',
                                        statusFilter === filter.key && 'category-chip-active',
                                    )}
                                    onPress={() => setStatusFilter(filter.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: statusFilter === filter.key }}
                                    accessibilityLabel={`${filter.label}, ${counts[filter.key]} subscriptions`}
                                >
                                    <Text
                                        className={clsx(
                                            'category-chip-text',
                                            statusFilter === filter.key &&
                                                'category-chip-text-active',
                                        )}
                                    >
                                        {filter.label} {counts[filter.key]}
                                    </Text>
                                </PressableScale>
                            ))}
                        </ScrollView>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
                        >
                            <Text className="self-center text-xs font-sans-semibold text-muted-foreground">
                                Sort
                            </Text>
                            {SORT_ORDERS.map((option) => (
                                <PressableScale
                                    key={option.key}
                                    className={clsx(
                                        'category-chip',
                                        sortOrder === option.key && 'category-chip-active',
                                    )}
                                    onPress={() => {
                                        setSortOrder(option.key);
                                        posthog.capture('subscriptions_sorted', {
                                            order: option.key,
                                        });
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: sortOrder === option.key }}
                                    accessibilityLabel={`Sort by ${option.label}`}
                                >
                                    <Text
                                        className={clsx(
                                            'category-chip-text',
                                            sortOrder === option.key && 'category-chip-text-active',
                                        )}
                                    >
                                        {option.label}
                                    </Text>
                                </PressableScale>
                            ))}
                        </ScrollView>
                    </View>
                }
                renderItem={({ item, index }) => (
                    <Animated.View
                        layout={LinearTransition.duration(220)}
                        entering={FadeInDown.duration(240).delay(Math.min(index, 6) * 35)}
                    >
                        <SubscriptionCard
                            {...item}
                            expanded={expandedId === item.id}
                            onPress={() => handleSubscriptionPress(item.id)}
                            onManagePress={() => router.push(`/subscriptions/${item.id}`)}
                            onDeletePress={() => handleDelete(item)}
                        />
                    </Animated.View>
                )}
                extraData={expandedId}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: getTabBarContentInset(insets.bottom),
                    gap: 12,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                    isLoading ? (
                        <SubscriptionListSkeleton />
                    ) : (
                        <Text className="mt-10 text-center text-sm font-sans-medium text-muted-foreground">
                            {emptyMessage}
                        </Text>
                    )
                }
            />
        </SafeAreaView>
    );
};
export default Subscriptions;
