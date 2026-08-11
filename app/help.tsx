import { LumoraLogo } from '@/components/LumoraLogo';
import { Accordion, AccordionItem } from '@/components/motion/Accordion';
import PressableScale from '@/components/motion/PressableScale';
import { SafeAreaView } from '@/components/SafeAreaView';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/purchases';
import { safeBack } from '@/lib/navigation';
import { shareLumora } from '@/lib/share';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

interface Faq {
    question: string;
    answer: string;
}

const FAQS: Faq[] = [
    {
        question: 'Does Lumora cancel subscriptions for me?',
        answer: 'No. Lumora tracks what you pay for and tells you when something is about to renew or convert — cancelling still happens with the provider directly. Nothing here can move money or change your accounts.',
    },
    {
        question: 'Does Lumora connect to my bank?',
        answer: 'No. Every subscription is entered by you. That means no bank credentials to hand over, and nothing to breach — but it also means the numbers are only as accurate as what you enter.',
    },
    {
        question: 'Why is my free trial not counted in monthly spend?',
        answer: 'Because you are not being charged for it yet. Running trials are excluded from spend totals and shown separately as “what starts if you keep every trial”, so today’s number reflects today’s reality. The moment a trial converts, it joins your spend.',
    },
    {
        question: 'I split a plan with family. Does that show correctly?',
        answer: 'Yes — set how many people share it and Lumora counts only your share in every total, while still showing the full price on the card so you know what leaves the account overall.',
    },
    {
        question: 'How accurate are the annual-switch savings?',
        answer: 'They are estimates. Most annual plans work out around two months cheaper than paying monthly, and that is the assumption used. Lumora has no live pricing feed, so always check the provider’s page before switching.',
    },
    {
        question: 'Where does “spend over time” come from?',
        answer: 'It is reconstructed from when each subscription started, when you paused or cancelled it, and its recorded price changes. Months from before you started tracking will naturally read low.',
    },
    {
        question: 'What do I get on the free plan?',
        answer: `Up to ${FREE_SUBSCRIPTION_LIMIT} active subscriptions, unlimited free-trial tracking, renewal reminders, budgets, category breakdowns and your reclaimed-savings total. Pro adds forecasts, smart suggestions, Wrapped, spend history and CSV export.`,
    },
    {
        question: 'How do I cancel Lumora Pro?',
        answer: 'Pro is billed by the App Store or Play Store, so manage or cancel it from your device’s subscription settings. Refunds are handled by Apple or Google under their own policies.',
    },
    {
        question: 'Can I get my data out?',
        answer: 'Yes. Settings → Your data exports everything you have tracked as a CSV that opens in Excel, Numbers or Sheets. No lock-in.',
    },
    {
        question: 'Why am I not getting reminders?',
        answer: 'Check that notifications are enabled in Settings and granted to Lumora in your device settings. Note that Expo Go on Android cannot schedule local notifications at all — that needs a development or store build.',
    },
];

const Help = () => {
    const router = useRouter();
    const posthog = usePostHog();

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <View className="flex-row items-center justify-between px-5 py-4">
                <Pressable
                    onPress={() => safeBack(router, '/(tabs)/settings')}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={12}
                >
                    <Text className="text-2xl text-primary">‹</Text>
                </Pressable>
                <Text className="text-lg font-sans-bold text-primary">Help</Text>
                <View className="w-6" />
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ gap: 20, paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}
            >
                <AnimatedView
                    entering={FadeInDown.duration(360)}
                    className="items-center gap-3 py-4"
                >
                    <LumoraLogo size={56} />
                    <Text className="text-center text-xl font-sans-bold text-primary">
                        How Lumora works
                    </Text>
                    <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                        The short version: you tell it what you pay for, it tells you before the
                        money leaves.
                    </Text>
                </AnimatedView>

                <Accordion>
                    {FAQS.map((faq, index) => (
                        <Animated.View
                            key={faq.question}
                            entering={FadeInDown.duration(280).delay(Math.min(index, 6) * 45)}
                        >
                            <AccordionItem
                                title={faq.question}
                                onToggle={(isOpen) => {
                                    if (isOpen)
                                        posthog.capture('faq_opened', { question: faq.question });
                                }}
                            >
                                <Text className="text-sm font-sans-medium text-muted-foreground">
                                    {faq.answer}
                                </Text>
                            </AccordionItem>
                        </Animated.View>
                    ))}
                </Accordion>

                <View className="auth-card gap-3">
                    <Text className="text-base font-sans-semibold text-primary">Still stuck?</Text>
                    <Text className="text-sm font-sans-medium text-muted-foreground">
                        Everything you have tracked is yours — export it from Settings any time, or
                        pass Lumora on to someone who needs it.
                    </Text>
                    <PressableScale
                        className="auth-secondary-button"
                        onPress={async () => {
                            const result = await shareLumora();
                            posthog.capture('invite_shared', { result, source: 'help' });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Share Lumora"
                    >
                        <Text className="auth-secondary-button-text">Share Lumora</Text>
                    </PressableScale>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Help;
