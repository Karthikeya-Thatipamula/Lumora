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
export function confirmDialog({ title, message, confirmText, cancelText = 'Cancel', destructive = false }: ConfirmOptions): Promise<boolean> {
    if (Platform.OS === 'web') {
        return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
    }
    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
                { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
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
