/**
 * Pure easing/interpolation helpers used by the JS-thread count-up animation.
 * Kept out of the component so the maths is unit-testable without a renderer.
 */

/** Standard ease-out cubic: fast start, gentle settle. Input and output are 0–1. */
export function easeOutCubic(t: number): number {
    const clamped = Math.min(1, Math.max(0, t));
    return 1 - Math.pow(1 - clamped, 3);
}

/** Value at `progress` (0–1) along an eased path from `from` to `to`. */
export function interpolateValue(from: number, to: number, progress: number): number {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return to;
    return from + (to - from) * easeOutCubic(progress);
}

/**
 * Whether a change is worth animating. Counting up from 0 to 0.02, or animating a
 * value the user can't perceive changing, is just jitter.
 */
export function shouldAnimateChange(from: number, to: number, minDelta = 0.01): boolean {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return Math.abs(to - from) >= minDelta;
}
