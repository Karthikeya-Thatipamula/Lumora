import SubscriptionAvatar from '@/components/SubscriptionAvatar';
import { personalPrice, RenewalTimelineEntry } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import { Pressable, Text, View } from 'react-native';

interface RenewalTimelineProps {
    entries: RenewalTimelineEntry[];
    onViewAll: () => void;
}

function formatRenewalDate(entry: RenewalTimelineEntry) {
    if (entry.daysUntil === 0) return 'Today';
    if (entry.daysUntil === 1) return 'Tomorrow';
    return dayjs(entry.date).format('MMM D');
}

const RenewalTimeline = ({ entries, onViewAll }: RenewalTimelineProps) => {
    const visibleEntries = entries.slice(0, 3);
    const currencies = new Set(entries.map(({ subscription }) => subscription.currency ?? 'USD'));
    // The user's share is what actually leaves their account on a split plan.
    const totalDue = entries.reduce(
        (sum, { subscription }) => sum + personalPrice(subscription),
        0,
    );
    const dueSummary =
        currencies.size === 1
            ? formatCurrency(totalDue, entries[0]?.subscription.currency)
            : `${entries.length} renewals`;

    return (
        <View className="mb-5 rounded-3xl border border-border bg-card p-4">
            <View className="mb-4 flex-row items-center justify-between gap-3">
                <View>
                    <Text className="text-lg font-sans-bold text-primary">Renewal plan</Text>
                    <Text className="mt-0.5 text-sm font-sans-medium text-muted-foreground">
                        What&apos;s due in the next 30 days
                    </Text>
                </View>
                <View className="rounded-2xl bg-accent/15 px-3 py-2">
                    <Text className="text-sm font-sans-bold text-accent">{dueSummary}</Text>
                </View>
            </View>

            <View className="gap-2">
                {visibleEntries.map((entry) => (
                    <View
                        key={entry.subscription.id}
                        className="flex-row items-center gap-3 rounded-2xl bg-background p-3"
                    >
                        <SubscriptionAvatar
                            name={entry.subscription.name}
                            iconKey={entry.subscription.iconKey}
                            className="size-11 rounded-xl"
                        />
                        <View className="min-w-0 flex-1">
                            <Text className="text-sm font-sans-bold text-primary" numberOfLines={1}>
                                {entry.subscription.name}
                            </Text>
                            <Text className="mt-0.5 text-xs font-sans-medium text-muted-foreground">
                                {formatRenewalDate(entry)} ·{' '}
                                {entry.daysUntil === 0 ? 'due today' : `in ${entry.daysUntil} days`}
                            </Text>
                        </View>
                        <Text className="text-sm font-sans-bold text-primary">
                            {formatCurrency(
                                personalPrice(entry.subscription),
                                entry.subscription.currency,
                            )}
                        </Text>
                    </View>
                ))}
            </View>

            <Pressable
                className="mt-4 self-start"
                onPress={onViewAll}
                accessibilityRole="button"
                accessibilityLabel="View all subscriptions"
            >
                <Text className="text-sm font-sans-bold text-accent">
                    {entries.length > visibleEntries.length
                        ? `View ${entries.length - visibleEntries.length} more renewals`
                        : 'View all subscriptions'}
                </Text>
            </Pressable>
        </View>
    );
};

export default RenewalTimeline;
