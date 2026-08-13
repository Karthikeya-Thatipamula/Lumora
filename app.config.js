// `eas init` writes the project id into this file for a static app.json. Because the
// config is JS, it is read from the environment instead so the repo stays portable and
// CI can inject it. Run `eas init` once, then put the id in .env as EAS_PROJECT_ID.
//
// Both keys are omitted entirely when unset rather than emitted as undefined — an
// `updates.url` pointing at "https://u.expo.dev/undefined" fails at runtime instead of
// at config time, which is a far worse way to find out.
const easProjectId = process.env.EAS_PROJECT_ID;
const expoOwner = process.env.EXPO_OWNER;

module.exports = {
    expo: {
        name: 'Lumora',
        slug: 'lumora',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/images/icon.png',
        scheme: 'lumora',
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        ...(expoOwner ? { owner: expoOwner } : {}),

        // eas.json configures EAS Update channels, but without a runtime version policy
        // there is nothing tying a JS bundle to the native build that can run it.
        // `appVersion` means a bundle only reaches builds sharing its `version` above.
        runtimeVersion: { policy: 'appVersion' },
        ...(easProjectId ? { updates: { url: `https://u.expo.dev/${easProjectId}` } } : {}),
        ios: {
            supportsTablet: true,
            bundleIdentifier: 'com.lumora.app',
        },
        android: {
            package: 'com.lumora.app',
            adaptiveIcon: {
                backgroundColor: '#E6F4FE',
                foregroundImage: './assets/images/android-icon-foreground.png',
                backgroundImage: './assets/images/android-icon-background.png',
                monochromeImage: './assets/images/android-icon-monochrome.png',
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
        },
        web: {
            output: 'static',
            favicon: './assets/images/favicon.png',
        },
        plugins: [
            'expo-router',
            [
                'expo-splash-screen',
                {
                    image: './assets/images/splash-icon.png',
                    imageWidth: 200,
                    resizeMode: 'contain',
                    backgroundColor: '#ffffff',
                    dark: {
                        backgroundColor: '#000000',
                    },
                },
            ],
            [
                'expo-font',
                {
                    fonts: [
                        './assets/fonts/PlusJakartaSans-Regular.ttf',
                        './assets/fonts/PlusJakartaSans-Bold.ttf',
                        './assets/fonts/PlusJakartaSans-Medium.ttf',
                        './assets/fonts/PlusJakartaSans-SemiBold.ttf',
                        './assets/fonts/PlusJakartaSans-ExtraBold.ttf',
                        './assets/fonts/PlusJakartaSans-Light.ttf',
                    ],
                },
            ],
            '@clerk/expo',
            'expo-secure-store',
            'expo-localization',
            [
                'expo-notifications',
                {
                    color: '#ea7a53',
                },
            ],
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true,
        },
        extra: {
            ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
            posthogProjectToken: process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN,
            posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
        },
    },
};
