import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';

import { JS_FILES, TS_FILES } from '../files.mjs';
import { completePluginRules } from '../rules/complete.mjs';
import importRules from '../rules/imports.mjs';

const BUILTIN_INTERNAL = ['^@devenvy/', '^@/', '^~/'];

/**
 * Import hygiene and ordering. Module resolution (TypeScript resolver, rootDir's tsconfig) is only
 * used by import-x/no-cycle.
 * @param {import('../options.mjs').NormalizedOptions} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function imports(options) {
  const internal = [...BUILTIN_INTERNAL, ...options.internalImports];
  return [
    {
      name: 'devenvy/imports',
      files: options.typescript ? [...JS_FILES, ...TS_FILES] : JS_FILES,
      plugins: { 'import-x': /** @type {any} */ (importX) },
      settings: {
        'import-x/internal-regex': internal.map((source) => `(?:${source})`).join('|'),
        'import-x/resolver-next': [
          createTypeScriptImportResolver({ alwaysTryTypes: true, project: options.rootDir }),
        ],
      },
      rules: /** @type {import('eslint').Linter.RulesRecord} */ ({
        ...completePluginRules(importRules, importX.rules, 'import-x/'),
        'import-x/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],
      }),
    },
  ];
}
