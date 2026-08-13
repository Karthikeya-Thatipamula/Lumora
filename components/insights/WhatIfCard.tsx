import type { Subscription } from '@/lib/subscriptionTypes';
import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { LabelWithInfo } from '@/components/motion/InfoTooltip';
import PressableScale from '@/components/motion/PressableScale';
import { simulateCancellations } from '@/lib/insights';
import { formatCurrency } from '@/lib/utils';
import { clsx } from 'clsx';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

interface WhatIfCardProps {
    subscriptions: Subscription[];
    currency?: string;
}

/**
 * Lets the user model cancelling things without touching any data.
 *
 * The hard part of subscription hygiene isn't knowing what you pay — it's deciding what to
 * drop. Seeing "cancel these two and you keep £312 a year" before committing is the nudge
 * that turns a vague intention into an actual cancellation.
 */
const WhatIfCard = ({ subscriptions, currency }: WhatIfCardProps) => {
    const [removedIds, setRemovedIds] = useState<string[]>([]);

    const candidates = useMemo(
        () => subscriptions.filter((sub) => sub.status === 'active'),
        [subscriptions],
    );

    const result = useMemo(
        () => simulateCancellations(subscriptions, removedIds),
        [subscriptions, removedIds],
    );

    if (candidates.length === 0) return null;

    const toggle = (id: string) =>
        setRemovedIds((ids) =>
            ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id],
        );

    return (
        <View className="auth-card gap-4">
            <LabelWithInfo
                title="What if I cancelled…"
                info="A preview only — nothing is changed or cancelled. Tap subscriptions to remove them from the calculation and see what you'd keep."
            />

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
                {candidates.map((sub) => {
                    const isRemoved = removedIds.includes(sub.id);
                    return (
                        <PressableScale
                            key={sub.id}
                            className={clsx(
                                'category-chip',
                                isRemoved && 'border-destructive/50 bg-destructive/10',
                            )}
                            onPress={() => toggle(sub.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isRemoved }}
                            accessibilityLabel={`${isRemoved ? 'Restore' : 'Remove'} ${sub.name} from the simulation`}
                        >
                            <Text
                                className={clsx(
                                    'category-chip-text',
                                    isRemoved && 'text-destructive line-through',
                                )}
                            >
                                {sub.name}
                            </Text>
                        </PressableScale>
                    );
                })}
            </ScrollView>

            <View className="gap-1">
                <AnimatedNumber
                    className="text-3xl font-sans-extrabold text-success"
                    value={result.yearlySaving}
                    format={(amount) => formatCurrency(amount, currency)}
                />
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    {result.removedCount === 0
                        ? 'a year — tap anything above to see what dropping it would save'
                        : `a year saved by dropping ${result.removedCount} ${result.removedCount === 1 ? 'subscription' : 'subscriptions'}, leaving ${formatCurrency(result.newMonthly, currency)}/month`}
                </Text>
            </View>

            {removedIds.length > 0 && (
                <PressableScale
                    className="auth-secondary-button"
                    onPress={() => setRemovedIds([])}
                    accessibilityRole="button"
                    accessibilityLabel="Reset the simulation"
                >
                    <Text className="auth-secondary-button-text">Reset</Text>
                </PressableScale>
            )}
        </View>
    );
};

export default WhatIfCard;
