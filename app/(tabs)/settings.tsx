import images from '@/constants/images';
import { alertDialog } from '@/lib/dialogs';
import { ensureNotificationPermission } from '@/lib/notifications';
import { isPurchasesConfigured } from '@/lib/purchases';
import { useProStatus } from '@/lib/useProStatus';
import { useUserSettings } from '@/lib/useUserSettings';
import { useClerk, useUser } from '@clerk/expo';
import clsx from 'clsx';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);
const REMINDER_OPTIONS = [1, 3, 7];

const Settings = () => {
    const { signOut } = useClerk();
    const { user } = useUser();
    const posthog = usePostHog();
    const router = useRouter();
    const { isPro } = useProStatus();
    const { notificationsEnabled, reminderDaysBefore, updateSettings } = useUserSettings();
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        posthog.capture('settings_screen_viewed', {
            timestamp: new Date().toISOString(),
        });
        console.info('[Analytics] Settings screen viewed');
    }, []);

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
            console.info('[Analytics] User signed out successfully');
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

    const handleToggleNotifications = async (enabled: boolean) => {
        if (enabled) {
            const granted = await ensureNotificationPermission();
            if (!granted) {
                alertDialog('Notifications blocked', 'Enable notifications for Lumora in your device settings to get renewal reminders.');
                return;
            }
        }
        updateSettings({ notificationsEnabled: enabled });
        posthog.capture('notifications_toggled', { enabled });
    };

    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';
    const email = user?.emailAddresses[0]?.emailAddress;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text className="text-3xl font-sans-bold text-primary mb-6">Settings</Text>

                {/* User Profile Section */}
                <View className="auth-card mb-5">
                    <View className="flex-row items-center gap-4 mb-4">
                        <Image
                            source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                            className="size-16 rounded-full"
                        />
                        <View className="flex-1">
                            <Text className="text-lg font-sans-bold text-primary">{displayName}</Text>
                            {email && (
                                <Text className="text-sm font-sans-medium text-muted-foreground">{email}</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Account Section */}
                <View className="auth-card mb-5">
                    <Text className="text-base font-sans-semibold text-primary mb-3">Account</Text>
                    <View className="gap-2">
                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-sm font-sans-medium text-muted-foreground">Account ID</Text>
                            <Text className="text-sm font-sans-medium text-primary" numberOfLines={1} ellipsizeMode="tail">
                                {user?.id?.substring(0, 20)}...
                            </Text>
                        </View>
                        <View className="flex-row justify-between items-center py-2">
                            <Text className="text-sm font-sans-medium text-muted-foreground">Joined</Text>
                            <Text className="text-sm font-sans-medium text-primary">
                                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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
                        <Pressable className="mt-4" onPress={handleRestore} disabled={isRestoring} accessibilityRole="button" accessibilityLabel="Restore purchases">
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
                            <Text className="text-base font-sans-semibold text-primary">Renewal Reminders</Text>
                            <Text className="text-sm font-sans-medium text-muted-foreground">
                                Get notified before a subscription renews.
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: '#d4d4d4', true: '#ea7a53' }}
                            accessibilityLabel="Toggle renewal reminders"
                        />
                    </View>

                    {notificationsEnabled && (
                        <View className="flex-row gap-2">
                            {REMINDER_OPTIONS.map((days) => (
                                <Pressable
                                    key={days}
                                    className={clsx('flex-1 items-center rounded-2xl border border-border py-2', reminderDaysBefore === days && 'border-accent bg-accent/10')}
                                    onPress={() => updateSettings({ reminderDaysBefore: days })}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remind me ${days} days before renewal`}
                                >
                                    <Text className={clsx('text-sm font-sans-semibold text-muted-foreground', reminderDaysBefore === days && 'text-accent')}>
                                        {days}d before
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>

                {/* Legal Section */}
                <View className="auth-card mb-5 gap-1">
                    <Pressable className="py-2" onPress={() => router.push('/legal/privacy')} accessibilityRole="button" accessibilityLabel="Privacy Policy">
                        <Text className="text-sm font-sans-semibold text-primary">Privacy Policy</Text>
                    </Pressable>
                    <Pressable className="py-2" onPress={() => router.push('/legal/terms')} accessibilityRole="button" accessibilityLabel="Terms of Use">
                        <Text className="text-sm font-sans-semibold text-primary">Terms of Use</Text>
                    </Pressable>
                </View>

                {/* Sign Out Button */}
                <Pressable
                    className="auth-button bg-destructive"
                    onPress={handleSignOut}
                >
                    <Text className="auth-button-text text-white">Sign Out</Text>
                </Pressable>

                {Application.nativeApplicationVersion && (
                    <Text className="mt-5 text-center text-xs font-sans-medium text-muted-foreground">
                        Lumora v{Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

export default Settings