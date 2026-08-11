import { styled } from 'nativewind';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

// NativeWind v5 only auto-maps `className` onto core React Native components.
// Third-party ones — safe-area-context's SafeAreaView included — silently drop the
// prop, so `flex-1` never lands and the view collapses to the inset height, which
// renders as a blank screen. Import this styled wrapper instead of the raw one.
export const SafeAreaView = styled(RNSafeAreaView);
