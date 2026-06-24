const baseConfig = require('../../eslint.config.cjs');

// All rules that require TypeScript type information (requiresTypeChecking: true).
// These cannot run with project: false, so we disable them here.
// Type correctness is enforced by tsc --noEmit in CI instead.
const TYPE_AWARE_RULES_OFF = Object.fromEntries(
  [
    '@typescript-eslint/await-thenable',
    '@typescript-eslint/consistent-return',
    '@typescript-eslint/consistent-type-exports',
    '@typescript-eslint/dot-notation',
    '@typescript-eslint/naming-convention',
    '@typescript-eslint/no-array-delete',
    '@typescript-eslint/no-base-to-string',
    '@typescript-eslint/no-confusing-void-expression',
    '@typescript-eslint/no-deprecated',
    '@typescript-eslint/no-duplicate-type-constituents',
    '@typescript-eslint/no-floating-promises',
    '@typescript-eslint/no-for-in-array',
    '@typescript-eslint/no-implied-eval',
    '@typescript-eslint/no-meaningless-void-operator',
    '@typescript-eslint/no-misused-promises',
    '@typescript-eslint/no-misused-spread',
    '@typescript-eslint/no-mixed-enums',
    '@typescript-eslint/no-redundant-type-constituents',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare',
    '@typescript-eslint/no-unnecessary-condition',
    '@typescript-eslint/no-unnecessary-qualifier',
    '@typescript-eslint/no-unnecessary-template-expression',
    '@typescript-eslint/no-unnecessary-type-arguments',
    '@typescript-eslint/no-unnecessary-type-assertion',
    '@typescript-eslint/no-unnecessary-type-conversion',
    '@typescript-eslint/no-unnecessary-type-parameters',
    '@typescript-eslint/no-unsafe-argument',
    '@typescript-eslint/no-unsafe-assignment',
    '@typescript-eslint/no-unsafe-call',
    '@typescript-eslint/no-unsafe-enum-comparison',
    '@typescript-eslint/no-unsafe-member-access',
    '@typescript-eslint/no-unsafe-return',
    '@typescript-eslint/no-unsafe-type-assertion',
    '@typescript-eslint/no-unsafe-unary-minus',
    '@typescript-eslint/non-nullable-type-assertion-style',
    '@typescript-eslint/only-throw-error',
    '@typescript-eslint/prefer-destructuring',
    '@typescript-eslint/prefer-find',
    '@typescript-eslint/prefer-includes',
    '@typescript-eslint/prefer-nullish-coalescing',
    '@typescript-eslint/prefer-optional-chain',
    '@typescript-eslint/prefer-promise-reject-errors',
    '@typescript-eslint/prefer-readonly',
    '@typescript-eslint/prefer-readonly-parameter-types',
    '@typescript-eslint/prefer-reduce-type-parameter',
    '@typescript-eslint/prefer-regexp-exec',
    '@typescript-eslint/prefer-return-this-type',
    '@typescript-eslint/prefer-string-starts-ends-with',
    '@typescript-eslint/promise-function-async',
    '@typescript-eslint/related-getter-setter-pairs',
    '@typescript-eslint/require-array-sort-compare',
    '@typescript-eslint/require-await',
    '@typescript-eslint/restrict-plus-operands',
    '@typescript-eslint/restrict-template-expressions',
    '@typescript-eslint/return-await',
    '@typescript-eslint/strict-boolean-expressions',
    '@typescript-eslint/switch-exhaustiveness-check',
    '@typescript-eslint/unbound-method',
    '@typescript-eslint/use-unknown-in-catch-callback-variable'
  ].map((rule) => [rule, 'off'])
);

module.exports = [
  {
    ignores: ['**/dist']
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parserOptions: {
        project: false
      }
    },
    rules: {
      ...TYPE_AWARE_RULES_OFF
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {}
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {}
  }
];
