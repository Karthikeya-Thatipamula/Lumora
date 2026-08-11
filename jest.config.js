/**
 * Replaces scripts/test-logic.mjs, which staged copies of the React-free lib modules with
 * their `@/` imports rewritten to local stubs, compiled them with tsc and ran them under
 * plain node. That worked, but it broke whenever an import changed — including when
 * Prettier swapped a quote style. Jest resolves `@/` natively, so the staging goes away.
 */

/** Packages that ship untranspiled ESM and must go through Babel. */
const esmPackages = [
    '(jest-)?react-native',
    '@react-native(-community)?',
    'expo(nent)?',
    '@expo(nent)?/.*',
    '@expo-google-fonts/.*',
    'react-navigation',
    '@react-navigation/.*',
    'native-base',
    'react-native-svg',
    'nativewind',
    'react-native-css',
    'react-native-gifted-charts',
    'react-native-reanimated',
    'react-native-worklets',
    '@clerk/.*',
    'convex',
];

/** @type {import('jest').Config} */
module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [`node_modules/(?!${esmPackages.join('|')})`],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/.maestro/', '/.logic-test-build/'],
    collectCoverageFrom: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.tsx',
        '!**/__tests__/**',
        '!**/*.d.ts',
    ],
};
