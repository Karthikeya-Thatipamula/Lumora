import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// expo-notifications' scheduling APIs aren't implemented on web — every exported
// function no-ops there, and none may reject: cancelReminder sits in the delete
// flow, and a notification failure must never block a data operation.
const isSupported = Platform.OS !== 'web';

if (isSupported) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

function reminderIdentifier(subscriptionId: string): string {
    return `renewal-${subscriptionId}`;
}

export async function ensureNotificationPermission(): Promise<boolean> {
    if (!isSupported) return false;

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus === 'granted') return true;

        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.warn('Notification permission check failed:', error);
        return false;
    }
}

/** Schedules (or reschedules) a single local reminder for a subscription's next renewal. */
export async function scheduleRenewalReminder(subscription: Subscription, daysBefore: number): Promise<void> {
    if (!isSupported) return;

    await cancelReminder(subscription.id);

    if (subscription.status !== 'active' || !subscription.renewalDate) return;

    const triggerDate = dayjs(subscription.renewalDate).subtract(daysBefore, 'day').hour(9).minute(0).second(0);
    if (!triggerDate.isAfter(dayjs())) return;

    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    try {
        await Notifications.scheduleNotificationAsync({
            identifier: reminderIdentifier(subscription.id),
            content: {
                title: `${subscription.name} renews soon`,
                body: `${formatCurrency(subscription.price, subscription.currency)} renews on ${dayjs(subscription.renewalDate).format('MMM D')}.`,
                sound: false,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate.toDate(),
            },
        });
    } catch (error) {
        console.warn(`Failed to schedule reminder for ${subscription.name}:`, error);
    }
}

export async function cancelReminder(subscriptionId: string): Promise<void> {
    if (!isSupported) return;

    try {
        await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(subscriptionId));
    } catch (error) {
        console.warn('Failed to cancel reminder:', error);
    }
}

/** Reconciles scheduled reminders against the current subscription list — call whenever it changes. */
export async function syncRenewalReminders(subscriptions: Subscription[], daysBefore: number, enabled: boolean): Promise<void> {
    if (!isSupported) return;

    for (const subscription of subscriptions) {
        if (enabled) {
            await scheduleRenewalReminder(subscription, daysBefore);
        } else {
            await cancelReminder(subscription.id);
        }
    }
}
