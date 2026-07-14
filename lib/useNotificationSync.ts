import { syncRenewalReminders } from '@/lib/notifications';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useUserSettings } from '@/lib/useUserSettings';
import { useEffect } from 'react';

/** Keeps scheduled local renewal reminders in sync with live subscription + settings data. */
export function useNotificationSync() {
    const { subscriptions, isLoading: subscriptionsLoading } = useSubscriptions();
    const { reminderDaysBefore, notificationsEnabled, isLoading: settingsLoading } = useUserSettings();

    useEffect(() => {
        if (subscriptionsLoading || settingsLoading) return;
        syncRenewalReminders(subscriptions, reminderDaysBefore, notificationsEnabled).catch((error) => {
            console.error('Failed to sync renewal reminders:', error);
        });
    }, [subscriptions, reminderDaysBefore, notificationsEnabled, subscriptionsLoading, settingsLoading]);
}
