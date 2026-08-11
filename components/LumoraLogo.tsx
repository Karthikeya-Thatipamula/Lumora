import { colors } from '@/constants/theme';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface LumoraLogoProps {
    size?: number;
    /** `glyph` draws the mark alone, for use on an already-coloured surface. */
    variant?: 'tile' | 'glyph';
    glyphColor?: string;
}

/**
 * Lumora's mark: an "L" drawn as one continuous light stroke with a luminous point at
 * its top right — the name means light, and the rounded turn reads as a billing cycle
 * coming back around. Vector rather than PNG so it stays crisp from a 24px header to
 * a 1024px store icon.
 */
export const LumoraLogo = ({ size = 56, variant = 'tile', glyphColor }: LumoraLogoProps) => {
    const stroke = glyphColor ?? (variant === 'tile' ? '#FFFFFF' : colors.accent);

    return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
            <Defs>
                <LinearGradient id="lumoraTile" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#F2A17A" />
                    <Stop offset="0.55" stopColor="#EA7A53" />
                    <Stop offset="1" stopColor="#D65F3C" />
                </LinearGradient>
            </Defs>

            {variant === 'tile' && (
                <Rect x="0" y="0" width="48" height="48" rx="14" fill="url(#lumoraTile)" />
            )}

            <Path
                d="M17 12 L17 30 Q17 32 19 32 L32 32"
                stroke={stroke}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />

            <Circle cx="32" cy="16" r="4" fill={stroke} opacity={variant === 'tile' ? 0.92 : 1} />
        </Svg>
    );
};

interface LumoraWordmarkProps {
    size?: number;
    showTagline?: boolean;
}

/** Mark + wordmark lockup, used across the auth and onboarding screens. */
export const LumoraWordmark = ({ size = 56, showTagline = true }: LumoraWordmarkProps) => (
    <View className="flex-row items-center gap-3">
        <LumoraLogo size={size} />
        <View>
            <Text className="text-3xl font-sans-extrabold text-primary">Lumora</Text>
            {showTagline && <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>}
        </View>
    </View>
);
