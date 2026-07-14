import { isPurchasesConfigured } from '@/lib/purchases';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';

export default function Paywall() {
    const router = useRouter();
    const posthog = usePostHog();

    if (!isPurchasesConfigured) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
                <Text style={{ fontSize: 40 }}>🚧</Text>
                <Text className="text-center text-lg font-sans-bold text-primary">Pro isn&apos;t set up yet</Text>
                <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                    This build doesn&apos;t have RevenueCat configured, so there&apos;s nothing to purchase yet.
                </Text>
                <Pressable className="auth-button px-8" onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
                    <Text className="auth-button-text">Close</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <RevenueCatUI.Paywall
            onDismiss={() => router.back()}
            onPurchaseCompleted={() => {
                posthog.capture('pro_purchase_completed');
                router.back();
            }}
            onRestoreCompleted={({ customerInfo }) => {
                posthog.capture('pro_restore_completed', { has_entitlements: Object.keys(customerInfo.entitlements.active).length > 0 });
                router.back();
            }}
        />
    );
}
