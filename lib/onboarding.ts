import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const HAS_ONBOARDED_KEY = 'lumora_has_onboarded';

// SecureStore has no web implementation (its native module methods are undefined there),
// so fall back to localStorage on web. Neither function may ever reject: the (auth)
// layout blocks rendering on the flag, and onboarding awaits the setter before navigating.

export async function getHasOnboarded(): Promise<boolean> {
    try {
        if (Platform.OS === 'web') {
            return typeof localStorage !== 'undefined' && localStorage.getItem(HAS_ONBOARDED_KEY) === 'true';
        }
        const value = await SecureStore.getItemAsync(HAS_ONBOARDED_KEY);
        return value === 'true';
    } catch {
        // Fail open: never trap a returning user in onboarding over a storage error.
        return true;
    }
}

export async function setHasOnboarded(): Promise<void> {
    try {
        if (Platform.OS === 'web') {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(HAS_ONBOARDED_KEY, 'true');
            }
            return;
        }
        await SecureStore.setItemAsync(HAS_ONBOARDED_KEY, 'true');
    } catch {
        // Best effort — worst case onboarding shows again next launch.
    }
}
