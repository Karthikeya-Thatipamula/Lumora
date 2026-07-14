import { safeBack } from '@/lib/navigation';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Terms = () => {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center justify-between px-5 py-4">
                <Pressable onPress={() => safeBack(router, '/(tabs)/settings')} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
                    <Text className="text-2xl text-primary">‹</Text>
                </Pressable>
                <Text className="text-lg font-sans-bold text-primary">Terms of Use</Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                <Text className="text-xs font-sans-medium text-muted-foreground">
                    This is placeholder terms text for development. Replace it with counsel-reviewed
                    copy before publishing to the App Store or Play Store.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Using Lumora</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Lumora helps you track recurring subscriptions and get renewal reminders. It does
                    not initiate, cancel, or modify charges on your behalf with any third-party service
                    — all subscription data is self-reported by you.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Lumora Pro</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Pro is an auto-renewing subscription billed through the App Store or Play Store.
                    Manage or cancel it anytime from your device&apos;s subscription settings. Refunds are
                    handled by Apple/Google per their policies.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Accuracy</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Spending insights, forecasts, and reminders are estimates based on the data you
                    provide and may not match your actual bank or card charges.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Termination</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    You may stop using Lumora and delete your account at any time. We may suspend
                    accounts that abuse the service.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Terms;
