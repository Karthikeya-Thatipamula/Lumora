const appJson = require('./app.json')

export default {
    expo: {
        ...appJson.expo,
        extra: {
            ...(appJson.expo?.extra || {}),
            posthogProjectToken: process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN,
            posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
        },
    },
}