import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import { HOME_BALANCE } from "@/constants/data";
import { icons } from "@/constants/icons";
import images from "@/constants/images";
import "@/global.css";
import { useSubscriptionStore } from "@/lib/subscriptionStore";
import { formatCurrency } from "@/lib/utils";
import { useUser } from '@clerk/expo';
import dayjs from "dayjs";
import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
    const { user } = useUser();
    const posthog = usePostHog();
    const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { subscriptions, addSubscription } = useSubscriptionStore();

    // Track page view on mount
    useEffect(() => {
        posthog.capture('home_screen_viewed', {
            total_subscriptions: subscriptions.length,
            active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
        });
    }, []);

    // Get upcoming subscriptions (active subscriptions with renewal date within next 7 days)
    const upcomingSubscriptions = useMemo(() => {
        const now = dayjs();
        const nextWeek = now.add(7, 'days');
        return subscriptions.filter(sub =>
            sub.status === 'active' &&
            dayjs(sub.renewalDate).isAfter(now) &&
            dayjs(sub.renewalDate).isBefore(nextWeek)
        ).sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));
    }, [subscriptions]);

    const handleSubscriptionPress = (item: Subscription) => {
        const isExpanding = expandedSubscriptionId !== item.id;
        setExpandedSubscriptionId((currentId) => (currentId === item.id ? null : item.id));
        posthog.capture(isExpanding ? 'subscription_expanded' : 'subscription_collapsed', {
            subscription_name: item.name,
            subscription_id: item.id,
            subscription_price: item.price,
            subscription_status: item.status,
        });
    };

    const handleCreateSubscription = (newSubscription: Subscription) => {
        try {
            addSubscription(newSubscription);
            posthog.capture('subscription_created', {
                subscription_name: newSubscription.name,
                subscription_price: newSubscription.price,
                subscription_frequency: newSubscription.frequency,
                subscription_category: newSubscription.category,
                subscription_status: newSubscription.status,
                timestamp: new Date().toISOString(),
            });
            console.info('[Analytics] Subscription created event tracked');
        } catch (error) {
            console.error('[Analytics] Error creating subscription:', error);
            posthog.capture('subscription_creation_failed', {
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    const handleAddModalOpen = () => {
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

                            <Pressable onPress={handleAddModalOpen}>
                                <Image source={icons.add} className="home-add-icon" />
                            </Pressable>
                        </View>

                        <View className="home-balance-card">
                            <Text className="home-balance-label">Balance</Text>

                            <View className="home-balance-row">
                                <Text className="home-balance-amount">
                                    {formatCurrency(HOME_BALANCE.amount)}
                                </Text>
                                <Text className="home-balance-date">
                                    {dayjs(HOME_BALANCE.nextRenewalDate).format('MM/DD')}
                                </Text>
                            </View>
                        </View>

                        <View className="mb-5">
                            <ListHeading title="Upcoming" />

                            <FlatList
                                data={upcomingSubscriptions}
                                renderItem={({ item }) => (<UpcomingSubscriptionCard {...item} />)}
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
                    />
                )}
                extraData={expandedSubscriptionId}
                ItemSeparatorComponent={() => <View className="h-4" />}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text className="home-empty-state">No subscriptions yet.</Text>}
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