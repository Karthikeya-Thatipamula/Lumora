import { ReactNode, useEffect } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

interface GlowCardProps {
    children: ReactNode;
    className?: string;
    /** Stops the pulse — respect this when the content is no longer time-critical. */
    active?: boolean;
    glowColor?: string;
}

/**
 * A card whose border breathes. Reserved for genuinely time-critical content (a trial
 * about to charge) — motion is an attention budget, and spending it everywhere means
 * it stops working anywhere.
 */
const GlowCard = ({ children, className, active = true, glowColor = '#ea7a53' }: GlowCardProps) => {
    const glow = useSharedValue(0);

    useEffect(() => {
        if (!active) {
            glow.value = withTiming(0, { duration: 200 });
            return;
        }

        glow.value = withRepeat(
            withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        );
    }, [active, glow]);

    const animatedStyle = useAnimatedStyle(() => ({
        shadowOpacity: 0.15 + glow.value * 0.35,
        shadowRadius: 8 + glow.value * 14,
        // Android ignores shadow* entirely, so carry the pulse on the border too.
        borderColor: `rgba(234, 122, 83, ${0.35 + glow.value * 0.5})`,
    }));

    return (
        <AnimatedView
            className={className}
            style={[
                { shadowColor: glowColor, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
                animatedStyle,
            ]}
        >
            {children}
        </AnimatedView>
    );
};

export default GlowCard;
