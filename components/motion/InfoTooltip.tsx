import { ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface LabelWithInfoProps {
    title: string;
    info: string;
    /** Optional control rendered to the left of the info button, e.g. an Edit link. */
    action?: ReactNode;
    className?: string;
}

/**
 * Card heading with a tap-to-reveal explainer.
 *
 * Deliberately unanimated. Two earlier attempts both failed on device:
 *
 * 1. An absolutely positioned popover only stacks above siblings that come *earlier* in
 *    the tree, so the card's own content painted straight over it.
 * 2. An inline panel with Reanimated `entering`/`exiting` settled correctly but rendered
 *    the panel a frame before its siblings reflowed — so it visibly overlapped while
 *    opening and left a blank gap while closing, and the transition read as input lag.
 *
 * A plain conditional render reflows in the same commit as the state change: instant,
 * and physically incapable of overlapping. Motion is not worth it for a text panel.
 */
export const LabelWithInfo = ({ title, info, action, className }: LabelWithInfoProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <View className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
                <Text className={className ?? 'flex-1 text-base font-sans-semibold text-primary'}>
                    {title}
                </Text>

                <View className="flex-row items-center gap-3">
                    {action}
                    <Pressable
                        className="size-6 items-center justify-center rounded-full border border-border bg-muted"
                        onPress={() => setIsOpen((open) => !open)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        accessibilityLabel={`${title || 'More information'}. ${isOpen ? 'Hide' : 'Show'} explanation`}
                        hitSlop={12}
                    >
                        <Text className="text-[11px] font-sans-bold text-muted-foreground">
                            {isOpen ? '×' : 'i'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            {isOpen && (
                <View className="rounded-2xl border border-border bg-background p-3">
                    <Text className="text-xs font-sans-medium text-muted-foreground">{info}</Text>
                </View>
            )}
        </View>
    );
};

export default LabelWithInfo;
