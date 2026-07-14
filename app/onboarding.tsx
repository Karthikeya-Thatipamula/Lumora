import { setHasOnboarded } from '@/lib/onboarding';
import { useThemeColors } from '@/lib/useThemeColors';
import { Link, useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = styled(RNSafeAreaView);

interface Slide {
    emoji: string;
    title: string;
    body: string;
}

const SLIDES: Slide[] = [
    {
        emoji: '📋',
        title: 'Track every subscription in one place',
        body: 'Streaming, software, gym memberships — see all your recurring costs at a glance instead of digging through bank statements.',
    },
    {
        emoji: '🔔',
        title: 'Never get surprised by a charge again',
        body: 'Get reminded before a renewal hits your card, so you always have time to cancel, downgrade, or just be ready for it.',
    },
    {
        emoji: '📊',
        title: 'See where your money actually goes',
        body: 'Spending insights break down your costs by category, flag price hikes, and point out subscriptions worth cutting.',
    },
];

const Onboarding = () => {
    const router = useRouter();
    const posthog = usePostHog();
    const themeColors = useThemeColors();
    const [slideIndex, setSlideIndex] = useState(0);
    const isLastSlide = slideIndex === SLIDES.length - 1;
    const slide = SLIDES[slideIndex];

    const finishOnboarding = async (destination: '/(auth)/sign-up' | '/(auth)/sign-in') => {
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
            <View className="flex-1 px-6 pb-8 pt-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <View className="auth-logo-mark">
                            <Text className="auth-logo-mark-text">L</Text>
                        </View>
                        <Text className="auth-wordmark">Lumora</Text>
                    </View>

                    {!isLastSlide && (
                        <Pressable onPress={() => finishOnboarding('/(auth)/sign-up')} accessibilityRole="button" accessibilityLabel="Skip onboarding">
                            <Text className="text-sm font-sans-semibold text-muted-foreground">Skip</Text>
                        </Pressable>
                    )}
                </View>

                <View className="flex-1 items-center justify-center gap-6">
                    <View className="size-28 items-center justify-center rounded-full bg-accent/15">
                        <Text style={{ fontSize: 56 }}>{slide.emoji}</Text>
                    </View>
                    <Text className="text-center text-3xl font-sans-extrabold text-primary">{slide.title}</Text>
                    <Text className="auth-subtitle max-w-85">{slide.body}</Text>
                </View>

                <View className="mb-8 flex-row items-center justify-center gap-2">
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            className="h-2 rounded-full"
                            style={{ width: index === slideIndex ? 24 : 8, backgroundColor: index === slideIndex ? themeColors.accent : themeColors.border }}
                        />
                    ))}
                </View>

                <Pressable className="auth-button" onPress={handleNext} accessibilityRole="button">
                    <Text className="auth-button-text">{isLastSlide ? 'Get Started' : 'Next'}</Text>
                </Pressable>

                <View className="auth-link-row">
                    <Text className="auth-link-copy">Already have an account?</Text>
                    <Link href="/(auth)/sign-in" asChild>
                        <Pressable onPress={() => finishOnboarding('/(auth)/sign-in')}>
                            <Text className="auth-link">Sign In</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    )
}

export default Onboarding
