import { styled } from 'nativewind';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * `className`-aware Reanimated primitives.
 *
 * NativeWind only wires `className` through for components it has registered. Reanimated's
 * `Animated.View`, `Animated.Text` and anything from `createAnimatedComponent` are not on
 * that list, so on web the prop is dropped and the element renders completely unstyled —
 * the same failure that made `SafeAreaView` render blank pages.
 *
 * `styled()` maps `className` onto `style` while preserving whatever animated style is
 * already there (it merges into a style array), and passes `entering` / `exiting` /
 * `layout` straight through. Always use these instead of `Animated.View` when you need a
 * className.
 */
export const AnimatedView = styled(Animated.View);
export const AnimatedText = styled(Animated.Text);
export const AnimatedPressable = styled(Animated.createAnimatedComponent(Pressable));
