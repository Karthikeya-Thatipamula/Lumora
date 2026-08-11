import AnimatedNumber from "@/components/motion/AnimatedNumber";
import PressableScale from "@/components/motion/PressableScale";
import { SubscriptionListSkeleton } from "@/components/motion/Skeleton";
import { SafeAreaView } from '@/components/SafeAreaView';
import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import type { SubscriptionFormValues } from "@/lib/subscriptionTypes";
import DiscoveryAuditCard from "@/components/DiscoveryAuditCard";
import ListHeading from "@/components/ListHeading";
import RenewalTimeline from "@/components/RenewalTimeline";
import SubscriptionCard from "@/components/SubscriptionCard";
import TrialAlertCard from "@/components/TrialAlertCard";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import { getTabBarContentInset } from "@/constants/theme";
import images from "@/constants/images";
import "@/global.css";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { getDiscoveryCoverage, getDiscoveryPrompts } from "@/lib/discovery";
import { findDuplicateName, getEndingTrials, getNextRenewal, getRenewalTimeline, getUpcomingRenewals, personalPrice } from "@/lib/insights";
import { FREE_SUBSCRIPTION_LIMIT } from "@/lib/purchases";
import { useProStatus } from "@/lib/useProStatus";
import { knownPaymentMethods } from "@/lib/subscriptionFilters";
import { useSubscriptions } from "@/lib/useSubscriptions";
import { useUserSettings } from "@/lib/useUserSettings";
import { formatCurrency } from "@/lib/utils";
import { useUser } from '@clerk/expo';
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function App() {
    const { user } = useUser();
    const posthog = usePostHog();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [prefillName, setPrefillName] = useState<string | null>(null);
    const [dismissedGroups, setDismissedGroups] = useState<string[]>([]);
    const [draftName, setDraftName] = useState('');
    const { subscriptions, isLoading, createSubscription, deleteSubscription } = useSubscriptions();
    const { isPro } = useProStatus();
    const { currency } = useUserSettings();

    // Track page view once data has loaded
    useEffect(() => {
        if (isLoading) return;
        posthog.capture('home_screen_viewed', {
            total_subscriptions: subscriptions.length,
            active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
        });
    }, [isLoading, posthog, subscriptions]);

    const upcomingSubscriptions = useMemo(() => getUpcomingRenewals(subscriptions, 7), [subscriptions]);
    const renewalTimeline = useMemo(() => getRenewalTimeline(subscriptions, 30), [subscriptions]);
    const nextRenewal = useMemo(() => getNextRenewal(subscriptions), [subscriptions]);
    const endingTrials = useMemo(() => getEndingTrials(subscriptions, 7), [subscriptions]);
    const discoveryCoverage = useMemo(() => getDiscoveryCoverage(subscriptions), [subscriptions]);
    const discoveryPrompts = useMemo(
        () => getDiscoveryPrompts(subscriptions, 6).filter((prompt) => !dismissedGroups.includes(prompt.group.id)).slice(0, 2),
        [subscriptions, dismissedGroups]
    );

    useEffect(() => {
        if (isLoading || endingTrials.length === 0) return;
        posthog.capture('trial_alert_shown', {
            trial_count: endingTrials.length,
            soonest_days_until_charge: endingTrials[0].daysUntilCharge,
        });
    }, [isLoading, endingTrials, posthog]);

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
        } catch (error) {
            console.error('[Analytics] Error creating subscription:', error);
            posthog.capture('subscription_creation_failed', {
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });
            alertDialog('Subscription not saved', 'Please try again once your account is fully loaded.');
            throw error;
        }
    };

    const handleDeleteSubscription = async (item: Subscription) => {
        const confirmed = await confirmDialog({
            title: 'Delete subscription?',
            message: `This permanently removes ${item.name} and its history. This can't be undone.`,
            confirmText: 'Delete',
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await deleteSubscription(item.id);
            posthog.capture('subscription_deleted', { subscription_id: item.id, source: 'home_card' });
        } catch (error) {
            console.error('Delete subscription failed:', error);
            alertDialog('Delete failed', 'Please try again once your account is fully loaded.');
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

    /** Opens the add form pre-filled from a discovery prompt. */
    const handleDiscoveryAdd = (name: string) => {
        setPrefillName(name);
        setIsModalVisible(true);
        posthog.capture('discovery_prompt_accepted', { suggested_name: name });
    };

    const handleDiscoveryDismiss = (groupId: string) => {
        setDismissedGroups((groups) => [...groups, groupId]);
        posthog.capture('discovery_prompt_dismissed', { group_id: groupId });
    };

    const handleAddModalClose = () => {
        setIsModalVisible(false);
        setPrefillName(null);
        posthog.capture('create_subscription_modal_closed', {
            timestamp: new Date().toISOString(),
        });
    };

    // Get user display name: firstName, fullName, or email
    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';

    return (
        <SafeAreaView className="flex-1 bg-background p-5">
            {/* ListHeaderComponent takes an element, not a function: an inline arrow is a
                new component type each render, remounting the header and its nested list. */}
            <FlatList
                ListHeaderComponent={
                    <>
                        <View className="home-header">
                            <View className="home-user">
                                <Image
                                    source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                                    className="home-avatar"
                                />
                                <Text className="home-user-name">{displayName}</Text>
                            </View>

                            <PressableScale className="home-add-button" scaleTo={0.9} onPress={handleAddModalOpen} accessibilityRole="button" accessibilityLabel="Add subscription" hitSlop={8}>
                                <Text className="home-add-button-glyph">+</Text>
                            </PressableScale>
                        </View>

                        <View className="home-balance-card">
                            <Text className="home-balance-label">
                                {nextRenewal ? 'Next Renewal' : 'Balance'}
                            </Text>

                            <View className="home-balance-row">
                                <AnimatedNumber
                                    className="home-balance-amount"
                                    value={nextRenewal ? personalPrice(nextRenewal.subscription) : 0}
                                    format={(amount) =>
                                        formatCurrency(amount, nextRenewal?.subscription.currency ?? currency)
                                    }
                                />
                                <Text className="home-balance-date">
                                    {nextRenewal ? dayjs(nextRenewal.date).format('MM/DD') : '--/--'}
                                </Text>
                            </View>
                        </View>

                        <TrialAlertCard
                            trials={endingTrials}
                            onPressTrial={(subscriptionId) => router.push(`/subscriptions/${subscriptionId}`)}
                        />

                        <DiscoveryAuditCard
                            prompts={discoveryPrompts}
                            coveragePercentage={discoveryCoverage.percentage}
                            onAdd={handleDiscoveryAdd}
                            onDismiss={handleDiscoveryDismiss}
                        />

                        <View className="mb-5">
                            <ListHeading title="Upcoming" onActionPress={() => router.push('/(tabs)/subscriptions')} />

                            <FlatList
                                data={upcomingSubscriptions}
                                renderItem={({ item }) => (
                                    <UpcomingSubscriptionCard
                                        id={item.id}
                                        name={item.name}
                                        price={personalPrice(item)}
                                        currency={item.currency}
                                        iconKey={item.iconKey}
                                        daysLeft={Math.max(0, dayjs(item.renewalDate).startOf('day').diff(dayjs().startOf('day'), 'day'))}
                                    />
                                )}
                                keyExtractor={(item) => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                ListEmptyComponent={<Text className="home-empty-state">No upcoming renewals yet.</Text>}
                            />
                        </View>

                        {renewalTimeline.length > 0 && (
                            <RenewalTimeline
                                entries={renewalTimeline}
                                onViewAll={() => router.push('/(tabs)/subscriptions')}
                            />
                        )}

                        <ListHeading title="All Subscriptions" />
                    </>
                }
                data={subscriptions}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <Animated.View
                        layout={LinearTransition.duration(220)}
                        entering={FadeInDown.duration(260).delay(Math.min(index, 6) * 40)}
                    >
                        <SubscriptionCard
                            {...item}
                            expanded={expandedSubscriptionId === item.id}
                            onPress={() => handleSubscriptionPress(item)}
                            onManagePress={() => router.push(`/subscriptions/${item.id}`)}
                            onDeletePress={() => handleDeleteSubscription(item)}
                        />
                    </Animated.View>
                )}
                extraData={expandedSubscriptionId}
                ItemSeparatorComponent={() => <View className="h-4" />}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    isLoading ? (
                        <SubscriptionListSkeleton />
                    ) : (
                        <View className="items-center py-10">
                            <Text className="home-empty-state text-center">No subscriptions yet.{"\n"}Tap + to add your first one.</Text>
                        </View>
                    )
                }
                contentContainerStyle={{ paddingBottom: getTabBarContentInset(insets.bottom) }}
            />

            <CreateSubscriptionModal
                visible={isModalVisible}
                onClose={handleAddModalClose}
                onSubmit={handleCreateSubscription}
                defaultCurrency={currency}
                existingNames={subscriptions.map((subscription) => subscription.name)}
                knownPaymentMethods={knownPaymentMethods(subscriptions)}
                prefillName={prefillName ?? undefined}
                onNameChange={setDraftName}
                duplicateWarning={
                    findDuplicateName(subscriptions, draftName)
                        ? `You already track ${draftName.trim()} — this would add a second copy.`
                        : null
                }
            />
        </SafeAreaView>
    );
}
