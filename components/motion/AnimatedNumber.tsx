import { interpolateValue, shouldAnimateChange } from '@/lib/animation';
import { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface AnimatedNumberProps extends Omit<TextProps, 'children'> {
    value: number;
    /** Renders the in-flight value. Usually `formatCurrency`. */
    format: (value: number) => string;
    durationMs?: number;
}

/**
 * Counts up to `value` when it changes. Driven on the JS thread with rAF rather than
 * a Reanimated worklet: formatting the in-flight number needs `Intl`, which isn't
 * available on the UI thread, and one lightweight interpolation is imperceptible next
 * to the win of a headline figure that visibly lands.
 */
const AnimatedNumber = ({ value, format, durationMs = 650, ...textProps }: AnimatedNumberProps) => {
    const [displayValue, setDisplayValue] = useState(value);
    const frameRef = useRef<number | null>(null);
    const fromRef = useRef(value);

    useEffect(() => {
        const from = fromRef.current;

        if (!shouldAnimateChange(from, value)) {
            fromRef.current = value;
            setDisplayValue(value);
            return;
        }

        const start = Date.now();

        const step = () => {
            const progress = Math.min(1, (Date.now() - start) / durationMs);
            setDisplayValue(interpolateValue(from, value, progress));

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(step);
            } else {
                fromRef.current = value;
            }
        };

        frameRef.current = requestAnimationFrame(step);

        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            // Land on the target so an interrupted run never leaves a stale figure.
            fromRef.current = value;
        };
    }, [value, durationMs]);

    return <Text {...textProps}>{format(displayValue)}</Text>;
};

export default AnimatedNumber;
