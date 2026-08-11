import { SafeAreaView } from '@/components/SafeAreaView';
import { isMissingConvexFunctionError } from '@/lib/convexErrors';
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

/**
 * Last line of defence for a rendering crash. Without one, a throw inside a screen
 * unmounts the tree and leaves a blank page with no way back — which is exactly the
 * failure mode this app already hit once.
 */
export default function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const isBackendMissing = isMissingConvexFunctionError(error);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    padding: 24,
                    gap: 16,
                }}
            >
                <Text style={{ fontSize: 40 }}>{isBackendMissing ? '🔌' : '⚠️'}</Text>

                <Text className="text-2xl font-sans-bold text-primary">
                    {isBackendMissing ? 'Backend not deployed' : 'Something went wrong'}
                </Text>

                <Text className="text-sm font-sans-medium text-muted-foreground">
                    {isBackendMissing
                        ? 'This screen needs Convex functions that aren’t deployed yet. Run `npx convex dev` in a second terminal, then retry.'
                        : 'This screen hit an unexpected error. Your data is safe — retrying usually clears it.'}
                </Text>

                <View className="rounded-2xl border border-border bg-card p-4">
                    <Text className="text-xs font-sans-medium text-muted-foreground" selectable>
                        {error.message || 'Unknown error'}
                    </Text>
                </View>

                <Pressable
                    className="auth-button"
                    onPress={retry}
                    accessibilityRole="button"
                    accessibilityLabel="Try again"
                >
                    <Text className="auth-button-text">Try Again</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
