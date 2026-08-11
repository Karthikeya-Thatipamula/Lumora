import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import { ReclaimedSavings } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import { Text, View } from 'react-native';

interface SavingsCardProps {
    savings: ReclaimedSavings;
    /** Monthly cost that starts if every running trial converts instead of being cancelled. */
    trialCommitment: number;
    /** Monthly amount avoided by splitting shared plans rather than paying each alone. */
    sharingSavings: number;
    currency?: string;
}

/**
 * Proof-of-value surface: turns cancellations into a running total the user can point
 * at. Cheap to compute (derived from cancelled subscriptions) and the single clearest
 * answer to "is this app worth keeping?".
 */
const SavingsCard = ({ savings, trialCommitment, sharingSavings, currency }: SavingsCardProps) => {
    const hasSavings = savings.count > 0;

    return (
        <View className="auth-card gap-4">
            <LabelWithInfo
                title="Money reclaimed"
                info="The annualised total of everything you've cancelled, counted at your share of each plan. Derived from your cancellations, so it updates if you edit your history."
            />

            {hasSavings && savings.since && (
                <Text className="-mt-2 text-xs font-sans-medium text-muted-foreground">
                    since {dayjs(savings.since).format('MMM YYYY')}
                </Text>
            )}

            {hasSavings ? (
                <>
                    <View>
                        <AnimatedNumber
                            className="text-4xl font-sans-extrabold text-success"
                            value={savings.yearly}
                            format={(amount) => formatCurrency(amount, currency)}
                        />
                        <Text className="mt-1 text-sm font-sans-medium text-muted-foreground">
                            a year, from {savings.count} cancelled {savings.count === 1 ? 'subscription' : 'subscriptions'}
                            {' '}({formatCurrency(savings.monthly, currency)}/month)
                        </Text>
                    </View>
                </>
            ) : (
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Cancel a subscription you no longer use and Lumora starts tracking what you save here.
                </Text>
            )}

            {sharingSavings > 0 && (
                <View className="rounded-2xl bg-background p-3">
                    <Text className="text-xs font-sans-semibold text-success">Sharing pays off</Text>
                    <Text className="mt-1 text-sm font-sans-medium text-muted-foreground">
                        Splitting plans saves you another {formatCurrency(sharingSavings, currency)}/month versus paying for each on your own.
                    </Text>
                </View>
            )}

            {trialCommitment > 0 && (
                <View className="rounded-2xl bg-background p-3">
                    <Text className="text-xs font-sans-semibold text-accent">Heads up</Text>
                    <Text className="mt-1 text-sm font-sans-medium text-muted-foreground">
                        {formatCurrency(trialCommitment, currency)}/month starts if you keep every trial you&apos;re running.
                    </Text>
                </View>
            )}
        </View>
    );
};

export default SavingsCard;
