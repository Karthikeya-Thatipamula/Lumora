import { formatCurrency } from '@/lib/utils';
import { useThemeColors } from '@/lib/useThemeColors';
import clsx from 'clsx';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

interface BudgetCardProps {
    monthlyBudget?: number;
    monthlySpend: number;
    onSave: (budget: number) => void;
}

const BudgetCard = ({ monthlyBudget, monthlySpend, onSave }: BudgetCardProps) => {
    const themeColors = useThemeColors();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(monthlyBudget ? String(monthlyBudget) : '');

    const handleSave = () => {
        const value = Number(draft.trim());
        if (Number.isFinite(value) && value > 0) {
            onSave(value);
            setIsEditing(false);
        }
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
                        className="auth-input flex-1"
                        placeholder="e.g. 150"
                        placeholderTextColor={themeColors.placeholder}
                        value={draft}
                        onChangeText={setDraft}
                        keyboardType="decimal-pad"
                    />
                    <Pressable className="auth-button mt-0 px-6" onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save budget">
                        <Text className="auth-button-text">Save</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const percentage = Math.min(100, (monthlySpend / monthlyBudget) * 100);
    const isOverBudget = monthlySpend > monthlyBudget;

    return (
        <Pressable className="auth-card gap-3" onPress={() => { setDraft(String(monthlyBudget)); setIsEditing(true); }}>
            <View className="flex-row items-center justify-between">
                <Text className="text-base font-sans-semibold text-primary">Monthly Budget</Text>
                <Text className="text-xs font-sans-semibold text-accent">Edit</Text>
            </View>

            <View className="h-3 overflow-hidden rounded-full bg-muted">
                <View
                    className={clsx('h-3 rounded-full', isOverBudget ? 'bg-destructive' : 'bg-success')}
                    style={{ width: `${percentage}%` }}
                />
            </View>

            <Text className={clsx('text-sm font-sans-semibold', isOverBudget ? 'text-destructive' : 'text-muted-foreground')}>
                {formatCurrency(monthlySpend)} of {formatCurrency(monthlyBudget)} {isOverBudget ? '— over budget' : 'spent this month'}
            </Text>
        </Pressable>
    );
};

export default BudgetCard;
