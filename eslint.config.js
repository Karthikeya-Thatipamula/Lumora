// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const convexPlugin = require('@convex-dev/eslint-plugin');

const noClassNameOnUnregistered = require('./eslint-rules/no-classname-on-unregistered');

/**
 * Layer rule. Dependencies point one way only:
 *
 *   convex/  ->  (nothing in the app)
 *   constants/  ->  convex/
 *   lib/  ->  constants/, convex/
 *   components/  ->  lib/, constants/, convex/
 *   app/  ->  anything below
 *
 * `target` is where the restriction applies; `from` is what it may not reach for.
 */
const layerZones = [
    { target: './components', from: './app' },
    { target: './lib', from: './app' },
    { target: './lib', from: './components' },
    { target: './constants', from: './app' },
    { target: './constants', from: './components' },
    { target: './convex', from: './app' },
    { target: './convex', from: './components' },
    { target: './convex', from: './lib' },
    { target: './convex', from: './constants' },
].map((zone) => ({
    ...zone,
    message: `${zone.target} may not import from ${zone.from} — see docs/ARCHITECTURE.md for the layer rule.`,
}));

module.exports = defineConfig([
    {
        // Generated, vendored, or build-staging output. `scripts/logic-tests` imports
        // `./src/*` paths that only exist while `test-logic.mjs` is mid-run, which is why
        // `npx eslint .` used to report 9 unresolved-import errors on a clean tree.
        ignores: [
            'dist/*',
            '.expo/**',
            'convex/_generated/**',
            'scripts/logic-tests/**',
            '.logic-test-build/**',
            'node_modules/**',
        ],
    },

    expoConfig,

    {
        plugins: {
            lumora: { rules: { 'no-classname-on-unregistered': noClassNameOnUnregistered } },
        },
        rules: {
            'lumora/no-classname-on-unregistered': 'error',

            // console.info and console.log ship to production. Diagnostics that matter
            // belong in warn/error; anything else belongs in PostHog.
            'no-console': ['error', { allow: ['warn', 'error'] }],

            'import/no-restricted-paths': ['error', { zones: layerZones }],

            // The modal used to re-export the whole subscription vocabulary, so a chart
            // component ended up importing its colour palette from a modal. The canonical
            // home is @/lib/subscriptionTypes.
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@/components/CreateSubscriptionModal',
                            importNames: [
                                'CATEGORIES',
                                'CATEGORY_COLORS',
                                'DEFAULT_TRIAL_LENGTH',
                                'HOUSEHOLD_OPTIONS',
                                'MAX_NAME_LENGTH',
                                'MAX_PRICE',
                                'TRIAL_LENGTH_OPTIONS',
                                'Category',
                                'Frequency',
                                'SubscriptionFormValues',
                            ],
                            message:
                                'Import the subscription vocabulary from @/lib/subscriptionTypes, not from the modal.',
                        },
                    ],
                },
            ],
        },
    },

    {
        // The sanctioned styled() wrappers are where className interop is established.
        files: ['components/SafeAreaView.tsx', 'components/motion/Animated.tsx'],
        rules: { 'lumora/no-classname-on-unregistered': 'off' },
    },

    {
        files: ['convex/**/*.ts'],
        plugins: { '@convex-dev': convexPlugin },
        rules: {
            '@convex-dev/no-old-registered-function-syntax': 'error',
            '@convex-dev/require-args-validator': 'error',
            '@convex-dev/explicit-table-ids': 'error',
            '@convex-dev/no-filter-in-query': 'error',
            '@convex-dev/no-collect-in-query': 'warn',
            '@convex-dev/no-top-of-hour-crons': 'warn',
        },
    },

    {
        // Build scripts are Node, not React Native, and reporting progress is their job.
        files: ['scripts/**/*.mjs', 'eslint-rules/**/*.js', '*.config.js', '*.config.mjs'],
        rules: { 'no-console': 'off' },
    },

    // Must stay last: turns off every stylistic rule Prettier owns.
    prettierConfig,
]);
