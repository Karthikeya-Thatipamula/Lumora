import GlowCard from '@/components/motion/GlowCard';
import PressableScale from '@/components/motion/PressableScale';
import SubscriptionAvatar from '@/components/SubscriptionAvatar';
import { personalPrice, TrialEntry } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import { Text, View } from 'react-native';

interface TrialAlertCardProps {
    trials: TrialEntry[];
    onPressTrial: (subscriptionId: string) => void;
}

function urgencyCopy(daysUntilCharge: number): string {
    if (daysUntilCharge === 0) return 'Charges today';
    if (daysUntilCharge === 1) return 'Charges tomorrow';
    return `Charges in ${daysUntilCharge} days`;
}

/**
 * The highest-stakes surface in the app: the window where cancelling still costs
 * the user nothing. Kept at the top of Home whenever a trial is close to converting.
 */
const TrialAlertCard = ({ trials, onPressTrial }: TrialAlertCardProps) => {
    if (trials.length === 0) return null;

    const totalIfKept = trials.reduce(
        (sum, { subscription }) => sum + personalPrice(subscription),
        0,
    );
    const currencies = new Set(trials.map(({ subscription }) => subscription.currency ?? 'USD'));

    // Only pulse while a charge is genuinely imminent — a permanent glow is just noise.
    const isUrgent = trials.some((entry) => entry.daysUntilCharge <= 2);

    return (
        <GlowCard
            active={isUrgent}
            className="mb-5 rounded-3xl border border-accent/40 bg-accent/10 p-4"
        >
            <View className="mb-3 flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                    <Text className="text-lg font-sans-bold text-accent">
                        {trials.length === 1
                            ? 'Free trial ending'
                            : `${trials.length} trials ending`}
                    </Text>
                    <Text className="mt-0.5 text-sm font-sans-medium text-muted-foreground">
                        Cancel before the charge lands and it stays free
                    </Text>
                </View>
                {currencies.size === 1 && (
                    <View className="rounded-2xl bg-accent px-3 py-2">
                        <Text className="text-sm font-sans-bold text-white">
                            {formatCurrency(totalIfKept, trials[0].subscription.currency)}
                        </Text>
                    </View>
                )}
            </View>

            <View className="gap-2">
                {trials.map((entry) => (
                    <PressableScale
                        key={entry.subscription.id}
                        className="flex-row items-center gap-3 rounded-2xl bg-background p-3"
                        onPress={() => onPressTrial(entry.subscription.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage ${entry.subscription.name} trial, ${urgencyCopy(entry.daysUntilCharge).toLowerCase()}`}
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
                            <Text className="mt-0.5 text-xs font-sans-semibold text-accent">
                                {urgencyCopy(entry.daysUntilCharge)} ·{' '}
                                {dayjs(entry.endsAt).format('MMM D')}
                            </Text>
                        </View>
                        <Text className="text-sm font-sans-bold text-primary">
                            {formatCurrency(
                                personalPrice(entry.subscription),
                                entry.subscription.currency,
                            )}
                        </Text>
                    </PressableScale>
                ))}
            </View>
        </GlowCard>
    );
};

export default TrialAlertCard;
