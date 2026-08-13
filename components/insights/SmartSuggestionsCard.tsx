import type { Subscription } from '@/lib/subscriptionTypes';
import {
    AnnualUpgradeNudge,
    CostPerUse,
    DuplicateCategoryNudge,
    PriceHikeNudge,
} from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface SmartSuggestionsCardProps {
    duplicateCategories: DuplicateCategoryNudge[];
    stalePaused: Subscription[];
    priceHikes: PriceHikeNudge[];
    annualUpgrades: AnnualUpgradeNudge[];
    /** Active, past their first month, and never once logged as used. */
    unused: Subscription[];
    /** Tracked subscriptions whose cost per use exceeds a whole month of the plan. */
    poorValue: { subscription: Subscription; costPerUse: CostPerUse }[];
    currency?: string;
}

const Suggestion = ({ emoji, text }: { emoji: string; text: string }) => (
    <View className="flex-row items-start gap-3 rounded-2xl bg-background p-4">
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text className="flex-1 text-sm font-sans-medium text-primary">{text}</Text>
    </View>
);

const SmartSuggestionsCard = ({
    duplicateCategories,
    stalePaused,
    priceHikes,
    annualUpgrades,
    unused,
    poorValue,
    currency,
}: SmartSuggestionsCardProps) => {
    // Only the strongest few annual candidates — a wall of them reads as noise.
    const topAnnualUpgrades = annualUpgrades.slice(0, 3);
    const hasSuggestions =
        duplicateCategories.length > 0 ||
        stalePaused.length > 0 ||
        priceHikes.length > 0 ||
        topAnnualUpgrades.length > 0 ||
        unused.length > 0 ||
        poorValue.length > 0;

    return (
        <View className="auth-card gap-3">
            <Text className="text-base font-sans-semibold text-primary">Smart Suggestions</Text>

            {!hasSuggestions && (
                <Suggestion
                    emoji="✨"
                    text="You're all optimized — no duplicate subscriptions, price hikes, or stale pauses right now."
                />
            )}

            {poorValue.slice(0, 3).map(({ subscription, costPerUse }) => (
                <Suggestion
                    key={`value-${subscription.id}`}
                    emoji="🧮"
                    text={`${subscription.name} works out at ${formatCurrency(costPerUse.perUse, subscription.currency ?? currency)} every time you use it — more than a whole month of the plan.`}
                />
            ))}

            {unused.slice(0, 3).map((sub) => (
                <Suggestion
                    key={`unused-${sub.id}`}
                    emoji="💤"
                    text={`You haven't logged a single use of ${sub.name} since you added it. Either start tracking uses, or ask whether it's earning its place.`}
                />
            ))}

            {priceHikes.map((nudge) => (
                <Suggestion
                    key={`hike-${nudge.subscription.id}`}
                    emoji="📈"
                    text={`${nudge.subscription.name} went up from ${formatCurrency(nudge.previousPrice, nudge.subscription.currency)} to ${formatCurrency(nudge.currentPrice, nudge.subscription.currency)}. Worth a second look.`}
                />
            ))}

            {topAnnualUpgrades.map((nudge) => (
                <Suggestion
                    key={`annual-${nudge.subscription.id}`}
                    emoji="🗓️"
                    text={`${nudge.subscription.name} is billed monthly. Annual plans usually run about two months free — that'd be roughly ${formatCurrency(nudge.estimatedSaving, nudge.subscription.currency)} a year. Worth checking their pricing page.`}
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

            {topAnnualUpgrades.length > 0 && (
                <Text className="text-xs font-sans-medium text-muted-foreground">
                    Annual savings are estimates based on typical pricing, not quotes from the
                    provider.
                </Text>
            )}
        </View>
    );
};

export default SmartSuggestionsCard;
