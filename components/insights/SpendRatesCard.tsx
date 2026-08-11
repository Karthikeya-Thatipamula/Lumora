import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import { SpendRates } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface SpendRatesCardProps {
    rates: SpendRates;
    currency?: string;
}

const ROWS: { key: keyof SpendRates; label: string }[] = [
    { key: 'daily', label: 'a day' },
    { key: 'weekly', label: 'a week' },
    { key: 'monthly', label: 'a month' },
    { key: 'yearly', label: 'a year' },
];

/**
 * The same commitment at four cadences. The monthly figure is easy to rationalise; the
 * daily one rarely is, and the yearly one is what makes people cancel something.
 */
const SpendRatesCard = ({ rates, currency }: SpendRatesCardProps) => (
    <View className="auth-card gap-4">
        <LabelWithInfo
            title="What it costs you"
            info="Every active subscription normalised to one figure. Yearly plans are spread across twelve months, shared plans counted at your share, and running free trials excluded until they convert."
        />

        <View className="flex-row flex-wrap">
            {ROWS.map((row) => (
                <View key={row.key} className="w-1/2 py-2">
                    <AnimatedNumber
                        className="text-xl font-sans-extrabold text-primary"
                        value={rates[row.key]}
                        format={(amount) => formatCurrency(amount, currency)}
                    />
                    <Text className="mt-0.5 text-xs font-sans-medium text-muted-foreground">{row.label}</Text>
                </View>
            ))}
        </View>
    </View>
);

export default SpendRatesCard;
