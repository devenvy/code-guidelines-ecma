import vitestPlugin from '@vitest/eslint-plugin';

import { JS_FILES, TS_FILES } from '../files.mjs';
import { coreRelaxations, typescriptTestRelaxations } from '../rules/test-relaxations.mjs';
import vitestRules from '../rules/vitest.mjs';

/** Enabled vitest rules that need type information; turned off where there is none. */
const TYPED_VITEST_RULES = Object.entries(vitestPlugin.rules)
  .filter(
    ([name, rule]) =>
      `vitest/${name}` in vitestRules && /** @type {any} */ (rule).meta?.docs?.requiresTypeChecking,
  )
  .map(([name]) => `vitest/${name}`);

/**
 * @param {import('../options.mjs').NormalizedOptions} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function vitest(options) {
  if (!options.vitest) {
    return [];
  }
  const { files } = options.vitest;
  /** @type {import('eslint').Linter.Config[]} */
  const configs = [
    {
      name: 'devenvy/vitest/rules',
      files,
      plugins: { vitest: /** @type {any} */ (vitestPlugin) },
      languageOptions: { globals: vitestPlugin.environments.env.globals },
      rules: { ...vitestRules, ...coreRelaxations },
    },
  ];
  if (options.typescript) {
    configs.push({
      name: 'devenvy/vitest/relaxations',
      files,
      ignores: JS_FILES,
      rules: typescriptTestRelaxations,
    });
  }
  configs.push({
    name: 'devenvy/vitest/untyped',
    files,
    ignores: options.typescript ? TS_FILES : [],
    rules: Object.fromEntries(TYPED_VITEST_RULES.map((rule) => [rule, 'off'])),
  });
  return configs;
}
