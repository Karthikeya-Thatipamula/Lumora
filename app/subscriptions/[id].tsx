import { useThemeColors } from '@/lib/useThemeColors';
import { daysUntil } from '@/lib/dates';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';
import type { Category, Frequency, SubscriptionFormValues } from '@/lib/subscriptionTypes';
import { SafeAreaView } from '@/components/SafeAreaView';
import SubscriptionAvatar from '@/components/SubscriptionAvatar';
import UsageTracker from '@/components/UsageTracker';
import {
    alertDialog,
    confirmDeleteSubscription,
    confirmDialog,
    RETRY_WHEN_LOADED,
} from '@/lib/dialogs';
import { getCancellationUrl } from '@/lib/discovery';
import { getCostPerUse, monthlyEquivalent } from '@/lib/insights';
import { safeBack } from '@/lib/navigation';
import { knownPaymentMethods } from '@/lib/subscriptionFilters';
import { useSubscription, useSubscriptions } from '@/lib/useSubscriptions';
import { formatCurrency, formatStatusLabel, formatSubscriptionDateTime } from '@/lib/utils';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

const SubscriptionDetails = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const posthog = usePostHog();
    const themeColors = useThemeColors();
    const router = useRouter();
    const [isEditVisible, setIsEditVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { subscription, isLoading } = useSubscription(id);
    const {
        subscriptions,
        updateSubscription,
        setSubscriptionStatus,
        deleteSubscription,
        endTrial,
        logUsage,
        resetUsage,
    } = useSubscriptions();

    // Rebuilt inline this would change identity every render; the modal resets its
    // fields from it, so a stable reference keeps in-progress edits alive.
    const initialValues = useMemo<SubscriptionFormValues | undefined>(
        () =>
            subscription
                ? {
                      name: subscription.name,
                      price: subscription.price,
                      frequency: (subscription.billing as Frequency) ?? 'Monthly',
                      category: (subscription.category as Category) ?? 'Other',
                      currency: subscription.currency,
                      paymentMethod: subscription.paymentMethod,
                      isTrial: Boolean(subscription.isTrial),
                      householdSize: subscription.householdSize ?? 1,
                  }
                : undefined,
        [subscription],
    );

    useEffect(() => {
        if (id && typeof id === 'string' && id.trim()) {
            posthog.capture('subscription_details_viewed', { subscription_id: id });
        }
    }, [id, posthog]);

    if (isLoading || isDeleting) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator color={themeColors.accent} />
            </SafeAreaView>
        );
    }

    if (!subscription) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-5">
                <Text style={{ fontSize: 32 }}>🔍</Text>
                <Text className="text-lg font-sans-semibold text-primary">
                    Subscription not found
                </Text>
                <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                    It may have been deleted on another device.
                </Text>
                <Link href="/(tabs)/subscriptions" className="text-sm font-sans-bold text-accent">
                    Go back
                </Link>
            </SafeAreaView>
        );
    }

    const isPaused = subscription.status === 'paused';
    const isCancelled = subscription.status === 'cancelled';
    const isTrial = Boolean(subscription.isTrial && subscription.trialEndsAt);
    const trialDaysLeft = isTrial ? (daysUntil(subscription.trialEndsAt) ?? 0) : 0;

    const handleTogglePause = async () => {
        const nextStatus = isPaused ? 'active' : 'paused';
        try {
            await setSubscriptionStatus(subscription.id, nextStatus);
            posthog.capture(isPaused ? 'subscription_resumed' : 'subscription_paused', {
                subscription_id: subscription.id,
            });
        } catch (error) {
            console.error('Update subscription status failed:', error);
            alertDialog('Update failed', RETRY_WHEN_LOADED);
        }
    };

    const handleEndTrial = async () => {
        const confirmed = await confirmDialog({
            title: 'Keep this subscription?',
            message: `${subscription.name} becomes a paid ${subscription.billing.toLowerCase()} subscription at ${formatCurrency(subscription.price, subscription.currency)}.`,
            confirmText: 'Keep it',
            cancelText: 'Not yet',
        });
        if (!confirmed) return;

        try {
            await endTrial(subscription.id, (subscription.billing as Frequency) ?? 'Monthly');
            posthog.capture('trial_converted_to_paid', { subscription_id: subscription.id });
        } catch (error) {
            console.error('Convert trial failed:', error);
            alertDialog('Update failed', RETRY_WHEN_LOADED);
        }
    };

    const cancellationUrl = getCancellationUrl(subscription.name);

    /** Opens the provider's own cancellation page. Lumora never cancels anything itself. */
    const handleOpenCancellationPage = async () => {
        if (!cancellationUrl) return;
        posthog.capture('cancellation_page_opened', {
            subscription_id: subscription.id,
            subscription_name: subscription.name,
        });

        try {
            await WebBrowser.openBrowserAsync(cancellationUrl);
        } catch (error) {
            console.error('Failed to open cancellation page:', error);
            alertDialog(
                'Could not open the page',
                `Visit ${cancellationUrl} in your browser to manage this subscription.`,
            );
        }
    };

    const handleCancel = async () => {
        const yearlySaving = monthlyEquivalent(subscription) * 12;
        const confirmed = await confirmDialog({
            title: isTrial ? 'Cancel before you’re charged?' : 'Cancel subscription?',
            message: isTrial
                ? `This marks ${subscription.name} as cancelled so you won't be charged ${formatCurrency(subscription.price, subscription.currency)}.`
                : `This marks ${subscription.name} as cancelled and adds ${formatCurrency(yearlySaving, subscription.currency)}/year to your reclaimed savings.`,
            confirmText: 'Cancel subscription',
            cancelText: 'Keep it',
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await setSubscriptionStatus(subscription.id, 'cancelled');
            posthog.capture('subscription_cancelled', {
                subscription_id: subscription.id,
                was_trial: isTrial,
                yearly_saving: yearlySaving,
            });
            alertDialog(
                'Nice save 🎉',
                `You've reclaimed ${formatCurrency(yearlySaving, subscription.currency)} a year. See the running total in Insights.`,
            );
        } catch (error) {
            console.error('Cancel subscription failed:', error);
            alertDialog('Cancel failed', RETRY_WHEN_LOADED);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirmDeleteSubscription(subscription.name);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await deleteSubscription(subscription.id);
            posthog.capture('subscription_deleted', { subscription_id: subscription.id });
            safeBack(router, '/(tabs)/subscriptions');
        } catch (error) {
            console.error('Delete subscription failed:', error);
            setIsDeleting(false);
            alertDialog('Delete failed', RETRY_WHEN_LOADED);
        }
    };

    const handleEditSubmit = async (values: SubscriptionFormValues) => {
        try {
            await updateSubscription(subscription.id, values);
        } catch (error) {
            console.error('Update subscription failed:', error);
            alertDialog('Update failed', RETRY_WHEN_LOADED);
            throw error;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <ScrollView
                className="flex-1 p-5"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                <View className="mb-6 flex-row items-center justify-between">
                    <Pressable
                        onPress={() => safeBack(router, '/(tabs)/subscriptions')}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        hitSlop={12}
                    >
                        <Text className="text-2xl text-primary">‹</Text>
                    </Pressable>
                    <Text className="text-lg font-sans-bold text-primary">Details</Text>
                    <Pressable
                        onPress={() => setIsEditVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit subscription"
                        hitSlop={12}
                    >
                        <Text className="text-sm font-sans-bold text-accent">Edit</Text>
                    </Pressable>
                </View>

                <View className="mb-6 items-center gap-3">
                    <SubscriptionAvatar
                        name={subscription.name}
                        iconKey={subscription.iconKey}
                        className="size-20 rounded-2xl"
                    />
                    <Text className="text-2xl font-sans-bold text-primary">
                        {subscription.name}
                    </Text>
                    <Text className="text-3xl font-sans-extrabold text-primary">
                        {formatCurrency(subscription.price, subscription.currency)}
                        <Text className="text-base font-sans-medium text-muted-foreground">
                            {' '}
                            / {subscription.billing}
                        </Text>
                    </Text>
                </View>

                {isTrial && !isCancelled && (
                    <View className="mb-5 gap-3 rounded-3xl border border-accent/30 bg-accent/10 p-5">
                        <Text className="text-base font-sans-bold text-accent">
                            {trialDaysLeft === 0
                                ? 'Free trial ends today'
                                : `Free trial — ${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left`}
                        </Text>
                        <Text className="text-sm font-sans-medium text-muted-foreground">
                            You&apos;ll be charged{' '}
                            {formatCurrency(subscription.price, subscription.currency)} on{' '}
                            {formatSubscriptionDateTime(subscription.trialEndsAt)} unless you cancel
                            first.
                        </Text>
                        <Pressable
                            className="auth-secondary-button"
                            onPress={handleEndTrial}
                            accessibilityRole="button"
                            accessibilityLabel="Convert trial to a paid subscription"
                        >
                            <Text className="auth-secondary-button-text">
                                I&apos;m keeping it — convert to paid
                            </Text>
                        </Pressable>
                    </View>
                )}

                <View className="auth-card mb-5 gap-4">
                    <View className="sub-row">
                        <Text className="sub-label">Payment</Text>
                        <Text className="sub-value text-right">
                            {subscription.paymentMethod?.trim() || 'Not provided'}
                        </Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Category</Text>
                        <Text className="sub-value text-right">
                            {subscription.category?.trim() ||
                                subscription.plan?.trim() ||
                                'Not provided'}
                        </Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Started</Text>
                        <Text className="sub-value text-right">
                            {formatSubscriptionDateTime(subscription.startDate)}
                        </Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">
                            {isTrial ? 'First charge' : 'Renewal date'}
                        </Text>
                        <Text className="sub-value text-right">
                            {formatSubscriptionDateTime(subscription.renewalDate)}
                        </Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Status</Text>
                        <Text className="sub-value text-right">
                            {isTrial && !isCancelled
                                ? 'Free trial'
                                : formatStatusLabel(subscription.status)}
                        </Text>
                    </View>
                </View>

                {!isCancelled && (
                    <UsageTracker
                        usageCount={subscription.usageCount ?? 0}
                        costPerUse={getCostPerUse(subscription)}
                        currency={subscription.currency}
                        monthlyEquivalent={monthlyEquivalent(subscription)}
                        onLogUse={() => {
                            logUsage(subscription.id, 1).catch((error) => {
                                console.error('Log usage failed:', error);
                                alertDialog('Not saved', RETRY_WHEN_LOADED);
                            });
                            posthog.capture('usage_logged', { subscription_id: subscription.id });
                        }}
                        onUndo={() => {
                            logUsage(subscription.id, -1).catch((error) => {
                                console.error('Undo usage failed:', error);
                            });
                        }}
                        onReset={() => {
                            resetUsage(subscription.id).catch((error) => {
                                console.error('Reset usage failed:', error);
                            });
                        }}
                    />
                )}

                {!isCancelled && (
                    <Pressable
                        className="sub-cancel mb-3"
                        onPress={handleTogglePause}
                        accessibilityRole="button"
                    >
                        <Text className="sub-cancel-text">
                            {isPaused ? 'Resume Subscription' : 'Pause Subscription'}
                        </Text>
                    </Pressable>
                )}

                {!isCancelled && cancellationUrl && (
                    <View className="mb-3 gap-2 rounded-2xl border border-border bg-card p-4">
                        <Text className="text-sm font-sans-semibold text-primary">
                            Cancel with {subscription.name}
                        </Text>
                        <Text className="text-xs font-sans-medium text-muted-foreground">
                            Lumora can&apos;t cancel on your behalf — it has no access to your
                            accounts. This opens {subscription.name}&apos;s own cancellation page;
                            mark it cancelled here afterwards.
                        </Text>
                        <Pressable
                            className="auth-secondary-button"
                            onPress={handleOpenCancellationPage}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${subscription.name} cancellation page`}
                        >
                            <Text className="auth-secondary-button-text">
                                Open cancellation page ↗
                            </Text>
                        </Pressable>
                    </View>
                )}

                {!isCancelled && (
                    <Pressable
                        className="auth-secondary-button mb-3"
                        onPress={handleCancel}
                        accessibilityRole="button"
                    >
                        <Text className="auth-secondary-button-text">Mark as Cancelled</Text>
                    </Pressable>
                )}

                <Pressable
                    className="auth-secondary-button mb-10 border-destructive/30 bg-destructive/10"
                    onPress={handleDelete}
                    accessibilityRole="button"
                >
                    <Text className="auth-secondary-button-text text-destructive">
                        Delete Subscription
                    </Text>
                </Pressable>
            </ScrollView>

            <CreateSubscriptionModal
                visible={isEditVisible}
                mode="edit"
                onClose={() => setIsEditVisible(false)}
                onSubmit={handleEditSubmit}
                initialValues={initialValues}
                knownPaymentMethods={knownPaymentMethods(subscriptions)}
            />
        </SafeAreaView>
    );
};

export default SubscriptionDetails;
