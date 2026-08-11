import AuthTextField from '@/components/auth/AuthTextField';
import { LumoraWordmark } from '@/components/LumoraLogo';
import AuroraBackground from '@/components/motion/AuroraBackground';
import { SafeAreaView } from '@/components/SafeAreaView';
import { getClerkErrorMessage } from '@/lib/clerkErrors';
import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

const SignIn = () => {
    const { signIn, errors, fetchStatus } = useSignIn();
    const posthog = usePostHog();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    const emailValid = emailAddress.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());
    const passwordValid = password.length > 0;
    const formValid = emailAddress.trim().length > 0 && password.length > 0 && emailValid;
    const isBusy = fetchStatus === 'fetching';

    const handleSubmit = async () => {
        if (!formValid || isBusy) return;

        setSubmitError(null);

        try {
            const { error } = await signIn.password({
                emailAddress: emailAddress.trim(),
                password,
            });

            if (error) {
                const message = getClerkErrorMessage(error, 'Unable to sign in. Please check your details and try again.');
                setSubmitError(message);
                posthog.capture('user_sign_in_failed', { error_message: message });
                return;
            }

            if (signIn.status === 'complete') {
                await signIn.finalize({
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            // Clerk has a pending task (MFA, organisation selection). Leave the
                            // session where it is — Clerk's task UI takes over from here.
                            return;
                        }
                        // Identity is centralized in app/_layout.tsx once auth state updates
                        posthog.capture('user_signed_in');
                    },
                });
            } else if (signIn.status === 'needs_second_factor') {
                setSubmitError('Two-factor authentication isn’t supported in this build yet.');
            } else if (signIn.status === 'needs_client_trust') {
                const emailCodeFactor = signIn.supportedSecondFactors.find(
                    (factor) => factor.strategy === 'email_code'
                );

                if (emailCodeFactor) {
                    await signIn.mfa.sendEmailCode();
                } else {
                    setSubmitError('We couldn’t send a verification code to this address.');
                }
            } else {
                setSubmitError('Additional verification is required to complete sign in.');
            }
        } catch (err) {
            const message = getClerkErrorMessage(err, 'Unable to sign in. Please check your details and try again.');
            setSubmitError(message);
            posthog.capture('user_sign_in_error', { error_message: message });
        }
    };

    const handleVerify = async () => {
        if (!code || isBusy) return;

        try {
            await signIn.mfa.verifyEmailCode({ code });

            if (signIn.status === 'complete') {
                await signIn.finalize({
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            // Clerk has a pending task (MFA, organisation selection). Leave the
                            // session where it is — Clerk's task UI takes over from here.
                            return;
                        }
                        posthog.capture('user_signed_in');
                    },
                });
            } else {
                setSubmitError('Verification is not complete yet. Please try again.');
            }
        } catch (err) {
            const message = getClerkErrorMessage(err, 'Verification failed. Please check the code and try again.');
            setSubmitError(message);
            posthog.capture('user_verification_failed', { error_message: message });
        }
    };

    // Verification step for client-trust challenges.
    if (signIn.status === 'needs_client_trust') {
        return (
            <SafeAreaView className="auth-safe-area">
                <AuroraBackground />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="auth-screen">
                    <ScrollView className="auth-scroll" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <AnimatedView entering={FadeInDown.duration(400)} className="auth-content">
                            <View className="auth-brand-block">
                                <LumoraWordmark />
                                <Text className="auth-title mt-7">Verify your identity</Text>
                                <Text className="auth-subtitle">
                                    We sent a 6-digit code to {emailAddress.trim() || 'your email'}
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
                                            <Text className="auth-button-text">Verify</Text>
                                        )}
                                    </Pressable>

                                    <Pressable
                                        className="auth-secondary-button"
                                        onPress={() => signIn.mfa.sendEmailCode()}
                                        disabled={isBusy}
                                        accessibilityRole="button"
                                    >
                                        <Text className="auth-secondary-button-text">Resend Code</Text>
                                    </Pressable>

                                    <Pressable
                                        className="auth-secondary-button"
                                        onPress={() => signIn.reset()}
                                        disabled={isBusy}
                                        accessibilityRole="button"
                                    >
                                        <Text className="auth-secondary-button-text">Start Over</Text>
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

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="auth-screen">
                <ScrollView className="auth-scroll" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View className="auth-content">
                        <AnimatedView entering={FadeInDown.duration(500)} className="auth-brand-block">
                            <LumoraWordmark />
                            <Text className="auth-title mt-7">Welcome back</Text>
                            <Text className="auth-subtitle">Every renewal, trial and price hike — back in view.</Text>
                        </AnimatedView>

                        <AnimatedView entering={FadeInDown.duration(500).delay(120)} className="auth-card">
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
                                        (emailTouched && !emailValid && 'Please enter a valid email address') ||
                                        errors.fields.identifier?.message ||
                                        null
                                    }
                                />

                                <AuthTextField
                                    label="Password"
                                    secure
                                    value={password}
                                    placeholder="Enter your password"
                                    onChangeText={setPassword}
                                    onBlur={() => setPasswordTouched(true)}
                                    autoComplete="password"
                                    error={
                                        (passwordTouched && !passwordValid && 'Password is required') ||
                                        errors.fields.password?.message ||
                                        null
                                    }
                                />

                                {submitError && (
                                    <AnimatedView entering={FadeIn.duration(200)} className="auth-banner-error">
                                        <Text className="auth-banner-error-text">{submitError}</Text>
                                    </AnimatedView>
                                )}

                                <Pressable
                                    className={`auth-button ${(!formValid || isBusy) && 'auth-button-disabled'}`}
                                    onPress={handleSubmit}
                                    disabled={!formValid || isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel="Sign in"
                                >
                                    {isBusy ? (
                                        <ActivityIndicator color="#081126" />
                                    ) : (
                                        <Text className="auth-button-text">Sign In</Text>
                                    )}
                                </Pressable>
                            </View>
                        </AnimatedView>

                        <Animated.View entering={FadeIn.duration(500).delay(260)}>
                            <View className="auth-link-row">
                                <Text className="auth-link-copy">Don&apos;t have an account?</Text>
                                <Link href="/(auth)/sign-up" asChild>
                                    <Pressable hitSlop={8} accessibilityRole="button">
                                        <Text className="auth-link">Create Account</Text>
                                    </Pressable>
                                </Link>
                            </View>

                            <Text className="auth-trust">🔒 Encrypted in transit · Never sold or shared</Text>
                        </Animated.View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignIn;
