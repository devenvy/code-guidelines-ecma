/*
 * @vitest/eslint-plugin rules. Every non-deprecated plugin rule is listed; effective configuration.
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  // -- Assertions --
  // helpers named expect* (e.g. expectValid(...)) count as assertions
  'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
  // assertion counts and expect styles are not limited: max-expects, prefer-expect-assertions,
  // prefer-expect-resolves, prefer-expect-type-of
  'vitest/max-expects': 'off',
  'vitest/no-conditional-expect': 'error',
  'vitest/no-standalone-expect': 'error',
  'vitest/prefer-expect-assertions': 'off',
  'vitest/prefer-expect-resolves': 'off',
  'vitest/prefer-expect-type-of': 'off',
  'vitest/require-awaited-expect-poll': 'error',
  // Vitest accepts a failure message as the second argument: expect(value, message)
  'vitest/valid-expect': ['error', { maxArgs: 2 }],
  'vitest/valid-expect-in-promise': 'error',

  // structure is free-form: nesting depth, conditionals for parametrized cases, top-level describe
  'vitest/max-nested-describe': 'off',
  'vitest/no-commented-out-tests': 'error',
  'vitest/no-conditional-in-test': 'off',
  'vitest/no-conditional-tests': 'error',
  'vitest/no-duplicate-hooks': 'error',
  'vitest/no-test-return-statement': 'error',
  'vitest/require-top-level-describe': 'off',
  'vitest/valid-describe-callback': 'error',
  'vitest/valid-title': 'error',

  // -- Test execution --
  'vitest/no-disabled-tests': 'error',
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/no-test-prefixes': 'error',
  // test.todo is allowed as a placeholder
  'vitest/warn-todo': 'off',
  'vitest/prefer-todo': 'error',

  // -- Async --
  'vitest/no-unneeded-async-expect-function': 'error',
  // the global testTimeout applies
  'vitest/require-test-timeout': 'off',

  'vitest/no-mocks-import': 'error',
  // no-restricted-* rules need a project-specific list
  'vitest/no-restricted-vi-methods': 'off',
  // call-count matcher styles compete with each other; none is enforced
  'vitest/prefer-called-exactly-once-with': 'off',
  'vitest/prefer-called-once': 'off',
  'vitest/prefer-called-times': 'off',
  'vitest/prefer-called-with': 'error',
  // vi.mock(import('./x')) is optional; string paths are fine
  'vitest/prefer-import-in-mock': 'off',
  'vitest/prefer-mock-promise-shorthand': 'error',
  // mockImplementation(() => x) and mockReturnValue(x) are both fine
  'vitest/prefer-mock-return-shorthand': 'off',
  'vitest/prefer-spy-on': 'error',
  'vitest/prefer-vi-mocked': 'error',
  // vi.fn() infers from usage; explicit type parameters are optional
  'vitest/require-mock-type-parameters': 'off',
  'vitest/no-restricted-matchers': 'off',
  // replaces @typescript-eslint/unbound-method in tests (off globally)
  'vitest/unbound-method': 'error',

  // -- Matchers / style --
  'vitest/no-alias-methods': 'error',
  'vitest/prefer-comparison-matcher': 'error',
  'vitest/prefer-equality-matcher': 'error',
  // toBe(true) and toBeTruthy() are both accepted: prefer-strict-boolean-matchers, prefer-to-be-falsy/truthy
  'vitest/prefer-strict-boolean-matchers': 'off',
  // toEqual is the common default; toStrictEqual where undefined properties matter
  'vitest/prefer-strict-equal': 'off',
  'vitest/prefer-to-be': 'error',
  'vitest/prefer-to-be-falsy': 'off',
  'vitest/prefer-to-be-object': 'error',
  'vitest/prefer-to-be-truthy': 'off',
  'vitest/prefer-to-contain': 'error',
  // see prefer-called-exactly-once-with
  'vitest/prefer-to-have-been-called-times': 'off',
  'vitest/prefer-to-have-length': 'error',
  'vitest/require-to-throw-message': 'error',

  // -- Snapshots --
  'vitest/no-interpolation-in-snapshots': 'error',
  // snapshot size and hints are left to review: no-large-snapshots, prefer-snapshot-hint
  'vitest/no-large-snapshots': 'off',
  'vitest/prefer-snapshot-hint': 'off',
  'vitest/require-local-test-context-for-concurrent-snapshots': 'error',

  'vitest/hoisted-apis-on-top': 'error',
  // hooks are fine; require-hook would force all setup into hooks
  'vitest/no-hooks': 'off',
  'vitest/prefer-hooks-in-order': 'error',
  'vitest/prefer-hooks-on-top': 'error',
  'vitest/require-hook': 'off',

  // -- Imports --
  'vitest/no-import-node-test': 'error',
  // globals vs imports follows each project's vitest config (both rules off)
  'vitest/no-importing-vitest-globals': 'off',
  'vitest/prefer-importing-vitest-globals': 'off',

  // naming and parametrization style are free: test/it, filenames, title case, .each
  'vitest/consistent-each-for': 'off',
  'vitest/consistent-test-filename': 'off',
  'vitest/consistent-test-it': 'off',
  'vitest/consistent-vitest-vi': 'error',
  'vitest/prefer-describe-function-title': 'off',
  'vitest/prefer-each': 'off',
  'vitest/prefer-lowercase-title': 'off',

  // blank lines are Prettier's call
  'vitest/padding-around-after-all-blocks': 'off',
  'vitest/padding-around-after-each-blocks': 'off',
  'vitest/padding-around-all': 'off',
  'vitest/padding-around-before-all-blocks': 'off',
  'vitest/padding-around-before-each-blocks': 'off',
  'vitest/padding-around-describe-blocks': 'off',
  'vitest/padding-around-expect-groups': 'off',
  'vitest/padding-around-test-blocks': 'off',
});
