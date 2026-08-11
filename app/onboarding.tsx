import { LumoraLogo } from '@/components/LumoraLogo';
import AuroraBackground from '@/components/motion/AuroraBackground';
import LogoMarquee from '@/components/motion/LogoMarquee';
import PressableScale from '@/components/motion/PressableScale';
import { SafeAreaView } from '@/components/SafeAreaView';
import { setHasOnboarded } from '@/lib/onboarding';
import { useThemeColors } from '@/lib/useThemeColors';
import { Link, useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

interface Slide {
    emoji: string;
    title: string;
    body: string;
}

const SLIDES: Slide[] = [
    {
        emoji: '📋',
        title: 'Every subscription, one place',
        body: 'Streaming, software, gym memberships — see all your recurring costs at a glance instead of digging through bank statements.',
    },
    {
        emoji: '⏳',
        title: 'Cancel trials before they charge',
        body: 'Lumora counts down every free trial and warns you while cancelling is still free. One save usually pays for the year.',
    },
    {
        emoji: '📊',
        title: 'See where your money actually goes',
        body: 'Spending insights break costs down by category, flag price hikes, and track every penny you reclaim by cancelling.',
    },
];

const Onboarding = () => {
    const router = useRouter();
    const posthog = usePostHog();
    const themeColors = useThemeColors();
    const [slideIndex, setSlideIndex] = useState(0);
    const [isLeaving, setIsLeaving] = useState(false);
    const isLastSlide = slideIndex === SLIDES.length - 1;
    const slide = SLIDES[slideIndex];

    const finishOnboarding = async (destination: '/(auth)/sign-up' | '/(auth)/sign-in') => {
        // Guard against a double tap firing two navigations before the first resolves.
        if (isLeaving) return;
        setIsLeaving(true);

        await setHasOnboarded();
        posthog.capture('onboarding_completed', { last_slide: slideIndex, destination });
        router.replace(destination);
    };

    const handleNext = () => {
        if (isLastSlide) {
            finishOnboarding('/(auth)/sign-up');
            return;
        }
        posthog.capture('onboarding_slide_viewed', { slide_index: slideIndex + 1 });
        setSlideIndex((index) => index + 1);
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <AuroraBackground />

            <View className="screen-column px-6 pb-8 pt-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <LumoraLogo size={40} />
                        <Text className="auth-wordmark">Lumora</Text>
                    </View>

                    {!isLastSlide && (
                        <Pressable
                            onPress={() => finishOnboarding('/(auth)/sign-up')}
                            accessibilityRole="button"
                            accessibilityLabel="Skip onboarding"
                            hitSlop={12}
                        >
                            <Text className="text-sm font-sans-semibold text-muted-foreground">Skip</Text>
                        </Pressable>
                    )}
                </View>

                <View className="flex-1 items-center justify-center">
                    {/* Keyed on the index so each slide mounts fresh and animates in. */}
                    <AnimatedView
                        key={slideIndex}
                        entering={FadeInRight.duration(320)}
                        exiting={FadeOutLeft.duration(200)}
                        className="items-center gap-6"
                    >
                        <View className="size-28 items-center justify-center rounded-full bg-accent/15">
                            <Text style={{ fontSize: 56 }}>{slide.emoji}</Text>
                        </View>
                        <Text className="text-center text-3xl font-sans-extrabold text-primary">{slide.title}</Text>
                        <Text className="auth-subtitle max-w-85">{slide.body}</Text>
                    </AnimatedView>
                </View>

                <View className="mb-6">
                    <LogoMarquee />
                </View>

                <View className="mb-8 flex-row items-center justify-center gap-2">
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            className="h-2 rounded-full"
                            style={{
                                width: index === slideIndex ? 24 : 8,
                                backgroundColor: index === slideIndex ? themeColors.accent : themeColors.border,
                            }}
                        />
                    ))}
                </View>

                <Animated.View entering={FadeIn.duration(400)}>
                    <PressableScale className="auth-button" onPress={handleNext} disabled={isLeaving} accessibilityRole="button">
                        <Text className="auth-button-text">{isLastSlide ? 'Get Started — Free' : 'Next'}</Text>
                    </PressableScale>

                    <View className="auth-link-row">
                        <Text className="auth-link-copy">Already have an account?</Text>
                        <Link href="/(auth)/sign-in" asChild>
                            <Pressable onPress={() => finishOnboarding('/(auth)/sign-in')} hitSlop={8} accessibilityRole="button">
                                <Text className="auth-link">Sign In</Text>
                            </Pressable>
                        </Link>
                    </View>
                </Animated.View>
            </View>
        </SafeAreaView>
    )
}

export default Onboarding
