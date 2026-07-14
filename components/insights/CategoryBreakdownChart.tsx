import { CATEGORY_COLORS } from '@/components/CreateSubscriptionModal';
import { getAvatarColor } from '@/lib/icon-resolver';
import { CategoryBreakdownEntry } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { useThemeColors } from '@/lib/useThemeColors';
import { PieChart } from 'react-native-gifted-charts';
import { Text, View } from 'react-native';

interface CategoryBreakdownChartProps {
    breakdown: CategoryBreakdownEntry[];
}

function colorFor(category: string): string {
    return (CATEGORY_COLORS as Record<string, string>)[category] ?? getAvatarColor(category);
}

const CategoryBreakdownChart = ({ breakdown }: CategoryBreakdownChartProps) => {
    const themeColors = useThemeColors();

    if (breakdown.length === 0) {
        return (
            <View className="auth-card items-center py-8">
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Add an active subscription to see your spend by category.
                </Text>
            </View>
        );
    }

    const pieData = breakdown.map((entry) => ({
        value: entry.monthlyTotal,
        color: colorFor(entry.category),
        text: entry.percentage >= 8 ? `${Math.round(entry.percentage)}%` : '',
    }));

    return (
        <View className="auth-card items-center gap-5">
            <PieChart
                data={pieData}
                donut
                radius={90}
                innerRadius={58}
                innerCircleColor={themeColors.card}
                showText
                textColor={themeColors.primary}
                textSize={12}
                fontWeight="700"
                centerLabelComponent={() => (
                    <View className="items-center">
                        <Text className="text-xs font-sans-semibold text-muted-foreground">Monthly</Text>
                        <Text className="text-lg font-sans-extrabold text-primary">
                            {formatCurrency(breakdown.reduce((sum, e) => sum + e.monthlyTotal, 0))}
                        </Text>
                    </View>
                )}
            />

            <View className="w-full gap-3">
                {breakdown.map((entry) => (
                    <View key={entry.category} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                            <View className="size-3 rounded-full" style={{ backgroundColor: colorFor(entry.category) }} />
                            <Text className="text-sm font-sans-semibold text-primary">{entry.category}</Text>
                            <Text className="text-xs font-sans-medium text-muted-foreground">({entry.count})</Text>
                        </View>
                        <Text className="text-sm font-sans-bold text-primary">{formatCurrency(entry.monthlyTotal)}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

export default CategoryBreakdownChart;
