import { View, ViewProps } from 'react-native';
import {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { AnimatedView } from '@/components/motion/Animated';

interface SkeletonProps extends ViewProps {
    className?: string;
}

/**
 * Pulsing placeholder block. Replaces the bare spinner: a skeleton shows the shape of
 * what's arriving, so the layout doesn't jump when data lands and the wait feels shorter.
 */
export const Skeleton = ({ className, style, ...props }: SkeletonProps) => {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.quad) }),
            -1,
            true,
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <AnimatedView
            className={`rounded-2xl bg-muted ${className ?? ''}`}
            style={[animatedStyle, style]}
            {...props}
        />
    );
};

/** Stand-in for the subscription list while it loads. */
export const SubscriptionListSkeleton = ({ count = 3 }: { count?: number }) => (
    <View className="gap-4" accessibilityLabel="Loading subscriptions">
        {Array.from({ length: count }, (_, index) => (
            <View
                key={index}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
                <Skeleton className="size-16 rounded-lg" />
                <View className="flex-1 gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </View>
                <View className="items-end gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-10" />
                </View>
            </View>
        ))}
    </View>
);

/** Stand-in for the Insights cards while spend data loads. */
export const InsightsSkeleton = () => (
    <View className="gap-5" accessibilityLabel="Loading insights">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
    </View>
);

export default Skeleton;
