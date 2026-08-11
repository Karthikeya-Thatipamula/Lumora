import { SafeAreaView } from '@/components/SafeAreaView';
import { safeBack } from '@/lib/navigation';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

export default function NotFound() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
            <Text style={{ fontSize: 40 }}>🧭</Text>
            <Text className="text-center text-lg font-sans-bold text-primary">This page doesn&apos;t exist</Text>
            <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                The link you followed may be broken or the page may have been moved.
            </Text>
            <Pressable
                className="auth-button px-8"
                onPress={() => safeBack(router, '/(tabs)')}
                accessibilityRole="button"
                accessibilityLabel="Go to home"
            >
                <Text className="auth-button-text">Back to Lumora</Text>
            </Pressable>
        </SafeAreaView>
    );
}
