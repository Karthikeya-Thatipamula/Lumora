import { alertDialog } from '@/lib/dialogs';
import { SafeAreaView } from '@/components/SafeAreaView';
import { safeBack } from '@/lib/navigation';
import { isPurchasesConfigured } from '@/lib/purchases';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { Pressable, Text } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function Paywall() {
    const router = useRouter();
    const posthog = usePostHog();

    if (!isPurchasesConfigured) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
                <Text style={{ fontSize: 40 }}>🚧</Text>
                <Text className="text-center text-lg font-sans-bold text-primary">
                    Pro isn&apos;t set up yet
                </Text>
                <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                    This build doesn&apos;t have RevenueCat configured, so there&apos;s nothing to
                    purchase yet.
                </Text>
                <Pressable
                    className="auth-button px-8"
                    onPress={() => safeBack(router)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                >
                    <Text className="auth-button-text">Close</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <RevenueCatUI.Paywall
            onDismiss={() => safeBack(router)}
            onPurchaseCompleted={() => {
                posthog.capture('pro_purchase_completed');
                safeBack(router);
            }}
            onRestoreCompleted={({ customerInfo }) => {
                const restoredSomething = Object.keys(customerInfo.entitlements.active).length > 0;
                posthog.capture('pro_restore_completed', {
                    has_entitlements: restoredSomething,
                });

                // Dismissing unconditionally sent a user with nothing to restore straight
                // back to a still-locked screen, with no explanation of what happened.
                if (restoredSomething) {
                    safeBack(router);
                    return;
                }
                alertDialog(
                    'Nothing to restore',
                    'We couldn’t find a previous purchase on this account. If you bought Pro with a different account, sign in with that one and try again.',
                );
            }}
        />
    );
}
