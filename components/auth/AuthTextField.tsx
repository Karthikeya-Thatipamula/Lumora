import { useThemeColors } from '@/lib/useThemeColors';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';

interface AuthTextFieldProps extends Omit<TextInputProps, 'onBlur' | 'className'> {
    label: string;
    /** Shown in destructive styling below the field. */
    error?: string | null;
    /** Shown in muted styling when there is no error. */
    hint?: string;
    onBlur?: () => void;
    /** Renders a show/hide toggle and starts masked. */
    secure?: boolean;
}

/**
 * One field implementation for both auth screens: focus ring, error state, and the
 * password reveal toggle. Previously each screen hand-rolled its own and they drifted.
 */
const AuthTextField = ({ label, error, hint, onBlur, secure = false, ...inputProps }: AuthTextFieldProps) => {
    const themeColors = useThemeColors();
    const [isFocused, setIsFocused] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);

    return (
        <View className="auth-field">
            <Text className="auth-label">{label}</Text>

            <View className="relative justify-center">
                <TextInput
                    className={clsx(
                        'auth-input',
                        secure && 'pr-16',
                        isFocused && !error && 'auth-input-focused',
                        error && 'auth-input-error'
                    )}
                    placeholderTextColor={themeColors.placeholder}
                    secureTextEntry={secure && !isRevealed}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        setIsFocused(false);
                        onBlur?.();
                    }}
                    {...inputProps}
                />

                {secure && (
                    <Pressable
                        className="absolute right-4 px-1 py-2"
                        onPress={() => setIsRevealed((revealed) => !revealed)}
                        accessibilityRole="button"
                        accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
                        hitSlop={8}
                    >
                        <Text className="text-xs font-sans-bold uppercase tracking-[0.5px] text-accent">
                            {isRevealed ? 'Hide' : 'Show'}
                        </Text>
                    </Pressable>
                )}
            </View>

            {error ? (
                <Text className="auth-error">{error}</Text>
            ) : hint ? (
                <Text className="auth-helper">{hint}</Text>
            ) : null}
        </View>
    );
};

export default AuthTextField;
