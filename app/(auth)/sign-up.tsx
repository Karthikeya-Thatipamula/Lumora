import AuthTextField from '@/components/auth/AuthTextField';
import { LumoraWordmark } from '@/components/LumoraLogo';
import AuroraBackground from '@/components/motion/AuroraBackground';
import { SafeAreaView } from '@/components/SafeAreaView';
import { getClerkErrorMessage } from '@/lib/clerkErrors';
import { describePasswordStrength } from '@/lib/passwordStrength';
import { useAuth, useSignUp } from '@clerk/expo';
import { Link } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

const SELLING_POINTS = [
    { emoji: '🔔', text: 'Never get surprised by a renewal' },
    { emoji: '⏳', text: 'Cancel free trials before they charge' },
    { emoji: '📊', text: 'See exactly where your money goes' },
];

const SignUp = () => {
    const { signUp, errors, fetchStatus } = useSignUp();
    const { isSignedIn } = useAuth();
    const posthog = usePostHog();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    const emailValid =
        emailAddress.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());
    const passwordValid = password.length === 0 || password.length >= 8;
    const formValid = emailAddress.trim().length > 0 && password.length >= 8 && emailValid;
    const isBusy = fetchStatus === 'fetching';
    const strength = describePasswordStrength(password);

    const handleSubmit = async () => {
        if (!formValid || isBusy) return;

        setSubmitError(null);

        try {
            const { error } = await signUp.password({
                emailAddress: emailAddress.trim(),
                password,
            });

            if (error) {
                const message = getClerkErrorMessage(
                    error,
                    'Unable to create your account. Please update your details and try again.',
                );
                setSubmitError(message);
                posthog.capture('user_sign_up_failed', { error_message: message });
                return;
            }

            await signUp.verifications.sendEmailCode();
        } catch (err) {
            const message = getClerkErrorMessage(
                err,
                'Unable to create your account. Please update your details and try again.',
            );
            setSubmitError(message);
            posthog.capture('user_sign_up_error', { error_message: message });
        }
    };

    const handleVerify = async () => {
        if (!code || isBusy) return;

        try {
            await signUp.verifications.verifyEmailCode({ code });

            if (signUp.status === 'complete') {
                await signUp.finalize({
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            // Clerk has a pending task (MFA, organisation selection). Leave the
                            // session where it is — Clerk's task UI takes over from here.
                            return;
                        }
                        // Identity is centralized in app/_layout.tsx once auth state updates
                        posthog.capture('user_signed_up');
                    },
                });
            } else {
                setSubmitError('Verification is not complete yet. Please try again.');
            }
        } catch (err) {
            const message = getClerkErrorMessage(
                err,
                'Verification failed. Please check the code and try again.',
            );
            setSubmitError(message);
            posthog.capture('user_verification_failed', { error_message: message });
        }
    };

    // Don't show anything if already signed in or sign-up is complete
    if (signUp.status === 'complete' || isSignedIn) {
        return null;
    }

    // Show verification screen if email needs verification
    if (
        signUp.status === 'missing_requirements' &&
        signUp.unverifiedFields.includes('email_address') &&
        signUp.missingFields.length === 0
    ) {
        return (
            <SafeAreaView className="auth-safe-area">
                <AuroraBackground />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="auth-screen"
                >
                    <ScrollView
                        className="auth-scroll"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <AnimatedView entering={FadeInDown.duration(400)} className="auth-content">
                            <View className="auth-brand-block">
                                <LumoraWordmark />
                                <Text className="auth-title mt-7">Check your inbox</Text>
                                <Text className="auth-subtitle">
                                    We sent a 6-digit code to {emailAddress.trim()}
                                </Text>
                            </View>

                            <View className="auth-card">
                                <View className="auth-form">
                                    <AuthTextField
                                        label="Verification Code"
                                        value={code}
                                        placeholder="000000"
                                        onChangeText={setCode}
                                        keyboardType="number-pad"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        error={errors.fields.code?.message ?? submitError}
                                    />

                                    <Pressable
                                        className={`auth-button ${(!code || isBusy) && 'auth-button-disabled'}`}
                                        onPress={handleVerify}
                                        disabled={!code || isBusy}
                                        accessibilityRole="button"
                                    >
                                        {isBusy ? (
                                            <ActivityIndicator color="#081126" />
                                        ) : (
                                            <Text className="auth-button-text">Verify Email</Text>
                                        )}
                                    </Pressable>

                                    <Pressable
                                        className="auth-secondary-button"
                                        onPress={() => signUp.verifications.sendEmailCode()}
                                        disabled={isBusy}
                                        accessibilityRole="button"
                                    >
                                        <Text className="auth-secondary-button-text">
                                            Resend Code
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </AnimatedView>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="auth-safe-area">
            <AuroraBackground />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="auth-screen"
            >
                <ScrollView
                    className="auth-scroll"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View className="auth-content">
                        <AnimatedView
                            entering={FadeInDown.duration(500)}
                            className="auth-brand-block"
                        >
                            <LumoraWordmark />
                            <Text className="auth-title mt-7">Take back control</Text>
                            <Text className="auth-subtitle">
                                Most people pay for a dozen subscriptions and forget about three of
                                them.
                            </Text>
                        </AnimatedView>

                        <AnimatedView
                            entering={FadeInDown.duration(500).delay(100)}
                            className="mt-7 gap-3"
                        >
                            {SELLING_POINTS.map((point) => (
                                <View key={point.text} className="auth-benefit">
                                    <Text style={{ fontSize: 18 }}>{point.emoji}</Text>
                                    <Text className="auth-benefit-text">{point.text}</Text>
                                </View>
                            ))}
                        </AnimatedView>

                        <AnimatedView
                            entering={FadeInDown.duration(500).delay(200)}
                            className="auth-card"
                        >
                            <View className="auth-form">
                                <AuthTextField
                                    label="Email Address"
                                    autoCapitalize="none"
                                    value={emailAddress}
                                    placeholder="name@example.com"
                                    onChangeText={setEmailAddress}
                                    onBlur={() => setEmailTouched(true)}
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    error={
                                        (emailTouched &&
                                            !emailValid &&
                                            'Please enter a valid email address') ||
                                        errors.fields.emailAddress?.message ||
                                        null
                                    }
                                />

                                <View>
                                    <AuthTextField
                                        label="Password"
                                        secure
                                        value={password}
                                        placeholder="Create a strong password"
                                        onChangeText={setPassword}
                                        onBlur={() => setPasswordTouched(true)}
                                        autoComplete="password-new"
                                        error={
                                            (passwordTouched &&
                                                !passwordValid &&
                                                'Password must be at least 8 characters') ||
                                            errors.fields.password?.message ||
                                            null
                                        }
                                        hint={
                                            password.length === 0
                                                ? 'Minimum 8 characters'
                                                : undefined
                                        }
                                    />

                                    {password.length > 0 && (
                                        <AnimatedView
                                            entering={FadeIn.duration(200)}
                                            className="mt-2 gap-1.5"
                                        >
                                            <View className="flex-row gap-1.5">
                                                {[0, 1, 2, 3].map((index) => (
                                                    <View
                                                        key={index}
                                                        className="h-1 flex-1 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                index < strength.score
                                                                    ? strength.color
                                                                    : 'rgba(128,128,128,0.25)',
                                                        }}
                                                    />
                                                ))}
                                            </View>
                                            <Text
                                                className="text-xs font-sans-semibold"
                                                style={{ color: strength.color }}
                                            >
                                                {strength.label}
                                            </Text>
                                        </AnimatedView>
                                    )}
                                </View>

                                {submitError && (
                                    <AnimatedView
                                        entering={FadeIn.duration(200)}
                                        className="auth-banner-error"
                                    >
                                        <Text className="auth-banner-error-text">
                                            {submitError}
                                        </Text>
                                    </AnimatedView>
                                )}

                                <Pressable
                                    className={`auth-button ${(!formValid || isBusy) && 'auth-button-disabled'}`}
                                    onPress={handleSubmit}
                                    disabled={!formValid || isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel="Create account"
                                >
                                    {isBusy ? (
                                        <ActivityIndicator color="#081126" />
                                    ) : (
                                        <Text className="auth-button-text">
                                            Create Free Account
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </AnimatedView>

                        <Animated.View entering={FadeIn.duration(500).delay(320)}>
                            <View className="auth-link-row">
                                <Text className="auth-link-copy">Already have an account?</Text>
                                <Link href="/(auth)/sign-in" asChild>
                                    <Pressable hitSlop={8} accessibilityRole="button">
                                        <Text className="auth-link">Sign In</Text>
                                    </Pressable>
                                </Link>
                            </View>

                            <Text className="mt-4 text-center text-xs font-sans-medium text-muted-foreground">
                                By creating an account, you agree to Lumora&apos;s{' '}
                                <Link href="/legal/terms">
                                    <Text className="text-accent">Terms of Use</Text>
                                </Link>{' '}
                                and{' '}
                                <Link href="/legal/privacy">
                                    <Text className="text-accent">Privacy Policy</Text>
                                </Link>
                                .
                            </Text>
                        </Animated.View>

                        {/* Required for Clerk's bot protection */}
                        <View nativeID="clerk-captcha" />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignUp;
