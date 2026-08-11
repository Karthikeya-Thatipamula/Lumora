import type { ThemePreference } from '@/lib/useUserSettings';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

/**
 * Applies the user's theme choice to the whole app.
 *
 * `Appearance.setColorScheme` is what both React Native's `useColorScheme` and NativeWind's
 * runtime read, so overriding it here flips every themed surface at once — no parallel
 * theme context to keep in sync, and no risk of the two disagreeing. Passing `null`
 * hands control back to the OS.
 */
export function useThemePreference(preference: ThemePreference) {
    useEffect(() => {
        try {
            Appearance.setColorScheme(preference === 'system' ? null : preference);
        } catch (error) {
            // Older runtimes and web may not implement the setter. Falling back to the
            // system scheme is a cosmetic loss, never a crash.
            console.warn('Could not apply theme preference:', error);
        }
    }, [preference]);
}
