import { formatCurrency } from '@/lib/utils';
import Constants from 'expo-constants';
import dayjs from 'dayjs';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = typeof ExpoNotifications;

// expo-notifications' scheduling APIs aren't implemented on web. Android push
// APIs are also unavailable in Expo Go as of SDK 53+, and importing the module
// there triggers Expo's remote-notification warning before app code can opt out.
const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';
const isSupported = Platform.OS !== 'web' && !isExpoGoAndroid;

let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
    if (!isSupported) return null;

    notificationsPromise ??= import('expo-notifications').then((module) => {
        if (!notificationHandlerConfigured) {
            module.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
            notificationHandlerConfigured = true;
        }

        return module;
    });

    return notificationsPromise;
}

function reminderIdentifier(subscriptionId: string): string {
    return `renewal-${subscriptionId}`;
}

export async function ensureNotificationPermission(): Promise<boolean> {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

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
    const Notifications = await getNotifications();
    if (!Notifications) return;

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
    const Notifications = await getNotifications();
    if (!Notifications) return;

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
