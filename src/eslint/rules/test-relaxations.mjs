/*
 * Rules relaxed inside test files and root tool config files, where literal numbers (ports,
 * timeouts, expected values) are the point and mocks are routinely untyped.
 */
export const coreRelaxations = /** @type {import('eslint').Linter.RulesRecord} */ ({
  'no-magic-numbers': 'off',
});

export const typescriptRelaxations = /** @type {import('eslint').Linter.RulesRecord} */ ({
  '@typescript-eslint/no-magic-numbers': 'off',
});

/** Test files only: mocks and test doubles are routinely untyped. */
export const typescriptTestRelaxations = /** @type {import('eslint').Linter.RulesRecord} */ ({
  ...typescriptRelaxations,
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
});
