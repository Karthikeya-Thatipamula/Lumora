/**
 * Conventional Commits, with the body/footer line limit relaxed.
 *
 * The default 100-character `body-max-line-length` rejects pasted stack traces, long
 * URLs and error strings — exactly the context that makes a commit message worth
 * reading. The subject line stays capped, since that is what shows up in `git log
 * --oneline` and in the PR list.
 */
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'body-max-line-length': [0, 'always'],
        'footer-max-line-length': [0, 'always'],
        'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
        'header-max-length': [2, 'always', 100],
        'type-enum': [
            2,
            'always',
            [
                'build',
                'chore',
                'ci',
                'docs',
                'feat',
                'fix',
                'perf',
                'refactor',
                'revert',
                'style',
                'test',
            ],
        ],
    },
};
