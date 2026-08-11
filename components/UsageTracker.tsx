import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import PressableScale from '@/components/motion/PressableScale';
import { CostPerUse } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { Text, View } from 'react-native';

interface UsageTrackerProps {
    usageCount: number;
    costPerUse: CostPerUse | null;
    currency?: string;
    monthlyEquivalent: number;
    onLogUse: () => void;
    onUndo: () => void;
    onReset: () => void;
}

/**
 * Logs how often a subscription actually gets used, and turns that into a cost per use.
 *
 * This is the number that settles the cancel decision. Every tracker can tell you a plan
 * costs £11 a month; none of them tell you that you opened it twice, so each of those
 * times cost £5.50. Manual logging is the honest way to get it without watching what the
 * user does on their device.
 */
const UsageTracker = ({
    usageCount,
    costPerUse,
    currency,
    monthlyEquivalent,
    onLogUse,
    onUndo,
    onReset,
}: UsageTrackerProps) => (
    <View className="auth-card mb-5 gap-3">
        <LabelWithInfo
            title="How often do you use it?"
            info="Tap every time you actually use this. Lumora divides what you've paid since you started counting by the number of uses, so you can see what each one really costs."
            action={
                usageCount > 0 ? (
                    <PressableScale
                        onPress={onReset}
                        accessibilityRole="button"
                        accessibilityLabel="Reset usage count"
                        hitSlop={12}
                    >
                        <Text className="text-xs font-sans-semibold text-muted-foreground">
                            Reset
                        </Text>
                    </PressableScale>
                ) : undefined
            }
        />

        <View className="flex-row items-center gap-3">
            <PressableScale
                className="auth-button mt-0 flex-1"
                onPress={onLogUse}
                accessibilityRole="button"
                accessibilityLabel="Log that you used this"
            >
                <Text className="auth-button-text">I used this</Text>
            </PressableScale>

            {usageCount > 0 && (
                <PressableScale
                    className="rounded-2xl border border-border px-4 py-4"
                    onPress={onUndo}
                    accessibilityRole="button"
                    accessibilityLabel="Undo last logged use"
                >
                    <Text className="text-sm font-sans-semibold text-muted-foreground">Undo</Text>
                </PressableScale>
            )}
        </View>

        {costPerUse ? (
            <View className="gap-1">
                <Text className="text-2xl font-sans-extrabold text-primary">
                    {formatCurrency(costPerUse.perUse, currency)}
                    <Text className="text-sm font-sans-medium text-muted-foreground"> per use</Text>
                </Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    {costPerUse.uses} {costPerUse.uses === 1 ? 'use' : 'uses'} over{' '}
                    {costPerUse.monthsTracked} {costPerUse.monthsTracked === 1 ? 'month' : 'months'}
                    .
                </Text>
                {costPerUse.isPoorValue && (
                    <View className="mt-1 rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                        <Text className="text-xs font-sans-semibold text-destructive">
                            Each use costs more than a whole month of the plan (
                            {formatCurrency(monthlyEquivalent, currency)}). Worth a hard look.
                        </Text>
                    </View>
                )}
            </View>
        ) : (
            <Text className="text-sm font-sans-medium text-muted-foreground">
                No uses logged yet. Start tapping and Lumora will work out what each one costs you.
            </Text>
        )}
    </View>
);

export default UsageTracker;
