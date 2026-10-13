import { builtinRules } from 'eslint/use-at-your-own-risk';
import globals from 'globals';

import { JS_FILES, ROOT_CONFIG_FILES, TS_FILES } from '../files.mjs';
import { completePluginRules } from '../rules/complete.mjs';
import javascriptRules from '../rules/javascript.mjs';
import { coreRelaxations } from '../rules/test-relaxations.mjs';

/**
 * Core ESLint rules for JS (and TS, when enabled).
 * @param {import('../options.mjs').NormalizedOptions} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function javascript(options) {
  /** @type {import('eslint').Linter.Config[]} */
  const configs = [
    {
      name: 'devenvy/javascript/rules',
      files: options.typescript ? [...JS_FILES, ...TS_FILES] : JS_FILES,
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: options.env === 'node' ? globals.node : globals.browser,
      },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: completePluginRules(javascriptRules, Object.fromEntries(builtinRules), ''),
    },
    {
      name: 'devenvy/javascript/commonjs',
      files: ['**/*.cjs'],
      languageOptions: { sourceType: 'commonjs', globals: globals.node },
    },
    {
      name: 'devenvy/javascript/config-files',
      files: ROOT_CONFIG_FILES,
      languageOptions: { globals: globals.node },
      rules: coreRelaxations,
    },
  ];
  if (options.typescript) {
    configs.push({
      name: 'devenvy/javascript/typescript-files',
      files: TS_FILES,
      // the compiler reports undefined identifiers in TypeScript
      rules: { 'no-undef': 'off' },
    });
  }
  return configs;
}
