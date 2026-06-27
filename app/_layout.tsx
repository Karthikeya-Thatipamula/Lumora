import '@/global.css';
import { posthog } from '@/src/config/posthog';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useRef } from "react";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Add your Clerk Publishable Key to the .env file');
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
    <Stack screenOptions={{ headerShown: false }} />
  );
}

export default function RootLayout() {
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
          <RootLayoutContent />
        </ClerkProvider>
      </PostHogProvider>
  );
}