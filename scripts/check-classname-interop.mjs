#!/usr/bin/env node
/**
 * Guards the single sharpest edge in this codebase.
 *
 * NativeWind only wires `className` through for components it has registered — the core
 * React Native set. Pass `className` to anything else (safe-area-context's SafeAreaView,
 * Reanimated's Animated.View, a raw createAnimatedComponent) and the prop is silently
 * dropped: no error, no warning, the element just renders unstyled. That has already cost
 * this project two rounds of "blank page" and "unreadable text" bugs.
 *
 * Run: node scripts/check-classname-interop.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const FORBIDDEN = [
    {
        pattern: /<Animated\.(View|Text|ScrollView|Image|FlatList)\b[^>]*\bclassName=/s,
        message:
            'Animated.* with className — import { AnimatedView, AnimatedText } from "@/components/motion/Animated" instead.',
    },
    {
        pattern:
            /from ['"]react-native-safe-area-context['"][\s\S]{0,200}?<SafeAreaView\b[^>]*\bclassName=/,
        message:
            'Raw SafeAreaView with className — import { SafeAreaView } from "@/components/SafeAreaView" instead.',
    },
    {
        pattern: /createAnimatedComponent\([^)]*\)[\s\S]{0,400}?\bclassName=/,
        message: 'createAnimatedComponent result used with className — wrap it in styled() first.',
    },
];

/** Recursively collects .tsx files under the given roots. */
function collect(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full, out);
        else if (entry.endsWith('.tsx'))
            out.push(relative(process.cwd(), full).split('\\').join('/'));
    }
    return out;
}

const files = [...collect('app'), ...collect('components')];
let failures = 0;

for (const file of files) {
    // The styled wrappers themselves are the sanctioned exception.
    if (
        file.endsWith('components/motion/Animated.tsx') ||
        file.endsWith('components/SafeAreaView.tsx')
    )
        continue;

    const source = readFileSync(file, 'utf8');
    for (const { pattern, message } of FORBIDDEN) {
        if (pattern.test(source)) {
            console.error(`✗ ${file}\n  ${message}\n`);
            failures += 1;
        }
    }
}

if (failures > 0) {
    console.error(`${failures} className-interop problem(s) found.`);
    process.exit(1);
}

console.log(`✓ className interop clean across ${files.length} files`);
