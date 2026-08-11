import PressableScale from '@/components/motion/PressableScale';
import { DiscoveryPrompt } from '@/lib/discovery';
import { Text, View } from 'react-native';
import { FadeIn, LinearTransition } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

interface DiscoveryAuditCardProps {
    prompts: DiscoveryPrompt[];
    coveragePercentage: number;
    /** Opens the add form pre-filled with a suggested name. */
    onAdd: (name: string) => void;
    onDismiss: (groupId: string) => void;
}

/**
 * Prompts for the categories the user has nothing tracked in.
 *
 * The whole point of Lumora is knowing what you pay for, and the one thing a manual
 * tracker can't see is what you never entered. Competitors close that gap by taking bank
 * credentials; this closes most of it by simply asking, which costs the user no access
 * at all.
 */
const DiscoveryAuditCard = ({
    prompts,
    coveragePercentage,
    onAdd,
    onDismiss,
}: DiscoveryAuditCardProps) => {
    if (prompts.length === 0) return null;

    return (
        <AnimatedView
            layout={LinearTransition.duration(220)}
            entering={FadeIn.duration(300)}
            className="mb-5 gap-4 rounded-3xl border border-border bg-card p-4"
        >
            <View className="gap-1">
                <Text className="text-lg font-sans-bold text-primary">Anything missing?</Text>
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Lumora can only track what you tell it. These are the ones people most often
                    forget.
                </Text>
            </View>

            <View className="gap-1.5">
                <View className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <View
                        className="h-1.5 rounded-full bg-success"
                        style={{ width: `${coveragePercentage}%` }}
                    />
                </View>
                <Text className="text-xs font-sans-medium text-muted-foreground">
                    {coveragePercentage}% of common categories accounted for
                </Text>
            </View>

            <View className="gap-3">
                {prompts.map(({ group, quickAdds }) => (
                    <AnimatedView
                        key={group.id}
                        layout={LinearTransition.duration(200)}
                        entering={FadeIn.duration(220)}
                        className="gap-2 rounded-2xl bg-background p-3"
                    >
                        <View className="flex-row items-start justify-between gap-3">
                            <Text className="flex-1 text-sm font-sans-semibold text-primary">
                                {group.prompt}
                            </Text>
                            <PressableScale
                                onPress={() => onDismiss(group.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Dismiss ${group.label} suggestion`}
                                hitSlop={10}
                            >
                                <Text className="text-xs font-sans-semibold text-muted-foreground">
                                    Not me
                                </Text>
                            </PressableScale>
                        </View>

                        <View className="flex-row flex-wrap gap-2">
                            {(quickAdds.length > 0
                                ? quickAdds.map((entry) => entry.name)
                                : group.examples
                            ).map((name) => (
                                <PressableScale
                                    key={name}
                                    className="category-chip"
                                    onPress={() => onAdd(name)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Add ${name}`}
                                >
                                    <Text className="category-chip-text">+ {name}</Text>
                                </PressableScale>
                            ))}
                        </View>
                    </AnimatedView>
                ))}
            </View>
        </AnimatedView>
    );
};

export default DiscoveryAuditCard;
