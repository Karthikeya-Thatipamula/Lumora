import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface AuroraBlobProps {
    colors: readonly [string, string];
    size: number;
    top: number;
    left: number;
    /** Milliseconds for one drift cycle. Staggered so the blobs never move in lockstep. */
    durationMs: number;
    driftX: number;
    driftY: number;
}

const AuroraBlob = ({ colors, size, top, left, durationMs, driftX, driftY }: AuroraBlobProps) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
    }, [durationMs, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: progress.value * driftX },
            { translateY: progress.value * driftY },
            { scale: 1 + progress.value * 0.12 },
        ],
    }));

    return (
        <Animated.View
            style={[
                { position: 'absolute', top, left, width: size, height: size, opacity: 0.4 },
                animatedStyle,
            ]}
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: size / 2 }}
            />
        </Animated.View>
    );
};

/** Beyond this the layout is centred in a phone-width column, so the wash follows it. */
const CONTENT_MAX_WIDTH = 480;

/**
 * Slow drifting colour wash behind the auth and onboarding screens. Purely decorative,
 * never interactive.
 *
 * Geometry is derived from the viewport rather than hard-coded: at phone widths the blobs
 * bleed off the top corners, and on a wide desktop window they stay anchored to the
 * centred content column instead of clustering in the far top-left.
 */
const AuroraBackground = () => {
    const { width } = useWindowDimensions();
    const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
    const originX = (width - columnWidth) / 2;
    const unit = columnWidth / 390; // Scale factor against the reference phone width.

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 380 * unit,
                overflow: 'hidden',
            }}
            pointerEvents="none"
        >
            <AuroraBlob
                colors={['#EA7A53', '#F2A17A']}
                size={280 * unit}
                top={-120 * unit}
                left={originX - 80 * unit}
                durationMs={9000}
                driftX={36 * unit}
                driftY={26 * unit}
            />
            <AuroraBlob
                colors={['#8FD1BD', '#B8D4E3']}
                size={220 * unit}
                top={-60 * unit}
                left={originX + columnWidth - 150 * unit}
                durationMs={11000}
                driftX={-30 * unit}
                driftY={40 * unit}
            />
            <AuroraBlob
                colors={['#E8DEF8', '#F5C542']}
                size={180 * unit}
                top={110 * unit}
                left={originX + columnWidth * 0.35}
                durationMs={13000}
                driftX={44 * unit}
                driftY={-26 * unit}
            />
        </View>
    );
};

export default AuroraBackground;
