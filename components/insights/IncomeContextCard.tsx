import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import PressableScale from '@/components/motion/PressableScale';
import { IncomeContext } from '@/lib/insights';
import { useThemeColors } from '@/lib/useThemeColors';
import { formatCurrency } from '@/lib/utils';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

const MAX_INCOME = 1_000_000;

interface IncomeContextCardProps {
    context: IncomeContext | null;
    monthlySpend: number;
    currency?: string;
    onSave: (income: number) => void;
}

const BAND_COPY: Record<IncomeContext['band'], string> = {
    low: 'Comfortably below what most people spend.',
    typical: 'Around the range most households land in.',
    high: 'On the high side — worth a look at the biggest few.',
};

/**
 * Puts spend in proportion to earnings. A monthly total is easy to shrug off; a share of
 * income is the framing that tells someone whether it's actually a problem.
 *
 * The bands are a common rule of thumb, not regulated guidance, and the card says so —
 * overstating this would be the kind of false precision a money app can't afford.
 */
const IncomeContextCard = ({ context, monthlySpend, currency, onSave }: IncomeContextCardProps) => {
    const themeColors = useThemeColors();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(context ? String(context.monthlyIncome) : '');
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        const trimmed = draft.trim();
        const value = Number(trimmed);

        if (trimmed === '' || !/^\+?(\d+(\.\d+)?|\.\d+)$/.test(trimmed) || !Number.isFinite(value)) {
            setError('Enter a number, like 2500');
            return;
        }
        if (value <= 0) {
            setError('Income must be greater than zero');
            return;
        }
        if (value > MAX_INCOME) {
            setError(`That looks too high — the maximum is ${MAX_INCOME.toLocaleString()}`);
            return;
        }

        setError(null);
        onSave(value);
        setIsEditing(false);
    };

    if (!context || isEditing) {
        return (
            <View className="auth-card gap-3">
                <Text className="text-base font-sans-semibold text-primary">Income context</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Add your monthly take-home and Lumora shows what share of it goes to subscriptions.
                    Stored with your account and never shared.
                </Text>
                <View className="flex-row gap-3">
                    <TextInput
                        className={clsx('auth-input flex-1', error && 'auth-input-error')}
                        placeholder="e.g. 2500"
                        placeholderTextColor={themeColors.placeholder}
                        value={draft}
                        onChangeText={(text) => {
                            setDraft(text);
                            if (error) setError(null);
                        }}
                        keyboardType="decimal-pad"
                        maxLength={12}
                    />
                    <PressableScale
                        className="auth-button mt-0 px-6"
                        onPress={handleSave}
                        accessibilityRole="button"
                        accessibilityLabel="Save monthly income"
                    >
                        <Text className="auth-button-text">Save</Text>
                    </PressableScale>
                </View>
                {error && <Text className="auth-error">{error}</Text>}
            </View>
        );
    }

    const barWidth = Math.min(100, context.percentage);
    const barColor =
        context.band === 'high' ? themeColors.destructive : context.band === 'typical' ? themeColors.accent : themeColors.success;

    return (
        <View className="auth-card gap-3">
            <LabelWithInfo
                title="Income context"
                info="Your monthly subscription spend divided by the take-home figure you entered. The bands are a common rule of thumb, not financial advice."
                action={
                    <PressableScale
                        onPress={() => {
                            setDraft(String(context.monthlyIncome));
                            setIsEditing(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Edit monthly income"
                        hitSlop={12}
                    >
                        <Text className="text-xs font-sans-semibold text-accent">Edit</Text>
                    </PressableScale>
                }
            />

            <Text className="text-3xl font-sans-extrabold text-primary">
                {context.percentage.toFixed(1)}%
                <Text className="text-base font-sans-medium text-muted-foreground"> of your income</Text>
            </Text>

            <View className="h-3 overflow-hidden rounded-full bg-muted">
                <View className="h-3 rounded-full" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
            </View>

            <Text className="text-sm font-sans-medium text-muted-foreground">
                {formatCurrency(monthlySpend, currency)} of {formatCurrency(context.monthlyIncome, currency)} a month.
                {' '}{BAND_COPY[context.band]}
            </Text>
        </View>
    );
};

export default IncomeContextCard;
