import { alertDialog } from '@/lib/dialogs';
import { CategoryBreakdownEntry } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import * as Sharing from 'expo-sharing';
import { usePostHog } from 'posthog-react-native';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

interface WrappedCardProps {
    yearlyTotal: number;
    activeCount: number;
    topCategory: CategoryBreakdownEntry | null;
    mostExpensive: Subscription | null;
}

const WrappedCard = ({ yearlyTotal, activeCount, topCategory, mostExpensive }: WrappedCardProps) => {
    const shotRef = useRef<ViewShot>(null);
    const [isSharing, setIsSharing] = useState(false);
    const posthog = usePostHog();
    const year = new Date().getFullYear();

    const handleShare = async () => {
        if (!shotRef.current?.capture) return;
        setIsSharing(true);
        try {
            const uri = await shotRef.current.capture();
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'My Lumora Wrapped' });
                posthog.capture('wrapped_shared', { year, yearly_total: yearlyTotal });
            } else {
                alertDialog('Sharing unavailable', 'Sharing isn’t supported on this device.');
            }
        } catch (error) {
            console.error('Wrapped share failed:', error);
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <View className="auth-card gap-4">
            <Text className="text-base font-sans-semibold text-primary">Your {year} Wrapped</Text>

            <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.95 }}>
                <View className="gap-5 rounded-3xl bg-primary p-6">
                    <Text className="text-sm font-sans-semibold uppercase tracking-[1px] text-white/60">Lumora Wrapped {year}</Text>
                    <View>
                        <Text className="text-4xl font-sans-extrabold text-white">{formatCurrency(yearlyTotal)}</Text>
                        <Text className="text-base font-sans-medium text-white/70">spent across {activeCount} active subscriptions</Text>
                    </View>
                    {topCategory && (
                        <View>
                            <Text className="text-sm font-sans-semibold text-white/60">Top category</Text>
                            <Text className="text-xl font-sans-bold text-white">{topCategory.category}</Text>
                        </View>
                    )}
                    {mostExpensive && (
                        <View>
                            <Text className="text-sm font-sans-semibold text-white/60">Biggest subscription</Text>
                            <Text className="text-xl font-sans-bold text-white">{mostExpensive.name}</Text>
                        </View>
                    )}
                </View>
            </ViewShot>

            <Pressable className="auth-button" onPress={handleShare} disabled={isSharing} accessibilityRole="button" accessibilityLabel="Share your Wrapped recap">
                <Text className="auth-button-text">{isSharing ? 'Preparing...' : 'Share Your Wrapped'}</Text>
            </Pressable>
        </View>
    );
};

export default WrappedCard;
