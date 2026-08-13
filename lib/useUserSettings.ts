import { api } from '@/convex/_generated/api';
import { getDeviceCurrency } from '@/lib/currency';
import { useConvexQueryGate } from '@/lib/useConvexQueryGate';
import { useMutation, useQuery } from 'convex/react';

export type ThemePreference = 'system' | 'light' | 'dark';

type UserSettingsPatch = {
    monthlyBudget?: number;
    reminderDaysBefore?: number;
    notificationsEnabled?: boolean;
    trialAlertsEnabled?: boolean;
    weeklyDigestEnabled?: boolean;
    monthlyIncome?: number;
    themePreference?: ThemePreference;
    currency?: string;
};

// Read once at module load: the device locale can't change mid-session, and this
// keeps the fallback stable rather than recomputing on every render.
const deviceCurrency = getDeviceCurrency();

export function useUserSettings() {
    const { canQuery, isAuthResolving } = useConvexQueryGate();

    const settings = useQuery(api.userSettings.get, canQuery ? {} : 'skip');
    const updateMutation = useMutation(api.userSettings.update);

    const isLoading = isAuthResolving || (canQuery && settings === undefined);

    const updateSettings = async (patch: UserSettingsPatch) => {
        if (!canQuery) {
            throw new Error(
                'Please wait for your secure data connection before updating settings.',
            );
        }
        // No optimistic local copy needed — the mutation's write pushes straight back
        // through the live query, so the toggle reflects the value that actually saved.
        return await updateMutation(patch);
    };

    return {
        monthlyBudget: settings?.monthlyBudget,
        reminderDaysBefore: settings?.reminderDaysBefore ?? 3,
        notificationsEnabled: settings?.notificationsEnabled ?? true,
        trialAlertsEnabled: settings?.trialAlertsEnabled ?? true,
        weeklyDigestEnabled: settings?.weeklyDigestEnabled ?? true,
        monthlyIncome: settings?.monthlyIncome,
        themePreference: (settings?.themePreference as ThemePreference) ?? 'system',
        // Falls back to the device's currency so non-US users aren't defaulted to dollars.
        currency: settings?.currency ?? deviceCurrency,
        isLoading,
        updateSettings,
    };
}
