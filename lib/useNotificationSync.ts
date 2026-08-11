import { getMonthlySpend } from '@/lib/insights';
import { scheduleBudgetAlert, scheduleWeeklyDigest, syncRenewalReminders } from '@/lib/notifications';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useUserSettings } from '@/lib/useUserSettings';
import { useEffect } from 'react';

/** Keeps scheduled local renewal + trial reminders in sync with live subscription data. */
export function useNotificationSync() {
    const { subscriptions, isLoading: subscriptionsLoading } = useSubscriptions();
    const {
        reminderDaysBefore,
        notificationsEnabled,
        trialAlertsEnabled,
        weeklyDigestEnabled,
        monthlyBudget,
        currency,
        isLoading: settingsLoading,
    } = useUserSettings();

    useEffect(() => {
        if (subscriptionsLoading || settingsLoading) return;
        syncRenewalReminders(subscriptions, reminderDaysBefore, notificationsEnabled, trialAlertsEnabled).catch(
            (error) => {
                console.error('Failed to sync renewal reminders:', error);
            }
        );

        scheduleWeeklyDigest(subscriptions, notificationsEnabled && weeklyDigestEnabled).catch((error) => {
            console.error('Failed to schedule weekly digest:', error);
        });

        scheduleBudgetAlert(getMonthlySpend(subscriptions), monthlyBudget, notificationsEnabled, currency).catch(
            (error) => {
                console.error('Failed to schedule budget alert:', error);
            }
        );
    }, [
        subscriptions,
        reminderDaysBefore,
        notificationsEnabled,
        trialAlertsEnabled,
        weeklyDigestEnabled,
        monthlyBudget,
        currency,
        subscriptionsLoading,
        settingsLoading,
    ]);
}
