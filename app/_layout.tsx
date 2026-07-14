import '@/global.css';
import { configurePurchases } from '@/lib/purchases';
import { posthog } from '@/src/config/posthog';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

const missingConfig: { name: string; fix: string }[] = [
  ...(!publishableKey
    ? [{ name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', fix: 'Get it from the Clerk dashboard → API Keys, then add it to .env' }]
    : []),
  ...(!convexUrl
    ? [{ name: 'EXPO_PUBLIC_CONVEX_URL', fix: 'Run `npx convex dev` — it logs in, links a project, and writes this for you' }]
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
        Lumora can&apos;t start until these environment variables are set. See README.md for full setup steps.
      </Text>
      {missingConfig.map((item) => (
        <View
          key={item.name}
          style={{ backgroundColor: '#131826', borderRadius: 12, padding: 16, marginBottom: 12 }}
        >
          <Text style={{ color: '#ea7a53', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
            {item.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{item.fix}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function RootLayoutContent() {
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);
  const previousUserId = useRef<string | undefined>(undefined);

  // Identify user in PostHog when auth state changes
  useEffect(() => {
    if (authLoaded && isSignedIn && userId) {
      // Only identify if user has changed
      if (previousUserId.current !== userId) {
        posthog.identify(userId);
        console.info(`[PostHog] User identified: ${userId}`);
        configurePurchases(userId);
        previousUserId.current = userId;
      }
    } else if (authLoaded && !isSignedIn && previousUserId.current) {
      // User signed out, reset PostHog
      posthog.reset();
      previousUserId.current = undefined;
      console.info(`[PostHog] User reset after sign out`);
    }
  }, [authLoaded, isSignedIn, userId]);

  // Track screen views
  useEffect(() => {
    if (previousPathname.current !== pathname && authLoaded && isSignedIn) {
      // Only track screens after auth is loaded and user is signed in
      // Filter route params to avoid leaking sensitive data
      const sanitizedParams = Object.keys(params).reduce((acc, key) => {
        // Only include specific safe params
        if (['id', 'tab', 'view'].includes(key)) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as Record<string, string | string[]>);

      posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
        ...sanitizedParams,
      });
      previousPathname.current = pathname;
    }
  }, [pathname, params, authLoaded, isSignedIn]);

  const [fontsLoaded] = useFonts({
    'sans-regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'sans-bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
    'sans-medium': require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'sans-semibold': require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'sans-extrabold': require('../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
    'sans-light': require('../assets/fonts/PlusJakartaSans-Light.ttf')
  })

  useEffect(() => {
    // Hide splash only when both fonts and auth are loaded
    if (fontsLoaded && authLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, authLoaded])

  // Don't render app until fonts are loaded
  if (!fontsLoaded) return null;

  // Wait for auth to load before making routing decisions
  if (!authLoaded) return null;

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
            <RootLayoutContent />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </PostHogProvider>
  );
}