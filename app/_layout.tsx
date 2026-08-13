import '@/global.css';
import { identifyForMonitoring, initMonitoring } from '@/lib/monitoring';
import { identifyPurchaseUser, resetPurchaseUser } from '@/lib/purchases';
import { useThemePreference } from '@/lib/useThemePreference';
import { useUserSettings } from '@/lib/useUserSettings';
import { posthog } from '@/lib/posthog';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ConvexReactClient, useConvexAuth } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

// At module scope so a crash during the first render is still captured. Inert without
// EXPO_PUBLIC_SENTRY_DSN.
initMonitoring();

// Catches render-time crashes anywhere in the route tree and shows a retryable
// screen instead of unmounting to a blank page.
export { default as ErrorBoundary } from '@/components/RouteErrorBoundary';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const rawConvexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convexUrl = normalizeConvexUrl(rawConvexUrl);

function normalizeConvexUrl(value: string | undefined) {
    if (!value) return undefined;

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    try {
        const url = new URL(trimmed);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch {
        return trimmed;
    }
}

const missingConfig: { name: string; fix: string }[] = [
    ...(!publishableKey
        ? [
              {
                  name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
                  fix: 'Get it from the Clerk dashboard → API Keys, then add it to .env',
              },
          ]
        : []),
    ...(!convexUrl
        ? [
              {
                  name: 'EXPO_PUBLIC_CONVEX_URL',
                  fix: 'Run `npx convex dev` — it logs in, links a project, and writes this for you',
              },
          ]
        : []),
];

// Only constructed when configured — the client throws on an empty URL, and
// there is nothing useful to render with it if Convex isn't set up yet.
const convex = convexUrl
    ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
    : null;

function MissingConfigScreen() {
    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: '#0b0f1a' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        >
            <Text style={{ color: '#f5f5f0', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
                Setup required
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 20 }}>
                Lumora can&apos;t start until these environment variables are set. See README.md for
                full setup steps.
            </Text>
            {missingConfig.map((item) => (
                <View
                    key={item.name}
                    style={{
                        backgroundColor: '#131826',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                    }}
                >
                    <Text
                        style={{
                            color: '#ea7a53',
                            fontSize: 15,
                            fontWeight: '600',
                            marginBottom: 4,
                        }}
                    >
                        {item.name}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{item.fix}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

function ConvexAuthLoadingScreen() {
    return (
        <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
            <ActivityIndicator color="#ea7a53" />
            <Text className="text-center text-sm font-sans-medium text-muted-foreground">
                Securing your Lumora data…
            </Text>
        </View>
    );
}

function ConvexAuthErrorScreen() {
    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: '#0b0f1a' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        >
            <Text style={{ color: '#f5f5f0', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
                Data connection needs attention
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 20 }}>
                You&apos;re signed in, but Lumora couldn&apos;t verify that session with its data
                service. Check the Clerk–Convex integration, then reload the app.
            </Text>
            <View style={{ backgroundColor: '#131826', borderRadius: 12, padding: 16 }}>
                <Text
                    style={{ color: '#ea7a53', fontSize: 15, fontWeight: '600', marginBottom: 4 }}
                >
                    Clerk Convex integration
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                    Activate Convex in the Clerk dashboard&apos;s Integrations section. The Convex
                    backend has been configured for this Clerk instance.
                </Text>
            </View>
        </ScrollView>
    );
}

/**
 * Applies the saved theme choice. A separate component so the hook sits inside the Convex
 * provider (it reads user settings) without re-rendering the whole layout on every change.
 */
function ThemeSync() {
    const { themePreference } = useUserSettings();
    useThemePreference(themePreference);
    return null;
}

function RootLayoutContent() {
    const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
    const { isLoading: convexAuthLoading, isAuthenticated: isConvexAuthenticated } =
        useConvexAuth();
    const pathname = usePathname();
    const params = useGlobalSearchParams();
    const previousPathname = useRef<string | undefined>(undefined);
    const previousUserId = useRef<string | undefined>(undefined);

    // Keeps every downstream identity — analytics, crash reports, purchases — pointed at
    // the same Clerk user. Signing out has to reset all three: leaving RevenueCat
    // identified as the previous user meant the next person to sign in on this device
    // inherited their Pro entitlement.
    useEffect(() => {
        if (authLoaded && isSignedIn && userId) {
            if (previousUserId.current !== userId) {
                posthog.identify(userId);
                identifyForMonitoring(userId);
                void identifyPurchaseUser(userId);
                previousUserId.current = userId;
            }
        } else if (authLoaded && !isSignedIn && previousUserId.current) {
            posthog.reset();
            identifyForMonitoring(undefined);
            void resetPurchaseUser();
            previousUserId.current = undefined;
        }
    }, [authLoaded, isSignedIn, userId]);

    // Track screen views
    useEffect(() => {
        if (previousPathname.current !== pathname && authLoaded && isSignedIn) {
            // Only track screens after auth is loaded and user is signed in
            // Filter route params to avoid leaking sensitive data
            const sanitizedParams = Object.keys(params).reduce(
                (acc, key) => {
                    // Only include specific safe params
                    if (['id', 'tab', 'view'].includes(key)) {
                        acc[key] = params[key];
                    }
                    return acc;
                },
                {} as Record<string, string | string[]>,
            );

            posthog.screen(pathname, {
                previous_screen: previousPathname.current ?? null,
                ...sanitizedParams,
            });
            previousPathname.current = pathname;
        }
        // `params` is excluded deliberately. useGlobalSearchParams() returns a fresh
        // object every render, so including it meant this effect body ran on every
        // single render — the ref guard stopped it doing anything, but it still rebuilt
        // the sanitised param map each time. Navigation is what should trigger this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, authLoaded, isSignedIn]);

    const [fontsLoaded] = useFonts({
        'sans-regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
        'sans-bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
        'sans-medium': require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
        'sans-semibold': require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
        'sans-extrabold': require('../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
        'sans-light': require('../assets/fonts/PlusJakartaSans-Light.ttf'),
    });

    useEffect(() => {
        // Hide splash only when both fonts and auth are loaded
        if (fontsLoaded && authLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, authLoaded]);

    // Don't render app until fonts are loaded
    if (!fontsLoaded) return null;

    // Wait for auth to load before making routing decisions
    if (!authLoaded) return null;

    // Clerk can finish restoring a session before Convex has validated its JWT.
    // Do not mount data-fetching routes until that second authentication step is done.
    if (isSignedIn && convexAuthLoading) {
        return <ConvexAuthLoadingScreen />;
    }

    if (isSignedIn && !isConvexAuthenticated) {
        return <ConvexAuthErrorScreen />;
    }

    // Use Stack to render the appropriate layout based on auth state
    // The Stack component itself doesn't cause re-renders like Redirect does
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        </Stack>
    );
}

export default function RootLayout() {
    if (!publishableKey || !convex) {
        return <MissingConfigScreen />;
    }

    return (
        <PostHogProvider
            client={posthog}
            autocapture={{
                captureScreens: false,
                captureTouches: true,
                propsToCapture: ['testID'],
            }}
        >
            <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
                <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                    <ThemeSync />
                    <RootLayoutContent />
                </ConvexProviderWithClerk>
            </ClerkProvider>
        </PostHogProvider>
    );
}
