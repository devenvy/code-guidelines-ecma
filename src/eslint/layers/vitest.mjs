import { JS_FILES, TS_FILES } from '../files.mjs';
import { importPeer } from '../peer.mjs';
import { completePluginRules } from '../rules/complete.mjs';
import { coreRelaxations, typescriptTestRelaxations } from '../rules/test-relaxations.mjs';
import vitestRules from '../rules/vitest.mjs';

const MISSING_VITEST_PLUGIN =
  'createConfig: vitest requires "@vitest/eslint-plugin". Install it: npm i -D @vitest/eslint-plugin';

/**
 * Vitest rules that need type information; turned off where there is none.
 * @param {any} vitestPlugin
 * @param {import('eslint').Linter.RulesRecord} rules the enabled rules
 * @returns {string[]}
 */
function typedVitestRules(vitestPlugin, rules) {
  return Object.entries(vitestPlugin.rules)
    .filter(
      ([name, rule]) =>
        `vitest/${name}` in rules && /** @type {any} */ (rule).meta?.docs?.requiresTypeChecking,
    )
    .map(([name]) => `vitest/${name}`);
}

/**
 * @param {import('../options.mjs').NormalizedOptions} options
 * @param {{ importModule?: import('../peer.mjs').ImportModule }} [deps] test seam for dynamic import
 * @returns {Promise<import('eslint').Linter.Config[]>}
 */
export async function vitest(options, deps = {}) {
  if (!options.vitest) {
    return [];
  }
  const vitestPlugin = await importPeer(
    '@vitest/eslint-plugin',
    MISSING_VITEST_PLUGIN,
    deps.importModule,
  );
  const { files } = options.vitest;
  const rules = completePluginRules(vitestRules, vitestPlugin.rules, 'vitest/');
  /** @type {import('eslint').Linter.Config[]} */
  const configs = [
    {
      name: 'devenvy/vitest/rules',
      files,
      plugins: { vitest: vitestPlugin },
      languageOptions: { globals: vitestPlugin.environments.env.globals },
      rules: { ...rules, ...coreRelaxations },
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
    rules: Object.fromEntries(typedVitestRules(vitestPlugin, rules).map((rule) => [rule, 'off'])),
  });
  return configs;
}
