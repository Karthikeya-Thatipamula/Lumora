import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Privacy = () => {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center justify-between px-5 py-4">
                <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
                    <Text className="text-2xl text-primary">‹</Text>
                </Pressable>
                <Text className="text-lg font-sans-bold text-primary">Privacy Policy</Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                <Text className="text-xs font-sans-medium text-muted-foreground">
                    This is placeholder policy text for development. Replace it with counsel-reviewed
                    copy that accurately reflects Lumora&apos;s data practices before publishing to the
                    App Store or Play Store.
                </Text>

                <Text className="text-base font-sans-bold text-primary">What we collect</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Account details (name, email, profile photo) via Clerk; the subscription data you
                    enter (name, price, billing cadence, category); and product usage analytics via
                    PostHog to help us understand which features are useful.
                </Text>

                <Text className="text-base font-sans-bold text-primary">How we use it</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    To sync your subscriptions across devices, send renewal reminders you&apos;ve opted
                    into, process Pro purchases through the App Store/Play Store, and improve the app.
                    We do not sell your data.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Third parties</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Clerk (authentication), Convex (data storage), PostHog (analytics), and RevenueCat
                    (subscription billing) process data on our behalf under their own privacy terms.
                </Text>

                <Text className="text-base font-sans-bold text-primary">Your choices</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    You can edit or delete any subscription you&apos;ve added, turn off notifications in
                    Settings, and request account deletion by contacting support.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Privacy;
