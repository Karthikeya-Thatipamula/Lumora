import type { Router } from 'expo-router';

export function safeBack(router: Router, fallback: Parameters<Router['replace']>[0] = '/(tabs)') {
    if (router.canGoBack()) {
        router.back();
        return;
    }

    router.replace(fallback);
}
