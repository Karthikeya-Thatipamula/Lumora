import { ForecastEntry } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { useThemeColors } from '@/lib/useThemeColors';
import { BarChart } from 'react-native-gifted-charts';
import { Text, View } from 'react-native';

interface ForecastChartProps {
    forecast: ForecastEntry[];
}

const ForecastChart = ({ forecast }: ForecastChartProps) => {
    const themeColors = useThemeColors();
    const maxAmount = Math.max(...forecast.map((f) => f.amount), 1);

    const barData = forecast.map((entry) => ({
        value: entry.amount,
        label: entry.label,
        frontColor: themeColors.accent,
    }));

    return (
        <View className="auth-card gap-4">
            <Text className="text-base font-sans-semibold text-primary">Next 6 Months</Text>
            <BarChart
                data={barData}
                barWidth={22}
                spacing={20}
                roundedTop
                barBorderRadius={6}
                noOfSections={4}
                maxValue={maxAmount * 1.2}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={{ color: themeColors.mutedForeground, fontSize: 11 }}
                yAxisTextStyle={{ color: themeColors.mutedForeground, fontSize: 10 }}
                yAxisLabelWidth={40}
                formatYLabel={(v: string) => formatCurrency(Number(v)).replace('.00', '')}
                isAnimated
            />
            <Text className="text-xs font-sans-medium text-muted-foreground">
                Projected at today&apos;s active subscriptions — doesn&apos;t yet account for cancellations or new sign-ups.
            </Text>
        </View>
    );
};

export default ForecastChart;
