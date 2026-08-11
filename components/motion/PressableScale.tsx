import { AnimatedPressable } from '@/components/motion/Animated';
import { ReactNode } from 'react';
import { PressableProps } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressableScaleProps extends PressableProps {
    children: ReactNode;
    /** How far it compresses. 0.97 is a nudge; 0.93 is a firm press. */
    scaleTo?: number;
    className?: string;
}

/**
 * Touch equivalent of a hover state. Phones have no cursor, so the press itself has
 * to carry the affordance — a spring compression reads as "this is pressable" and
 * confirms the tap landed, which a flat opacity flash does not.
 */
const PressableScale = ({ children, scaleTo = 0.96, disabled, ...props }: PressableScaleProps) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            style={animatedStyle}
            disabled={disabled}
            onPressIn={() => {
                if (!disabled) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 14, stiffness: 260 });
            }}
            {...props}
        >
            {children}
        </AnimatedPressable>
    );
};

export default PressableScale;
