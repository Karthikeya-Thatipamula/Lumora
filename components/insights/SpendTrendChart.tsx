import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import { SpendHistoryPoint } from '@/lib/insights';
import { useThemeColors } from '@/lib/useThemeColors';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

interface SpendTrendChartProps {
    history: SpendHistoryPoint[];
    /** Percentage change across the window, or null when there's no baseline. */
    trend: number | null;
    currency?: string;
}

const SpendTrendChart = ({ history, trend, currency }: SpendTrendChartProps) => {
    const themeColors = useThemeColors();

    const maxAmount = Math.max(...history.map((point) => point.amount), 1);
    const chartData = history.map((point) => ({
        value: point.amount,
        label: point.label,
        dataPointText: '',
    }));

    const trendUp = trend !== null && trend > 0;
    const hasMovement = trend !== null && Math.abs(trend) >= 1;

    return (
        <View className="auth-card gap-4">
            <LabelWithInfo
                title="Spend over time"
                info="Reconstructed from when each subscription started, when you paused or cancelled it, and its price history. Months before you started tracking will read low."
            />

            {hasMovement && (
                <Text
                    className="text-sm font-sans-semibold"
                    style={{ color: trendUp ? themeColors.destructive : themeColors.success }}
                >
                    {trendUp ? '▲' : '▼'} {Math.abs(trend).toFixed(0)}% vs {history[0].label}
                </Text>
            )}

            <LineChart
                data={chartData}
                areaChart
                curved
                hideDataPoints={false}
                dataPointsColor={themeColors.accent}
                color={themeColors.accent}
                startFillColor={themeColors.accent}
                endFillColor={themeColors.accent}
                startOpacity={0.35}
                endOpacity={0.02}
                thickness={2.5}
                noOfSections={4}
                maxValue={maxAmount * 1.25}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={{ color: themeColors.mutedForeground, fontSize: 11 }}
                yAxisTextStyle={{ color: themeColors.mutedForeground, fontSize: 10 }}
                yAxisLabelWidth={44}
                formatYLabel={(value: string) => formatCurrency(Number(value), currency).replace('.00', '')}
                initialSpacing={12}
                isAnimated
            />

            <Text className="text-xs font-sans-medium text-muted-foreground">
                Based on your own history — not a forecast.
            </Text>
        </View>
    );
};

export default SpendTrendChart;
