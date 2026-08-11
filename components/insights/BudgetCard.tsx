import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import { formatCurrency } from '@/lib/utils';
import { useThemeColors } from '@/lib/useThemeColors';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const MAX_BUDGET = 1_000_000;

interface BudgetCardProps {
    monthlyBudget?: number;
    monthlySpend: number;
    currency?: string;
    onSave: (budget: number) => void;
}

const BudgetCard = ({ monthlyBudget, monthlySpend, currency, onSave }: BudgetCardProps) => {
    const themeColors = useThemeColors();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(monthlyBudget ? String(monthlyBudget) : '');
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        const trimmed = draft.trim();
        const value = Number(trimmed);

        // Previously an invalid entry silently did nothing, so tapping Save looked broken.
        if (trimmed === '' || !/^\+?(\d+(\.\d+)?|\.\d+)$/.test(trimmed) || !Number.isFinite(value)) {
            setError('Enter a number, like 150');
            return;
        }
        if (value <= 0) {
            setError('Budget must be greater than zero');
            return;
        }
        if (value > MAX_BUDGET) {
            setError(`That looks too high — the maximum is ${MAX_BUDGET.toLocaleString()}`);
            return;
        }

        setError(null);
        onSave(value);
        setIsEditing(false);
    };

    if (!monthlyBudget || isEditing) {
        return (
            <View className="auth-card gap-3">
                <Text className="text-base font-sans-semibold text-primary">Monthly Budget</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Set a cap and Lumora will flag it here (and via notifications) if you&apos;re about to go over.
                </Text>
                <View className="flex-row gap-3">
                    <TextInput
                        className={clsx('auth-input flex-1', error && 'auth-input-error')}
                        placeholder="e.g. 150"
                        placeholderTextColor={themeColors.placeholder}
                        value={draft}
                        onChangeText={(text) => {
                            setDraft(text);
                            if (error) setError(null);
                        }}
                        keyboardType="decimal-pad"
                        maxLength={12}
                    />
                    <Pressable className="auth-button mt-0 px-6" onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save budget">
                        <Text className="auth-button-text">Save</Text>
                    </Pressable>
                </View>
                {error && <Text className="auth-error">{error}</Text>}
            </View>
        );
    }

    const percentage = Math.min(100, (monthlySpend / monthlyBudget) * 100);
    const isOverBudget = monthlySpend > monthlyBudget;

    // A plain View with an explicit Edit control rather than one big Pressable: the
    // info disclosure lives in this header, and nesting it inside a pressable card
    // would fire "edit" every time someone tapped for an explanation.
    return (
        <View className="auth-card gap-3">
            <LabelWithInfo
                title="Monthly Budget"
                info="Compared against your monthly spend: yearly plans divided by twelve, shared plans counted at your share, and running free trials excluded until they convert."
                action={
                    <Pressable
                        onPress={() => { setDraft(String(monthlyBudget)); setIsEditing(true); }}
                        accessibilityRole="button"
                        accessibilityLabel="Edit monthly budget"
                        hitSlop={12}
                    >
                        <Text className="text-xs font-sans-semibold text-accent">Edit</Text>
                    </Pressable>
                }
            />

            <View className="h-3 overflow-hidden rounded-full bg-muted">
                <View
                    className={clsx('h-3 rounded-full', isOverBudget ? 'bg-destructive' : 'bg-success')}
                    style={{ width: `${percentage}%` }}
                />
            </View>

            <Text className={clsx('text-sm font-sans-semibold', isOverBudget ? 'text-destructive' : 'text-muted-foreground')}>
                {formatCurrency(monthlySpend, currency)} of {formatCurrency(monthlyBudget, currency)} {isOverBudget ? '— over budget' : 'spent this month'}
            </Text>
        </View>
    );
};

export default BudgetCard;
