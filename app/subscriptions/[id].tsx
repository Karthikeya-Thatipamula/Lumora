import CreateSubscriptionModal, { Category, Frequency, SubscriptionFormValues } from '@/components/CreateSubscriptionModal';
import SubscriptionAvatar from '@/components/SubscriptionAvatar';
import { confirmDialog } from '@/lib/dialogs';
import { formatCurrency, formatStatusLabel, formatSubscriptionDateTime } from '@/lib/utils';
import { useSubscription, useSubscriptions } from '@/lib/useSubscriptions';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SubscriptionDetails = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const posthog = usePostHog();
    const router = useRouter();
    const [isEditVisible, setIsEditVisible] = useState(false);

    const { subscription, isLoading } = useSubscription(id);
    const { updateSubscription, setSubscriptionStatus, deleteSubscription } = useSubscriptions();

    useEffect(() => {
        if (id && typeof id === 'string' && id.trim()) {
            posthog.capture('subscription_details_viewed', { subscription_id: id });
        }
    }, [id, posthog]);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator color="#ea7a53" />
            </SafeAreaView>
        );
    }

    if (!subscription) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-5">
                <Text className="text-lg font-sans-semibold text-primary">Subscription not found</Text>
                <Link href="/(tabs)/subscriptions" className="text-sm font-sans-bold text-accent">Go back</Link>
            </SafeAreaView>
        );
    }

    const isPaused = subscription.status === 'paused';
    const isCancelled = subscription.status === 'cancelled';

    const handleTogglePause = async () => {
        const nextStatus = isPaused ? 'active' : 'paused';
        await setSubscriptionStatus(subscription.id, nextStatus);
        posthog.capture(isPaused ? 'subscription_resumed' : 'subscription_paused', { subscription_id: subscription.id });
    };

    const handleCancel = async () => {
        const confirmed = await confirmDialog({
            title: 'Cancel subscription?',
            message: `This marks ${subscription.name} as cancelled. You can still see it in your history.`,
            confirmText: 'Cancel subscription',
            cancelText: 'Keep it',
            destructive: true,
        });
        if (!confirmed) return;

        await setSubscriptionStatus(subscription.id, 'cancelled');
        posthog.capture('subscription_cancelled', { subscription_id: subscription.id });
    };

    const handleDelete = async () => {
        const confirmed = await confirmDialog({
            title: 'Delete subscription?',
            message: `This permanently removes ${subscription.name}. This can't be undone.`,
            confirmText: 'Delete',
            destructive: true,
        });
        if (!confirmed) return;

        await deleteSubscription(subscription.id);
        posthog.capture('subscription_deleted', { subscription_id: subscription.id });
        router.back();
    };

    const handleEditSubmit = async (values: SubscriptionFormValues) => {
        await updateSubscription(subscription.id, values);
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
                <View className="mb-6 flex-row items-center justify-between">
                    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
                        <Text className="text-2xl text-primary">‹</Text>
                    </Pressable>
                    <Text className="text-lg font-sans-bold text-primary">Details</Text>
                    <Pressable onPress={() => setIsEditVisible(true)} accessibilityRole="button" accessibilityLabel="Edit subscription" hitSlop={12}>
                        <Text className="text-sm font-sans-bold text-accent">Edit</Text>
                    </Pressable>
                </View>

                <View className="mb-6 items-center gap-3">
                    <SubscriptionAvatar name={subscription.name} iconKey={subscription.iconKey} className="size-20 rounded-2xl" />
                    <Text className="text-2xl font-sans-bold text-primary">{subscription.name}</Text>
                    <Text className="text-3xl font-sans-extrabold text-primary">
                        {formatCurrency(subscription.price, subscription.currency)}
                        <Text className="text-base font-sans-medium text-muted-foreground"> / {subscription.billing}</Text>
                    </Text>
                </View>

                <View className="auth-card mb-5 gap-4">
                    <View className="sub-row">
                        <Text className="sub-label">Payment</Text>
                        <Text className="sub-value text-right">{subscription.paymentMethod?.trim() || 'Not provided'}</Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Category</Text>
                        <Text className="sub-value text-right">{subscription.category?.trim() || subscription.plan?.trim() || 'Not provided'}</Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Started</Text>
                        <Text className="sub-value text-right">{formatSubscriptionDateTime(subscription.startDate)}</Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Renewal date</Text>
                        <Text className="sub-value text-right">{formatSubscriptionDateTime(subscription.renewalDate)}</Text>
                    </View>
                    <View className="sub-row">
                        <Text className="sub-label">Status</Text>
                        <Text className="sub-value text-right">{formatStatusLabel(subscription.status)}</Text>
                    </View>
                </View>

                {!isCancelled && (
                    <Pressable className="sub-cancel mb-3" onPress={handleTogglePause} accessibilityRole="button">
                        <Text className="sub-cancel-text">{isPaused ? 'Resume Subscription' : 'Pause Subscription'}</Text>
                    </Pressable>
                )}

                {!isCancelled && (
                    <Pressable className="auth-secondary-button mb-3" onPress={handleCancel} accessibilityRole="button">
                        <Text className="auth-secondary-button-text">Cancel Subscription</Text>
                    </Pressable>
                )}

                <Pressable className="auth-secondary-button mb-10 border-destructive/30 bg-destructive/10" onPress={handleDelete} accessibilityRole="button">
                    <Text className="auth-secondary-button-text text-destructive">Delete Subscription</Text>
                </Pressable>
            </ScrollView>

            <CreateSubscriptionModal
                visible={isEditVisible}
                mode="edit"
                onClose={() => setIsEditVisible(false)}
                onSubmit={handleEditSubmit}
                initialValues={{
                    name: subscription.name,
                    price: subscription.price,
                    frequency: (subscription.billing as Frequency) ?? 'Monthly',
                    category: (subscription.category as Category) ?? 'Other',
                }}
            />
        </SafeAreaView>
    )
}

export default SubscriptionDetails
