import { colors, darkColors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

/** Resolves theme colors for raw style props (charts, native controls) that can't read CSS variables. */
export function useThemeColors() {
    const scheme = useColorScheme();
    return scheme === 'dark' ? darkColors : colors;
}
