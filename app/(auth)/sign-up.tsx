import { getClerkErrorMessage } from '@/lib/clerkErrors';
import { useThemeColors } from '@/lib/useThemeColors';
import { useAuth, useSignUp } from '@clerk/expo';
import { Link } from 'expo-router';
import { styled } from 'nativewind';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = styled(RNSafeAreaView);

const SignUp = () => {
    const { signUp, errors, fetchStatus } = useSignUp();
    const { isSignedIn } = useAuth();
    const posthog = usePostHog();
    const themeColors = useThemeColors();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Validation states
    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    // Client-side validation
    const emailValid = emailAddress.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
    const passwordValid = password.length === 0 || password.length >= 8;
    const formValid = emailAddress.length > 0 && password.length >= 8 && emailValid;

    const handleSubmit = async () => {
        if (!formValid) return;

        setSubmitError(null);

        try {
            const { error } = await signUp.password({
                emailAddress,
                password,
            });

            if (error) {
                const message = getClerkErrorMessage(error, 'Unable to create your account. Please update your details and try again.');
                setSubmitError(message);
                posthog.capture('user_sign_up_failed', {
                    error_message: message,
                });
                return;
            }

            // Send verification email
            if (!error) {
                await signUp.verifications.sendEmailCode();
            }
        } catch (err) {
            const message = getClerkErrorMessage(err, 'Unable to create your account. Please update your details and try again.');
            setSubmitError(message);
            posthog.capture('user_sign_up_error', {
                error_message: message,
            });
        }
    };

    const handleVerify = async () => {
        try {
            await signUp.verifications.verifyEmailCode({
                code,
            });

            if (signUp.status === 'complete') {
                await signUp.finalize({
                    navigate: async ({ session }) => {
                        if (session?.currentTask) {
                            console.log(session?.currentTask);
                            return;
                        }

                        // Identity is centralized in app/_layout.tsx once auth state updates
                        posthog.capture('user_signed_up');
                        // Auth state change will trigger root layout to render tabs
                    },
                });
            } else {
                setSubmitError('Verification is not complete yet. Please try again.');
            }
        } catch (err) {
            const message = getClerkErrorMessage(err, 'Verification failed. Please check the code and try again.');
            setSubmitError(message);
            posthog.capture('user_verification_failed', {
                error_message: message,
            });
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
                            {/* Branding */}
                            <View className="auth-brand-block">
                                <View className="auth-logo-wrap">
                                    <View className="auth-logo-mark">
                                        <Text className="auth-logo-mark-text">R</Text>
                                    </View>
                                    <View>
                                        <Text className="auth-wordmark">Lumora</Text>
                                        <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                                    </View>
                                </View>
                                <Text className="auth-title">Verify your email</Text>
                                <Text className="auth-subtitle">
                                    We sent a verification code to {emailAddress}
                                </Text>
                            </View>

                            {/* Verification Form */}
                            <View className="auth-card">
                                <View className="auth-form">
                                    <View className="auth-field">
                                        <Text className="auth-label">Verification Code</Text>
                                        <TextInput
                                            className="auth-input"
                                            value={code}
                                            placeholder="Enter 6-digit code"
                                            placeholderTextColor={themeColors.placeholder}
                                            onChangeText={setCode}
                                            keyboardType="number-pad"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                        />
                                        {errors.fields.code && (
                                            <Text className="auth-error">{errors.fields.code.message}</Text>
                                        )}
                                    </View>

                                    {submitError && (
                                        <Text className="auth-error">{submitError}</Text>
                                    )}

                                    <Pressable
                                        className={`auth-button ${(!code || fetchStatus === 'fetching') && 'auth-button-disabled'}`}
                                        onPress={handleVerify}
                                        disabled={!code || fetchStatus === 'fetching'}
                                    >
                                        <Text className="auth-button-text">
                                            {fetchStatus === 'fetching' ? 'Verifying...' : 'Verify Email'}
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        className="auth-secondary-button"
                                        onPress={() => signUp.verifications.sendEmailCode()}
                                        disabled={fetchStatus === 'fetching'}
                                    >
                                        <Text className="auth-secondary-button-text">Resend Code</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // Main sign-up form
    return (
        <SafeAreaView className="auth-safe-area">
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
                        {/* Branding */}
                        <View className="auth-brand-block">
                            <View className="auth-logo-wrap">
                                <View className="auth-logo-mark">
                                    <Text className="auth-logo-mark-text">R</Text>
                                </View>
                                <View>
                                    <Text className="auth-wordmark">Lumora</Text>
                                    <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                                </View>
                            </View>
                            <Text className="auth-title">Create your account</Text>
                            <Text className="auth-subtitle">
                                Start tracking your subscriptions and never miss a payment
                            </Text>
                        </View>

                        {/* Sign-Up Form */}
                        <View className="auth-card">
                            <View className="auth-form">
                                <View className="auth-field">
                                    <Text className="auth-label">Email Address</Text>
                                    <TextInput
                                        className={`auth-input ${emailTouched && !emailValid && 'auth-input-error'}`}
                                        autoCapitalize="none"
                                        value={emailAddress}
                                        placeholder="name@example.com"
                                        placeholderTextColor={themeColors.placeholder}
                                        onChangeText={setEmailAddress}
                                        onBlur={() => setEmailTouched(true)}
                                        keyboardType="email-address"
                                        autoComplete="email"
                                    />
                                    {emailTouched && !emailValid && (
                                        <Text className="auth-error">Please enter a valid email address</Text>
                                    )}
                                    {errors.fields.emailAddress && (
                                        <Text className="auth-error">{errors.fields.emailAddress.message}</Text>
                                    )}
                                </View>

                                <View className="auth-field">
                                    <Text className="auth-label">Password</Text>
                                    <TextInput
                                        className={`auth-input ${passwordTouched && !passwordValid && 'auth-input-error'}`}
                                        value={password}
                                        placeholder="Create a strong password"
                                        placeholderTextColor={themeColors.placeholder}
                                        secureTextEntry
                                        onChangeText={setPassword}
                                        onBlur={() => setPasswordTouched(true)}
                                        autoComplete="password-new"
                                    />
                                    {passwordTouched && !passwordValid && (
                                        <Text className="auth-error">Password must be at least 8 characters</Text>
                                    )}
                                    {errors.fields.password && (
                                        <Text className="auth-error">{errors.fields.password.message}</Text>
                                    )}
                                    {!passwordTouched && (
                                        <Text className="auth-helper">Minimum 8 characters required</Text>
                                    )}
                                </View>

                                {submitError && (
                                    <Text className="auth-error">{submitError}</Text>
                                )}

                                <Pressable
                                    className={`auth-button ${(!formValid || fetchStatus === 'fetching') && 'auth-button-disabled'}`}
                                    onPress={handleSubmit}
                                    disabled={!formValid || fetchStatus === 'fetching'}
                                >
                                    <Text className="auth-button-text">
                                        {fetchStatus === 'fetching' ? 'Creating Account...' : 'Create Account'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Sign-In Link */}
                        <View className="auth-link-row">
                            <Text className="auth-link-copy">Already have an account?</Text>
                            <Link href="/(auth)/sign-in" asChild>
                                <Pressable>
                                    <Text className="auth-link">Sign In</Text>
                                </Pressable>
                            </Link>
                        </View>

                        <Text className="mt-4 text-center text-xs font-sans-medium text-muted-foreground">
                            By creating an account, you agree to Lumora&apos;s{' '}
                            <Link href="/legal/terms"><Text className="text-accent">Terms of Use</Text></Link>
                            {' '}and{' '}
                            <Link href="/legal/privacy"><Text className="text-accent">Privacy Policy</Text></Link>.
                        </Text>

                        {/* Required for Clerk's bot protection */}
                        <View nativeID="clerk-captcha" />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignUp;