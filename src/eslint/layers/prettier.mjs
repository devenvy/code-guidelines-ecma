import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * Turns off rules that conflict with Prettier, then re-enables the ones eslint-config-prettier
 * documents as safe alongside Prettier.
 * @returns {import('eslint').Linter.Config[]}
 */
export function prettier() {
  return [
    { ...eslintConfigPrettier, name: 'devenvy/prettier' },
    { name: 'devenvy/prettier/re-enabled', rules: { curly: ['error', 'all'] } },
  ];
}
