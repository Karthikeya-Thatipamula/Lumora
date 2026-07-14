export const colors = {
    background: "#fff9e3",
    foreground: "#081126",
    card: "#fff8e7",
    muted: "#f6eecf",
    mutedForeground: "rgba(0, 0, 0, 0.6)",
    primary: "#081126",
    accent: "#ea7a53",
    border: "rgba(0, 0, 0, 0.1)",
    success: "#16a34a",
    destructive: "#dc2626",
    subscription: "#8fd1bd",
    placeholder: "rgba(0, 0, 0, 0.4)",
} as const;

// Keep in sync with the `@media (prefers-color-scheme: dark)` block in global.css —
// that block drives NativeWind's `bg-*`/`text-*` classes, this drives raw style props
// (chart libraries, the tab bar, native controls) that can't consume CSS variables.
export const darkColors: Record<keyof typeof colors, string> = {
    background: "#0b0f1a",
    foreground: "#f5f5f0",
    card: "#131826",
    muted: "#1c2436",
    mutedForeground: "rgba(255, 255, 255, 0.6)",
    primary: "#f5f5f0",
    accent: "#ea7a53",
    border: "rgba(255, 255, 255, 0.12)",
    success: "#22c55e",
    destructive: "#f87171",
    subscription: "#2a4a42",
    placeholder: "rgba(255, 255, 255, 0.4)",
} as const;

export const spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    18: 72,
    20: 80,
    24: 96,
    30: 120,
} as const;

export const components = {
    tabBar: {
        height: spacing[18],
        horizontalInset: spacing[5],
        radius: spacing[8],
        iconFrame: spacing[12],
        itemPaddingVertical: spacing[2],
    },
} as const;

export const theme = {
    colors,
    spacing,
    components,
} as const;