import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface SpendSummaryCardProps {
    monthlyTotal: number;
    yearlyTotal: number;
    activeCount: number;
}

const SpendSummaryCard = ({ monthlyTotal, yearlyTotal, activeCount }: SpendSummaryCardProps) => {
    return (
        <View className="home-balance-card">
            <Text className="home-balance-label">Monthly Spend</Text>
            <View className="home-balance-row">
                <Text className="home-balance-amount">{formatCurrency(monthlyTotal)}</Text>
                <Text className="home-balance-date">{activeCount} active</Text>
            </View>
            <Text className="text-base font-sans-medium text-white/80">
                {formatCurrency(yearlyTotal)} / year
            </Text>
        </View>
    );
};

export default SpendSummaryCard;
