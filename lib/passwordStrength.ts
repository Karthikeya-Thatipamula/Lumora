import { colors } from '@/constants/theme';

export interface PasswordStrength {
    /** 0–4, matching the number of filled segments in the meter. */
    score: number;
    label: string;
    color: string;
}

/**
 * A deliberately simple, offline heuristic — enough to nudge users away from
 * `password1` without pretending to be a real strength estimator. Clerk still
 * enforces the actual policy server-side.
 */
export function describePasswordStrength(password: string): PasswordStrength {
    if (password.length === 0) return { score: 0, label: '', color: colors.mutedForeground };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    // Anything under the minimum can never read as acceptable, whatever it contains.
    if (password.length < 8) {
        return { score: 1, label: 'Too short — 8 characters minimum', color: colors.destructive };
    }

    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const palette = [
        colors.destructive,
        colors.destructive,
        '#e0a72b',
        colors.success,
        colors.success,
    ];

    return { score, label: labels[score], color: palette[score] };
}
