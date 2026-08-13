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

module.exports = {
    '*.{ts,tsx,js,jsx,mjs}': [`${prettier} --write`, `${eslint} --max-warnings 0 --fix`],
    '*.{json,md,yml,yaml,css}': [`${prettier} --write`],
};
