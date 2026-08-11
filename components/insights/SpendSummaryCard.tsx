import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface SpendSummaryCardProps {
    monthlyTotal: number;
    yearlyTotal: number;
    activeCount: number;
    /** Of those active, how many are still on a free trial and therefore not billing. */
    trialCount: number;
    currency?: string;
}

const SpendSummaryCard = ({ monthlyTotal, yearlyTotal, activeCount, trialCount, currency }: SpendSummaryCardProps) => {
    // Spelling out the trial split stops "1 active" next to a zero total looking broken.
    const countLabel = trialCount > 0
        ? `${activeCount} active · ${trialCount} on trial`
        : `${activeCount} active`;

    return (
        <View className="home-balance-card">
            <Text className="home-balance-label">Monthly Spend</Text>
            <View className="home-balance-row">
                <AnimatedNumber
                    className="home-balance-amount"
                    value={monthlyTotal}
                    format={(amount) => formatCurrency(amount, currency)}
                />
                <Text className="home-balance-date">{countLabel}</Text>
            </View>
            <Text className="text-base font-sans-medium text-white/80">
                {formatCurrency(yearlyTotal, currency)} / year
            </Text>
        </View>
    );
};

export default SpendSummaryCard;
