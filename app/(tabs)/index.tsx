import CreateSubscriptionModal, { SubscriptionFormValues } from "@/components/CreateSubscriptionModal";
import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import { icons } from "@/constants/icons";
import images from "@/constants/images";
import "@/global.css";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { getNextRenewal, getUpcomingRenewals } from "@/lib/insights";
import { FREE_SUBSCRIPTION_LIMIT } from "@/lib/purchases";
import { useProStatus } from "@/lib/useProStatus";
import { useSubscriptions } from "@/lib/useSubscriptions";
import { formatCurrency } from "@/lib/utils";
import { useUser } from '@clerk/expo';
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
    const { user } = useUser();
    const posthog = usePostHog();
    const router = useRouter();
    const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { subscriptions, isLoading, createSubscription } = useSubscriptions();
    const { isPro } = useProStatus();

    // Track page view once data has loaded
    useEffect(() => {
        if (isLoading) return;
        posthog.capture('home_screen_viewed', {
            total_subscriptions: subscriptions.length,
            active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
        });
    }, [isLoading, posthog, subscriptions]);

    const upcomingSubscriptions = useMemo(() => getUpcomingRenewals(subscriptions, 7), [subscriptions]);
    const nextRenewal = useMemo(() => getNextRenewal(subscriptions), [subscriptions]);

    const handleSubscriptionPress = (item: Subscription) => {
        const isExpanding = expandedSubscriptionId !== item.id;
        setExpandedSubscriptionId((currentId) => (currentId === item.id ? null : item.id));
        posthog.capture(isExpanding ? 'subscription_expanded' : 'subscription_collapsed', {
            subscription_name: item.name,
            subscription_id: item.id,
            subscription_price: item.price,
            subscription_status: item.status ?? null,
        });
    };

    const handleCreateSubscription = async (values: SubscriptionFormValues) => {
        try {
            await createSubscription(values);
            console.info('[Analytics] Subscription created event tracked');
        } catch (error) {
            console.error('[Analytics] Error creating subscription:', error);
            posthog.capture('subscription_creation_failed', {
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });
            alertDialog('Subscription not saved', 'Please try again once your account is fully loaded.');
            throw error;
        }
    };

    const activeCount = subscriptions.filter(s => s.status === 'active').length;

    const handleAddModalOpen = async () => {
        if (!isPro && activeCount >= FREE_SUBSCRIPTION_LIMIT) {
            posthog.capture('subscription_limit_paywall_shown', { active_count: activeCount });
            const seePro = await confirmDialog({
                title: 'Free plan limit reached',
                message: `Lumora's free plan tracks up to ${FREE_SUBSCRIPTION_LIMIT} active subscriptions. Upgrade to Pro for unlimited tracking.`,
                confirmText: 'See Pro',
                cancelText: 'Not now',
            });
            if (seePro) router.push('/paywall');
            return;
        }
        setIsModalVisible(true);
        posthog.capture('create_subscription_modal_opened', {
            timestamp: new Date().toISOString(),
        });
    };

    const handleAddModalClose = () => {
        setIsModalVisible(false);
        posthog.capture('create_subscription_modal_closed', {
            timestamp: new Date().toISOString(),
        });
    };

    // Get user display name: firstName, fullName, or email
    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';

    return (
        <SafeAreaView className="flex-1 bg-background p-5">
            <FlatList
                ListHeaderComponent={() => (
                    <>
                        <View className="home-header">
                            <View className="home-user">
                                <Image
                                    source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                                    className="home-avatar"
                                />
                                <Text className="home-user-name">{displayName}</Text>
                            </View>

                            <Pressable onPress={handleAddModalOpen} accessibilityRole="button" accessibilityLabel="Add subscription">
                                <Image source={icons.add} className="home-add-icon" />
                            </Pressable>
                        </View>

                        <View className="home-balance-card">
                            <Text className="home-balance-label">
                                {nextRenewal ? 'Next Renewal' : 'Balance'}
                            </Text>

                            <View className="home-balance-row">
                                <Text className="home-balance-amount">
                                    {nextRenewal ? formatCurrency(nextRenewal.subscription.price, nextRenewal.subscription.currency) : formatCurrency(0)}
                                </Text>
                                <Text className="home-balance-date">
                                    {nextRenewal ? dayjs(nextRenewal.date).format('MM/DD') : '--/--'}
                                </Text>
                            </View>
                        </View>

                        <View className="mb-5">
                            <ListHeading title="Upcoming" onActionPress={() => router.push('/(tabs)/subscriptions')} />

                            <FlatList
                                data={upcomingSubscriptions}
                                renderItem={({ item }) => (
                                    <UpcomingSubscriptionCard
                                        id={item.id}
                                        name={item.name}
                                        price={item.price}
                                        currency={item.currency}
                                        iconKey={item.iconKey}
                                        daysLeft={Math.max(1, dayjs(item.renewalDate).diff(dayjs(), 'day'))}
                                    />
                                )}
                                keyExtractor={(item) => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                ListEmptyComponent={<Text className="home-empty-state">No upcoming renewals yet.</Text>}
                            />
                        </View>

                        <ListHeading title="All Subscriptions" />
                    </>
                )}
                data={subscriptions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <SubscriptionCard
                        {...item}
                        expanded={expandedSubscriptionId === item.id}
                        onPress={() => handleSubscriptionPress(item)}
                        onManagePress={() => router.push(`/subscriptions/${item.id}`)}
                    />
                )}
                extraData={expandedSubscriptionId}
                ItemSeparatorComponent={() => <View className="h-4" />}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    isLoading ? (
                        <ActivityIndicator className="mt-10" color="#ea7a53" />
                    ) : (
                        <View className="items-center py-10">
                            <Text className="home-empty-state text-center">No subscriptions yet.{"\n"}Tap + to add your first one.</Text>
                        </View>
                    )
                }
                contentContainerClassName="pb-30"
            />

            <CreateSubscriptionModal
                visible={isModalVisible}
                onClose={handleAddModalClose}
                onSubmit={handleCreateSubscription}
            />
        </SafeAreaView>
    );
}
