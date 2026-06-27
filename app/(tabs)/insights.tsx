import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Insights = () => {
    const posthog = usePostHog();

    useEffect(() => {
        posthog.capture('insights_screen_viewed', {
            timestamp: new Date().toISOString(),
        });
        console.info('[Analytics] Insights screen viewed');
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-background p-5">
            <Text className="text-3xl font-sans-bold text-primary mb-4">Insights</Text>
            <Text className="text-sm font-sans-medium text-muted-foreground">
                Analytics and insights coming soon...
            </Text>
        </SafeAreaView>
    )
}
export default Insights