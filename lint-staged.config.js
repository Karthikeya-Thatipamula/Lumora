/**
 * Tools are invoked as `node <path-to-entrypoint>` rather than by bare name.
 *
 * lint-staged spawns without a shell. On Windows the installed binaries are `.cmd`
 * shims, so both `prettier` and `npx` fail to spawn with ENOENT — the commit is then
 * rejected for a reason that has nothing to do with the code. Pointing at the JS
 * entrypoints works identically on Windows, macOS and Linux CI.
 *
 * This only covers staged files. Whole-project typecheck, the interop guard and the
 * tests run in .husky/pre-push, because a type error introduced in one file by an edit
 * in another is invisible from here.
 */
const prettier = 'node node_modules/prettier/bin/prettier.cjs';
const eslint = 'node node_modules/eslint/bin/eslint.js';

/**
 * `--no-warn-ignored` matters here. lint-staged hands ESLint every staged file by path,
 * including ones the config ignores (convex/_generated/**). ESLint then emits "File
 * ignored because of a matching ignore pattern" as a *warning*, and `--max-warnings 0`
 * turns that into a failed commit for a file nobody was asked to lint.
 *
 * Prettier has the same behaviour, hence `--ignore-unknown`.
 */
module.exports = {
    '*.{ts,tsx,js,jsx,mjs}': [
        `${prettier} --write --ignore-unknown`,
        `${eslint} --max-warnings 0 --no-warn-ignored --fix`,
    ],
    '*.{json,md,yml,yaml,css}': [`${prettier} --write --ignore-unknown`],
};
