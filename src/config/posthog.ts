import Constants from 'expo-constants'
import PostHog from 'posthog-react-native'

// Get PostHog configuration from environment variables
// EXPO_PUBLIC_ prefixed variables are automatically available to Expo apps
const apiKey = (process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN || Constants.expoConfig?.extra?.posthogProjectToken) as string | undefined
const host = (process.env.EXPO_PUBLIC_POSTHOG_HOST || Constants.expoConfig?.extra?.posthogHost) as string | undefined

// Validate configuration
const isPostHogConfigured = !!(
    apiKey && 
    apiKey.trim() !== '' && 
    apiKey !== 'phc_your_project_token_here' && 
    apiKey !== 'placeholder_key'
)

// Log configuration status for debugging
if (!isPostHogConfigured) {
    console.warn(
        '[PostHog] Analytics disabled - Project token not configured. ' +
        'Ensure EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is set in your .env file.'
    )
} else {
    console.info(
        `[PostHog] Analytics enabled with token: ${apiKey.slice(0, 10)}... ` +
        `(Host: ${host || 'default'})`
    )
}

export const posthog = new PostHog(apiKey || 'placeholder_key', {
    ...(host ? { host } : {}),
    disabled: !isPostHogConfigured,
    captureAppLifecycleEvents: true,
    flushAt: 20,
    flushInterval: 10000,
    maxBatchSize: 100,
    maxQueueSize: 1000,
    preloadFeatureFlags: true,
    sendFeatureFlagEvent: true,
    featureFlagsRequestTimeoutMs: 10000,
    requestTimeout: 10000,
    fetchRetryCount: 3,
    fetchRetryDelay: 3000,
})