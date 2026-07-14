import { DuplicateCategoryNudge, PriceHikeNudge } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface SmartSuggestionsCardProps {
    duplicateCategories: DuplicateCategoryNudge[];
    stalePaused: Subscription[];
    priceHikes: PriceHikeNudge[];
}

const Suggestion = ({ emoji, text }: { emoji: string; text: string }) => (
    <View className="flex-row items-start gap-3 rounded-2xl bg-background p-4">
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text className="flex-1 text-sm font-sans-medium text-primary">{text}</Text>
    </View>
);

const SmartSuggestionsCard = ({ duplicateCategories, stalePaused, priceHikes }: SmartSuggestionsCardProps) => {
    const hasSuggestions = duplicateCategories.length > 0 || stalePaused.length > 0 || priceHikes.length > 0;

    return (
        <View className="auth-card gap-3">
            <Text className="text-base font-sans-semibold text-primary">Smart Suggestions</Text>

            {!hasSuggestions && (
                <Suggestion emoji="✨" text="You're all optimized — no duplicate subscriptions, price hikes, or stale pauses right now." />
            )}

            {priceHikes.map((nudge) => (
                <Suggestion
                    key={`hike-${nudge.subscription.id}`}
                    emoji="📈"
                    text={`${nudge.subscription.name} went up from ${formatCurrency(nudge.previousPrice, nudge.subscription.currency)} to ${formatCurrency(nudge.currentPrice, nudge.subscription.currency)}. Worth a second look.`}
                />
            ))}

            {duplicateCategories.map((nudge) => (
                <Suggestion
                    key={`dup-${nudge.category}`}
                    emoji="🔁"
                    text={`You have ${nudge.subscriptions.length} ${nudge.category} subscriptions (${nudge.subscriptions.map((s) => s.name).join(', ')}). Consider consolidating.`}
                />
            ))}

            {stalePaused.map((sub) => (
                <Suggestion
                    key={`stale-${sub.id}`}
                    emoji="🧊"
                    text={`${sub.name} has been paused for a while. If you're not going back, cancelling it fully saves you the reminder noise.`}
                />
            ))}
        </View>
    );
};

export default SmartSuggestionsCard;
