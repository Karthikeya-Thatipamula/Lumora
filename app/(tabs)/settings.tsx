import { reportError } from '@/lib/monitoring';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDisplayName } from '@/lib/useDisplayName';
import { SafeAreaView } from '@/components/SafeAreaView';
import images from '@/constants/images';
import { getTabBarContentInset } from '@/constants/theme';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { alertDialog, confirmDialog, RETRY_WHEN_LOADED } from '@/lib/dialogs';
import { exportSubscriptionsCsv } from '@/lib/export';
import {
    areNotificationsSupported,
    ensureNotificationPermission,
    notificationsUnsupportedReason,
} from '@/lib/notifications';
import { isPurchasesConfigured } from '@/lib/purchases';
import { getReclaimedSavings } from '@/lib/insights';
import { shareLumora } from '@/lib/share';
import { useProStatus } from '@/lib/useProStatus';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { ThemePreference, useUserSettings } from '@/lib/useUserSettings';
import { api } from '@/convex/_generated/api';
import { useClerk, useUser } from '@clerk/expo';
import { useMutation } from 'convex/react';
import { clsx } from 'clsx';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const REMINDER_OPTIONS = [1, 3, 7];
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];

const Settings = () => {
    const { signOut } = useClerk();
    const { user } = useUser();
    const posthog = usePostHog();
    const themeColors = useThemeColors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isPro } = useProStatus();
    const {
        notificationsEnabled,
        reminderDaysBefore,
        trialAlertsEnabled,
        weeklyDigestEnabled,
        currency,
        themePreference,
        updateSettings,
    } = useUserSettings();
    const { subscriptions } = useSubscriptions();
    const [isRestoring, setIsRestoring] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const deleteAllUserData = useMutation(api.userSettings.deleteAllUserData);

    const reclaimedYearly = useMemo(
        () => getReclaimedSavings(subscriptions).yearly,
        [subscriptions],
    );

    useEffect(() => {
        posthog.capture('settings_screen_viewed', {
            timestamp: new Date().toISOString(),
        });
    }, [posthog]);

    const handleSignOut = async () => {
        try {
            posthog.capture('user_sign_out_initiated', {
                timestamp: new Date().toISOString(),
            });
            await signOut();
            // Only reset analytics after successful sign-out
            posthog.capture('user_signed_out', {
                timestamp: new Date().toISOString(),
            });
            posthog.reset();
        } catch (error) {
            console.error('Sign-out failed:', error);
            posthog.capture('sign_out_failed', {
                error_message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    };

    const handleRestore = async () => {
        if (!isPurchasesConfigured) return;
        setIsRestoring(true);
        try {
            await Purchases.restorePurchases();
            posthog.capture('purchases_restored');
            alertDialog('Restored', 'Your purchases have been restored.');
        } catch (error) {
            console.error('Restore purchases failed:', error);
            alertDialog('Restore failed', 'We couldn’t restore your purchases. Please try again.');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleExport = async () => {
        if (!isPro) {
            posthog.capture('export_paywall_shown', { subscription_count: subscriptions.length });
            const seePro = await confirmDialog({
                title: 'Export is a Pro feature',
                message:
                    'Upgrade to Pro to download your full subscription history as a CSV you can open in Excel, Numbers or Sheets.',
                confirmText: 'See Pro',
                cancelText: 'Not now',
            });
            if (seePro) router.push('/paywall');
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportSubscriptionsCsv(subscriptions);
            if (result.ok) {
                posthog.capture('subscriptions_exported', {
                    subscription_count: subscriptions.length,
                });
                return;
            }

            const messages = {
                empty: 'Add a subscription first — there’s nothing to export yet.',
                unavailable:
                    'Sharing isn’t available on this device, so the file couldn’t be handed off.',
                failed: 'We couldn’t build the export file. Please try again.',
            } as const;
            alertDialog('Export not completed', messages[result.reason]);
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Wipes Convex data first, then the Clerk account. Order matters: if the Clerk user
     * goes first the session dies and the Convex mutation can no longer authenticate,
     * stranding the data it was supposed to remove.
     */
    const handleDeleteAccount = async () => {
        const confirmed = await confirmDialog({
            title: 'Delete your account?',
            message:
                'This permanently erases every subscription, setting and history entry, then closes your Lumora account. It cannot be undone — export your data first if you want a copy.',
            confirmText: 'Delete everything',
            cancelText: 'Keep my account',
            destructive: true,
        });
        if (!confirmed) return;

        setIsDeletingAccount(true);

        // The two steps are not atomic, and which one failed changes what is true. The
        // catch used to claim "Nothing partial was left behind" either way — a flat lie
        // when the data was already gone and only the account remained.
        let dataDeleted = false;
        try {
            await deleteAllUserData({});
            dataDeleted = true;

            posthog.capture('account_deleted');
            posthog.reset();
            await user?.delete();
            // Clerk's delete ends the session, so the root layout routes back to auth.
        } catch (error) {
            console.error('Account deletion failed:', error);
            reportError(error, { step: dataDeleted ? 'clerk-delete' : 'convex-delete' });
            setIsDeletingAccount(false);

            alertDialog(
                'Deletion failed',
                dataDeleted
                    ? 'Your subscriptions and settings have been erased, but we couldn’t close your Lumora account itself. Your data is gone and will not come back. Please try again to finish closing the account, or contact support.'
                    : 'We couldn’t erase your data, so nothing was deleted and your account is unchanged. Please try again, or contact support if it keeps failing.',
            );
        }
    };

    const handleInvite = async () => {
        const result = await shareLumora(reclaimedYearly, currency);
        posthog.capture('invite_shared', {
            result,
            source: 'settings',
            reclaimed_yearly: reclaimedYearly,
        });
        if (result === 'failed') {
            alertDialog(
                'Couldn’t open sharing',
                'Your device didn’t open the share sheet. Please try again.',
            );
        }
    };

    const handleThemeChange = (preference: ThemePreference) => {
        updateSettings({ themePreference: preference }).catch((error) => {
            console.error('Update theme failed:', error);
            alertDialog('Settings not saved', RETRY_WHEN_LOADED);
        });
        posthog.capture('theme_changed', { theme: preference });
    };

    const handleCurrencyChange = (code: string) => {
        updateSettings({ currency: code }).catch((error) => {
            console.error('Update currency failed:', error);
            alertDialog('Settings not saved', RETRY_WHEN_LOADED);
        });
        posthog.capture('currency_changed', { currency: code });
    };

    const handleToggleWeeklyDigest = (enabled: boolean) => {
        updateSettings({ weeklyDigestEnabled: enabled }).catch((error) => {
            console.error('Update weekly digest setting failed:', error);
            alertDialog('Settings not saved', RETRY_WHEN_LOADED);
        });
        posthog.capture('weekly_digest_toggled', { enabled });
    };

    const handleToggleTrialAlerts = (enabled: boolean) => {
        updateSettings({ trialAlertsEnabled: enabled }).catch((error) => {
            console.error('Update trial alert setting failed:', error);
            alertDialog('Settings not saved', RETRY_WHEN_LOADED);
        });
        posthog.capture('trial_alerts_toggled', { enabled });
    };

    const handleToggleNotifications = async (enabled: boolean) => {
        if (enabled) {
            // Distinguish "this build can't do it" from "you denied permission" — telling
            // an Expo Go user to check their device settings sends them nowhere useful.
            if (!areNotificationsSupported) {
                alertDialog(
                    'Reminders unavailable here',
                    notificationsUnsupportedReason ?? 'Reminders aren’t available in this build.',
                );
                return;
            }

            const granted = await ensureNotificationPermission();
            if (!granted) {
                alertDialog(
                    'Notifications blocked',
                    'Enable notifications for Lumora in your device settings to get renewal reminders.',
                );
                return;
            }
        }
        updateSettings({ notificationsEnabled: enabled }).catch((error) => {
            console.error('Update notification setting failed:', error);
            alertDialog('Settings not saved', RETRY_WHEN_LOADED);
        });
        posthog.capture('notifications_toggled', { enabled });
    };

    const displayName = useDisplayName();
    const email = user?.emailAddresses[0]?.emailAddress;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1 p-5"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: getTabBarContentInset(insets.bottom) }}
            >
                <Text className="text-3xl font-sans-bold text-primary mb-6">Settings</Text>

                {/* User Profile Section */}
                <View className="auth-card mb-5">
                    <View className="flex-row items-center gap-4 mb-4">
                        <Image
                            source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                            className="size-16 rounded-full"
                        />
                        <View className="flex-1">
                            <Text className="text-lg font-sans-bold text-primary">
                                {displayName}
                            </Text>
                            {email && (
                                <Text className="text-sm font-sans-medium text-muted-foreground">
                                    {email}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Account Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-3">Account</Text>
                    <View className="gap-2">
                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-sm font-sans-medium text-muted-foreground">
                                Account ID
                            </Text>
                            <Text
                                className="text-sm font-sans-medium text-primary"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {user?.id?.substring(0, 20)}...
                            </Text>
                        </View>
                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-sm font-sans-medium text-muted-foreground">
                                Joined
                            </Text>
                            <Text className="text-sm font-sans-medium text-primary">
                                {user?.createdAt
                                    ? new Date(user.createdAt).toLocaleDateString()
                                    : 'N/A'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Plan Section */}
                <View className="auth-card mb-5">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-base font-sans-semibold text-primary">Plan</Text>
                            <Text className="text-sm font-sans-medium text-muted-foreground">
                                {isPro ? 'Lumora Pro' : 'Free plan'}
                            </Text>
                        </View>
                        {!isPro && (
                            <Pressable
                                className="rounded-full bg-accent px-4 py-2"
                                onPress={() => router.push('/paywall')}
                                accessibilityRole="button"
                                accessibilityLabel="Upgrade to Pro"
                            >
                                <Text className="text-sm font-sans-bold text-primary">Upgrade</Text>
                            </Pressable>
                        )}
                    </View>

                    {isPurchasesConfigured && (
                        <Pressable
                            className="mt-4"
                            onPress={handleRestore}
                            disabled={isRestoring}
                            accessibilityRole="button"
                            accessibilityLabel="Restore purchases"
                        >
                            <Text className="text-sm font-sans-semibold text-accent">
                                {isRestoring ? 'Restoring...' : 'Restore Purchases'}
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Notifications Section */}
                <View className="auth-card mb-5 gap-4">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                            <Text className="text-base font-sans-semibold text-primary">
                                Renewal Reminders
                            </Text>
                            <Text className="text-sm font-sans-medium text-muted-foreground">
                                Get notified before a subscription renews.
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: themeColors.muted, true: themeColors.accent }}
                            accessibilityLabel="Toggle renewal reminders"
                        />
                    </View>

                    {notificationsEnabled && (
                        <View className="flex-row items-center justify-between border-t border-border pt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-base font-sans-semibold text-primary">
                                    Free Trial Alerts
                                </Text>
                                <Text className="text-sm font-sans-medium text-muted-foreground">
                                    Warn me before a trial converts to a paid plan.
                                </Text>
                            </View>
                            <Switch
                                value={trialAlertsEnabled}
                                onValueChange={handleToggleTrialAlerts}
                                trackColor={{ false: themeColors.muted, true: themeColors.accent }}
                                accessibilityLabel="Toggle free trial alerts"
                            />
                        </View>
                    )}

                    {notificationsEnabled && (
                        <View className="flex-row items-center justify-between border-t border-border pt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-base font-sans-semibold text-primary">
                                    Weekly Digest
                                </Text>
                                <Text className="text-sm font-sans-medium text-muted-foreground">
                                    One Sunday summary of the week ahead.
                                </Text>
                            </View>
                            <Switch
                                value={weeklyDigestEnabled}
                                onValueChange={handleToggleWeeklyDigest}
                                trackColor={{ false: themeColors.muted, true: themeColors.accent }}
                                accessibilityLabel="Toggle weekly digest"
                            />
                        </View>
                    )}

                    {notificationsEnabled && (
                        <View className="gap-2 border-t border-border pt-4">
                            <Text className="text-sm font-sans-semibold text-primary">
                                Remind me before a renewal
                            </Text>
                            <View className="flex-row gap-2">
                                {REMINDER_OPTIONS.map((days) => (
                                    <Pressable
                                        key={days}
                                        className={clsx(
                                            'flex-1 items-center rounded-2xl border border-border py-2',
                                            reminderDaysBefore === days &&
                                                'border-accent bg-accent/10',
                                        )}
                                        onPress={() =>
                                            updateSettings({ reminderDaysBefore: days }).catch(
                                                (error) => {
                                                    console.error(
                                                        'Update reminder setting failed:',
                                                        error,
                                                    );
                                                    alertDialog(
                                                        'Settings not saved',
                                                        RETRY_WHEN_LOADED,
                                                    );
                                                },
                                            )
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remind me ${days} days before renewal`}
                                    >
                                        <Text
                                            className={clsx(
                                                'text-sm font-sans-semibold text-muted-foreground',
                                                reminderDaysBefore === days && 'text-accent',
                                            )}
                                        >
                                            {days}d before
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Appearance Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-1">
                        Appearance
                    </Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground mb-3">
                        Follow your device, or pin Lumora to light or dark.
                    </Text>
                    <View className="flex-row gap-2">
                        {THEME_OPTIONS.map((option) => (
                            <Pressable
                                key={option.value}
                                className={clsx(
                                    'flex-1 items-center rounded-2xl border border-border py-3',
                                    themePreference === option.value &&
                                        'border-accent bg-accent/10',
                                )}
                                onPress={() => handleThemeChange(option.value)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: themePreference === option.value }}
                                accessibilityLabel={`${option.label} theme`}
                            >
                                <Text
                                    className={clsx(
                                        'text-sm font-sans-semibold text-muted-foreground',
                                        themePreference === option.value && 'text-accent',
                                    )}
                                >
                                    {option.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Currency Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-1">Currency</Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground mb-3">
                        Used for new subscriptions. Existing ones keep the currency they were saved
                        with.
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                    >
                        {SUPPORTED_CURRENCIES.map((option) => (
                            <Pressable
                                key={option.code}
                                className={clsx(
                                    'category-chip',
                                    currency === option.code && 'category-chip-active',
                                )}
                                onPress={() => handleCurrencyChange(option.code)}
                                accessibilityRole="button"
                                accessibilityLabel={option.name}
                            >
                                <Text
                                    className={clsx(
                                        'category-chip-text',
                                        currency === option.code && 'category-chip-text-active',
                                    )}
                                >
                                    {option.symbol} {option.code}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Invite Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-1">
                        Share Lumora
                    </Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground mb-3">
                        {reclaimedYearly > 0
                            ? 'Pass on what you’ve saved — most people have a forgotten subscription.'
                            : 'Know someone paying for something they forgot about?'}
                    </Text>
                    <Pressable
                        className="auth-secondary-button"
                        onPress={handleInvite}
                        accessibilityRole="button"
                        accessibilityLabel="Share Lumora with a friend"
                    >
                        <Text className="auth-secondary-button-text">Invite a friend</Text>
                    </Pressable>
                </View>

                {/* Data Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-1">
                        Your data
                    </Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground mb-3">
                        Bring a list in from another tracker, or download everything you&apos;ve
                        tracked — yours to keep, no lock-in.
                    </Text>
                    <Pressable
                        className="auth-secondary-button mb-2"
                        onPress={() => router.push('/import')}
                        accessibilityRole="button"
                        accessibilityLabel="Import subscriptions from CSV"
                    >
                        <Text className="auth-secondary-button-text">Import from CSV</Text>
                    </Pressable>
                    <Pressable
                        className="auth-secondary-button"
                        onPress={handleExport}
                        disabled={isExporting}
                        accessibilityRole="button"
                        accessibilityLabel="Export subscriptions as CSV"
                    >
                        <Text className="auth-secondary-button-text">
                            {isExporting
                                ? 'Preparing export...'
                                : isPro
                                  ? 'Export as CSV'
                                  : 'Export as CSV (Pro)'}
                        </Text>
                    </Pressable>
                </View>

                {/* Legal Section */}
                <View className="auth-card mb-5 gap-1">
                    <Pressable
                        className="py-2"
                        onPress={() => router.push('/help')}
                        accessibilityRole="button"
                        accessibilityLabel="Help and FAQ"
                    >
                        <Text className="text-sm font-sans-semibold text-primary">
                            Help &amp; FAQ
                        </Text>
                    </Pressable>
                    <Pressable
                        className="py-2"
                        onPress={() => router.push('/legal/privacy')}
                        accessibilityRole="button"
                        accessibilityLabel="Privacy Policy"
                    >
                        <Text className="text-sm font-sans-semibold text-primary">
                            Privacy Policy
                        </Text>
                    </Pressable>
                    <Pressable
                        className="py-2"
                        onPress={() => router.push('/legal/terms')}
                        accessibilityRole="button"
                        accessibilityLabel="Terms of Use"
                    >
                        <Text className="text-sm font-sans-semibold text-primary">
                            Terms of Use
                        </Text>
                    </Pressable>
                </View>

                {/* Danger Zone */}
                <View className="auth-card mb-5 gap-3 border-destructive/30">
                    <Text className="text-base font-sans-semibold text-primary">
                        Delete account
                    </Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground">
                        Erases every subscription, setting and history entry, then closes your
                        account. There is no undo, and no copy kept on our side.
                    </Text>
                    <Pressable
                        className="auth-secondary-button border-destructive/30 bg-destructive/10"
                        onPress={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        accessibilityRole="button"
                        accessibilityLabel="Delete account and all data"
                    >
                        <Text className="auth-secondary-button-text text-destructive">
                            {isDeletingAccount ? 'Deleting…' : 'Delete account and all data'}
                        </Text>
                    </Pressable>
                </View>

                {/* Sign Out Button */}
                <Pressable className="auth-button bg-destructive" onPress={handleSignOut}>
                    <Text className="auth-button-text text-white">Sign Out</Text>
                </Pressable>

                {Application.nativeApplicationVersion && (
                    <Text className="mt-5 text-center text-xs font-sans-medium text-muted-foreground">
                        Lumora v{Application.nativeApplicationVersion} (
                        {Application.nativeBuildVersion})
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;
