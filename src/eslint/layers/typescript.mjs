import tseslint from 'typescript-eslint';

import { ROOT_CONFIG_FILES, TS_FILES } from '../files.mjs';
import { typescriptRelaxations } from '../rules/test-relaxations.mjs';
import typescriptRules from '../rules/typescript.mjs';

/**
 * typescript-eslint with type information via the project service.
 * @param {import('../options.mjs').NormalizedOptions} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function typescript(options) {
  if (!options.typescript) {
    return [];
  }
  const disableTypeChecked = /** @type {import('eslint').Linter.Config} */ (
    tseslint.configs.disableTypeChecked
  );
  return [
    {
      name: 'devenvy/typescript/rules',
      files: TS_FILES,
      plugins: { '@typescript-eslint': /** @type {any} */ (tseslint.plugin) },
      languageOptions: {
        parser: /** @type {any} */ (tseslint.parser),
        parserOptions: { projectService: true, tsconfigRootDir: options.rootDir },
      },
      rules: typescriptRules,
    },
    {
      // root tool configs and declared untyped files need not belong to a tsconfig
      ...disableTypeChecked,
      name: 'devenvy/typescript/untyped-files',
      files: [...ROOT_CONFIG_FILES, ...options.untypedFiles],
    },
    {
      name: 'devenvy/typescript/config-files',
      files: ROOT_CONFIG_FILES,
      rules: typescriptRelaxations,
    },
  ];
}
