import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    destructive?: boolean;
}

// Alert.alert is a silent no-op on react-native-web, which turns confirmation
// flows (delete, cancel, paywall prompt) into dead buttons there — fall back to
// the browser's native dialogs on web.

/** Cross-platform confirmation dialog. Resolves true if the user confirmed. */
export function confirmDialog({
    title,
    message,
    confirmText,
    cancelText = 'Cancel',
    destructive = false,
}: ConfirmOptions): Promise<boolean> {
    if (Platform.OS === 'web') {
        return Promise.resolve(
            typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`),
        );
    }
    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
                {
                    text: confirmText,
                    style: destructive ? 'destructive' : 'default',
                    onPress: () => resolve(true),
                },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
        );
    });
}

/** Cross-platform informational alert. */
export function alertDialog(title: string, message: string): void {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
        return;
    }
    Alert.alert(title, message);
}

/**
 * Every mutation in the app can fail the same way: Convex refuses the write because the
 * Clerk session has not finished being exchanged. This is the one thing the user can
 * usefully do about it, and it had been written out at fifteen separate call sites.
 */
export const RETRY_WHEN_LOADED = 'Please try again once your account is fully loaded.';

/**
 * Confirms deleting a subscription.
 *
 * The same title, wording and destructive styling were duplicated across the home list,
 * the subscriptions list and the detail screen. Deletion is irreversible, so the three
 * entry points drifting apart on how clearly they say that is a real risk.
 */
export function confirmDeleteSubscription(name: string): Promise<boolean> {
    return confirmDialog({
        title: 'Delete subscription?',
        message: `This permanently removes ${name} and its history. This can't be undone.`,
        confirmText: 'Delete',
        destructive: true,
    });
}
