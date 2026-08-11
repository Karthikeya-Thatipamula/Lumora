import { icons, IconKey } from '@/constants/icons';
import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

const MARQUEE_ICONS: IconKey[] = [
    'spotify',
    'notion',
    'figma',
    'github',
    'openai',
    'claude',
    'adobe',
    'canva',
    'dropbox',
    'medium',
];

const ITEM_SIZE = 44;
const ITEM_GAP = 24;
const TRACK_WIDTH = MARQUEE_ICONS.length * (ITEM_SIZE + ITEM_GAP);

/**
 * Continuously scrolling row of recognisable services. Sits on onboarding as passive
 * social proof — showing what Lumora tracks lands faster than a sentence describing it.
 *
 * The track is rendered twice and translated by exactly one track width, so the loop
 * point is seamless rather than snapping back.
 */
const LogoMarquee = () => {
    const offset = useSharedValue(0);

    useEffect(() => {
        offset.value = withRepeat(
            withTiming(-TRACK_WIDTH, { duration: 18000, easing: Easing.linear }),
            -1,
            false,
        );
    }, [offset]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value }],
    }));

    return (
        <View
            style={{ height: ITEM_SIZE, overflow: 'hidden' }}
            pointerEvents="none"
            accessibilityElementsHidden
        >
            <Animated.View style={[{ flexDirection: 'row', gap: ITEM_GAP }, animatedStyle]}>
                {[...MARQUEE_ICONS, ...MARQUEE_ICONS].map((key, index) => (
                    // Several of these marks are solid black (GitHub, Notion, Medium,
                    // OpenAI) and vanish against the dark theme, so each sits on its own
                    // light chip rather than floating on the background.
                    <View
                        key={`${key}-${index}`}
                        style={{
                            width: ITEM_SIZE,
                            height: ITEM_SIZE,
                            borderRadius: ITEM_SIZE / 4,
                            backgroundColor: 'rgba(245, 245, 240, 0.92)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 8,
                        }}
                    >
                        <Image
                            source={icons[key]}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="contain"
                        />
                    </View>
                ))}
            </Animated.View>
        </View>
    );
};

export default LogoMarquee;
