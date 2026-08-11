import { AnimatedText, AnimatedView } from '@/components/motion/Animated';
import { ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface AccordionItemProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    onToggle?: (isOpen: boolean) => void;
}

/**
 * Expanding disclosure row. Height is animated by `LinearTransition` on the container
 * rather than a measured height value — measuring wraps badly when text reflows at
 * different font scales, and the layout transition handles it for free.
 */
export const AccordionItem = ({ title, children, defaultOpen = false, onToggle }: AccordionItemProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const rotation = useSharedValue(defaultOpen ? 1 : 0);

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value * 180}deg` }],
    }));

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        rotation.value = withTiming(next ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
        onToggle?.(next);
    };

    return (
        <AnimatedView layout={LinearTransition.duration(220)} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Pressable
                className="flex-row items-center justify-between gap-3 p-4"
                onPress={toggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={title}
            >
                <Text className="flex-1 text-sm font-sans-semibold text-primary">{title}</Text>
                <AnimatedText style={chevronStyle} className="text-xs text-muted-foreground">
                    ▼
                </AnimatedText>
            </Pressable>

            {isOpen && (
                <AnimatedView entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} className="px-4 pb-4">
                    {children}
                </AnimatedView>
            )}
        </AnimatedView>
    );
};

/** Groups accordion items so the whole stack reflows smoothly as rows open and close. */
export const Accordion = ({ children }: { children: ReactNode }) => (
    <View className="gap-3">{children}</View>
);
