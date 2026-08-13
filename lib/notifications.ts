import type { Subscription } from '@/lib/subscriptionTypes';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import Constants from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = typeof ExpoNotifications;

// expo-notifications' scheduling APIs aren't implemented on web. Android push
// APIs are also unavailable in Expo Go as of SDK 53+, and importing the module
// there triggers Expo's remote-notification warning before app code can opt out.
const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';
const isSupported = Platform.OS !== 'web' && !isExpoGoAndroid;

/** Lets the UI explain *why* reminders are unavailable rather than blaming permissions. */
export const areNotificationsSupported = isSupported;
export const notificationsUnsupportedReason = isExpoGoAndroid
    ? 'Scheduled reminders need a development build — Expo Go on Android can’t schedule them.'
    : Platform.OS === 'web'
      ? 'Scheduled reminders aren’t available on the web version.'
      : null;

/** How far ahead of a trial converting to paid we warn — the window to still cancel free. */
export const TRIAL_REMINDER_DAYS_BEFORE = 2;

let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
    if (!isSupported) return null;

    notificationsPromise ??= import('expo-notifications')
        .then((module) => {
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
        })
        .catch((error) => {
            // A missing native module must never take the app down — reminders are
            // an enhancement, every caller degrades to a no-op.
            console.warn('Notifications unavailable in this build:', error);
            return null;
        });

    return notificationsPromise;
}

function reminderIdentifier(subscriptionId: string): string {
    return `renewal-${subscriptionId}`;
}

function trialReminderIdentifier(subscriptionId: string): string {
    return `trial-${subscriptionId}`;
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

async function cancel(identifier: string): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
        console.warn('Failed to cancel reminder:', error);
    }
}

async function cancelReminder(subscriptionId: string): Promise<void> {
    await cancel(reminderIdentifier(subscriptionId));
}

/** Clears every reminder tied to a subscription — used on delete, pause and cancel. */
export async function cancelAllRemindersFor(subscriptionId: string): Promise<void> {
    await Promise.all([
        cancel(reminderIdentifier(subscriptionId)),
        cancel(trialReminderIdentifier(subscriptionId)),
    ]);
}

async function schedule(
    Notifications: NotificationsModule,
    identifier: string,
    title: string,
    body: string,
    date: Date,
): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            identifier,
            content: { title, body, sound: false },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date,
            },
        });
    } catch (error) {
        console.warn(`Failed to schedule notification ${identifier}:`, error);
    }
}

/** 9am local on the morning of `daysBefore` ahead of `target`, or null if that's already past. */
function alertTime(target: string, daysBefore: number): Date | null {
    const parsed = dayjs(target);
    if (!parsed.isValid()) return null;

    const triggerDate = parsed
        .subtract(daysBefore, 'day')
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0);
    return triggerDate.isAfter(dayjs()) ? triggerDate.toDate() : null;
}

/** Schedules (or reschedules) a single local reminder for a subscription's next renewal. */
export async function scheduleRenewalReminder(
    subscription: Subscription,
    daysBefore: number,
): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await cancelReminder(subscription.id);

    if (subscription.status !== 'active' || !subscription.renewalDate) return;
    // Trials get their own, more urgent alert — don't double-notify for the same date.
    if (subscription.isTrial) return;

    // A per-subscription lead time wins over the account default: a yearly plan you
    // want a week's warning on shouldn't force the same on everything else.
    const lead = subscription.reminderDaysBefore ?? daysBefore;
    const date = alertTime(subscription.renewalDate, lead);
    if (!date) return;

    await schedule(
        Notifications,
        reminderIdentifier(subscription.id),
        `${subscription.name} renews soon`,
        `${formatCurrency(subscription.price, subscription.currency)} renews on ${dayjs(subscription.renewalDate).format('MMM D')}.`,
        date,
    );
}

/**
 * Warns before a free trial converts to a paid subscription. Short trials fall back to
 * progressively later slots so a 1-day trial still gets an alert instead of none.
 */
export async function scheduleTrialReminder(subscription: Subscription): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await cancel(trialReminderIdentifier(subscription.id));

    if (subscription.status !== 'active' || !subscription.isTrial || !subscription.trialEndsAt)
        return;

    const date =
        alertTime(subscription.trialEndsAt, TRIAL_REMINDER_DAYS_BEFORE) ??
        alertTime(subscription.trialEndsAt, 1) ??
        alertTime(subscription.trialEndsAt, 0);
    if (!date) return;

    await schedule(
        Notifications,
        trialReminderIdentifier(subscription.id),
        `${subscription.name} trial ends soon`,
        `You'll be charged ${formatCurrency(subscription.price, subscription.currency)} on ${dayjs(subscription.trialEndsAt).format('MMM D')}. Cancel before then to stay free.`,
        date,
    );
}

const WEEKLY_DIGEST_IDENTIFIER = 'weekly-digest';

/** Sunday 6pm — ahead of the week the digest describes, not buried in a Monday morning. */
const DIGEST_WEEKDAY = 1; // expo-notifications weekdays are 1-indexed from Sunday
const DIGEST_HOUR = 18;

function buildDigestBody(subscriptions: Subscription[]): string | null {
    const today = dayjs().startOf('day');
    const weekEnd = today.add(7, 'day');

    const dueThisWeek = subscriptions.filter((sub) => {
        if (sub.status !== 'active' || !sub.renewalDate) return false;
        const renewal = dayjs(sub.renewalDate);
        if (!renewal.isValid()) return false;
        const day = renewal.startOf('day');
        return !day.isBefore(today) && !day.isAfter(weekEnd);
    });

    if (dueThisWeek.length === 0) return null;

    const total = dueThisWeek.reduce(
        (sum, sub) => sum + sub.price / Math.max(1, sub.householdSize ?? 1),
        0,
    );
    const currency = dueThisWeek[0].currency;
    const names = dueThisWeek
        .slice(0, 3)
        .map((sub) => sub.name)
        .join(', ');
    const extra = dueThisWeek.length > 3 ? ` and ${dueThisWeek.length - 3} more` : '';

    return `${formatCurrency(total, currency)} due this week — ${names}${extra}.`;
}

/**
 * A single repeating weekly summary of the week ahead. One predictable touchpoint beats
 * a stream of per-subscription pings, and it brings people back into the app on a
 * cadence without being the kind of noise that gets notifications switched off.
 */
export async function scheduleWeeklyDigest(
    subscriptions: Subscription[],
    enabled: boolean,
): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await cancel(WEEKLY_DIGEST_IDENTIFIER);
    if (!enabled) return;

    const body = buildDigestBody(subscriptions);
    // Nothing due means nothing worth interrupting anyone for.
    if (!body) return;

    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    try {
        await Notifications.scheduleNotificationAsync({
            identifier: WEEKLY_DIGEST_IDENTIFIER,
            content: { title: 'Your week in subscriptions', body, sound: false },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: DIGEST_WEEKDAY,
                hour: DIGEST_HOUR,
                minute: 0,
            },
        });
    } catch (error) {
        console.warn('Failed to schedule weekly digest:', error);
    }
}

const BUDGET_ALERT_IDENTIFIER = 'budget-alert';

/** Warn once spend crosses this share of the cap, while there's still room to act. */
const BUDGET_WARNING_THRESHOLD = 0.9;

/**
 * Fires when monthly spend approaches or passes the budget.
 *
 * The budget card has always promised "and via notifications"; until now nothing sent one.
 * Scheduled a minute out rather than fired immediately so it survives the app being
 * backgrounded straight after an edit, and re-scheduled (not duplicated) on every sync.
 */
export async function scheduleBudgetAlert(
    monthlySpend: number,
    monthlyBudget: number | undefined,
    enabled: boolean,
    currency?: string,
): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await cancel(BUDGET_ALERT_IDENTIFIER);

    if (!enabled || !monthlyBudget || monthlyBudget <= 0) return;
    if (monthlySpend < monthlyBudget * BUDGET_WARNING_THRESHOLD) return;

    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    const isOver = monthlySpend > monthlyBudget;
    const body = isOver
        ? `You're at ${formatCurrency(monthlySpend, currency)} against a ${formatCurrency(monthlyBudget, currency)} budget.`
        : `You're at ${formatCurrency(monthlySpend, currency)} of your ${formatCurrency(monthlyBudget, currency)} budget.`;

    try {
        await Notifications.scheduleNotificationAsync({
            identifier: BUDGET_ALERT_IDENTIFIER,
            content: {
                title: isOver
                    ? 'Over your subscription budget'
                    : 'Close to your subscription budget',
                body,
                sound: false,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 60,
                repeats: false,
            },
        });
    } catch (error) {
        console.warn('Failed to schedule budget alert:', error);
    }
}

/** Reconciles scheduled reminders against the current subscription list — call whenever it changes. */
export async function syncRenewalReminders(
    subscriptions: Subscription[],
    daysBefore: number,
    enabled: boolean,
    trialAlertsEnabled = true,
): Promise<void> {
    if (!isSupported) return;

    if (!enabled) {
        await Promise.all(
            subscriptions.map((subscription) => cancelAllRemindersFor(subscription.id)),
        );
        await cancel(WEEKLY_DIGEST_IDENTIFIER);
        await cancel(BUDGET_ALERT_IDENTIFIER);
        return;
    }

    // Ask once for the whole batch rather than per subscription.
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    for (const subscription of subscriptions) {
        await scheduleRenewalReminder(subscription, daysBefore);

        if (trialAlertsEnabled) {
            await scheduleTrialReminder(subscription);
        } else {
            await cancel(trialReminderIdentifier(subscription.id));
        }
    }
}
