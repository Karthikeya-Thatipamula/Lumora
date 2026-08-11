#!/usr/bin/env node
/**
 * Runs the pure-logic test suite.
 *
 * The modules under test import via the `@/` alias and, in two cases, pull types from a
 * component file that drags in React Native. Rather than add a test runner and a pile of
 * native mocks, this stages copies with those few imports rewritten to local stubs, then
 * compiles with tsc and runs under plain node.
 *
 * Usage: npm run test:logic
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STAGE = join(ROOT, '.logic-test-build');
const SRC = join(STAGE, 'src');

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(SRC, { recursive: true });

/** Modules whose only imports are dayjs or each other — copied verbatim. */
const VERBATIM = [
    ['lib/insights.ts', 'insights.ts'],
    ['lib/csv.ts', 'csv.ts'],
    ['lib/utils.ts', 'utils.ts'],
    ['lib/animation.ts', 'animation.ts'],
    ['constants/theme.ts', 'theme.ts'],
    // Extracted out of the modal component precisely so this suite can import it.
    ['lib/subscriptionTypes.ts', 'subscriptionTypes.ts'],
];

for (const [from, to] of VERBATIM) {
    copyFileSync(join(ROOT, from), join(SRC, to));
}

/** Copies a module with `@/` imports rewritten so it resolves inside the staging dir. */
function stage(from, to, replacements) {
    let source = readFileSync(join(ROOT, from), 'utf8');
    for (const [find, replaceWith] of replacements) {
        if (!source.includes(find)) {
            throw new Error(`${from}: expected to find "${find.slice(0, 60)}…" — the stub is out of date`);
        }
        source = source.replaceAll(find, replaceWith);
    }
    writeFileSync(join(SRC, to), source);
}

stage('lib/passwordStrength.ts', 'passwordStrength.ts', [['@/constants/theme', './theme']]);
stage('lib/subscriptionFilters.ts', 'subscriptionFilters.ts', [['@/lib/insights', './insights']]);

// The icon map is a table of PNG requires; only the resolution logic is under test.
stage('lib/icon-resolver.ts', 'icon-resolver.ts', [
    [
        'import { icons, IconKey } from "@/constants/icons";',
        `const icons = {
    home: 1, wallet: 1, setting: 1, activity: 1, add: 1, back: 1, menu: 1, plus: 1,
    notion: 1, dropbox: 1, openai: 1, adobe: 1, medium: 1, figma: 1, spotify: 1,
    github: 1, claude: 1, canva: 1,
} as const;
type IconKey = keyof typeof icons;`,
    ],
]);

stage('constants/catalog.ts', 'catalog.ts', [
    ["import type { Category } from '@/lib/subscriptionTypes';", "import type { Category } from './subscriptionTypes';"],
    ["import type { IconKey } from '@/constants/icons';", 'type IconKey = string;'],
]);

stage('lib/discovery.ts', 'discovery.ts', [['@/constants/catalog', './catalog']]);

stage('lib/csvImport.ts', 'csvImport.ts', [
    ["@/lib/subscriptionTypes", "./subscriptionTypes"],
    ["@/lib/currency", "./currency"],
]);

// currency reads the device locale via expo-localization; only the pure helpers are tested.
stage('lib/currency.ts', 'currency.ts', [
    [
        "import * as Localization from 'expo-localization';",
        "const Localization = { getLocales: () => [{ currencyCode: 'USD' }] };",
    ],
]);

copyFileSync(join(ROOT, 'scripts/logic-tests/run.ts'), join(STAGE, 'run.ts'));
copyFileSync(join(ROOT, 'type.d.ts'), join(STAGE, 'type.d.ts'));

const tscArgs = [
    'tsc',
    join(STAGE, 'run.ts'),
    join(STAGE, 'type.d.ts'),
    '--outDir', join(STAGE, 'out'),
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--strict',
];

try {
    execFileSync('npx', tscArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
    execFileSync('node', [join(STAGE, 'out', 'run.js')], { stdio: 'inherit' });
} finally {
    rmSync(STAGE, { recursive: true, force: true });
}
