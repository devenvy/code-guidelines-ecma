import { angular } from './layers/angular.mjs';
import { ignores } from './layers/ignores.mjs';
import { imports } from './layers/imports.mjs';
import { javascript } from './layers/javascript.mjs';
import { prettier } from './layers/prettier.mjs';
import { typescript } from './layers/typescript.mjs';
import { vitest } from './layers/vitest.mjs';
import { normalizeOptions } from './options.mjs';

export { angular, ignores, imports, javascript, normalizeOptions, prettier, typescript, vitest };

/** @typedef {import('./options.mjs').Options} Options */
/** @typedef {import('eslint').Linter.Config} Config */

/**
 * Builds the DevEnvy ESLint flat config.
 *
 * @example
 * // eslint.config.mjs
 * import { createConfig } from '@devenvy/code-guidelines/eslint';
 * export default createConfig({ rootDir: import.meta.dirname, env: 'node', vitest: true });
 *
 * @param {Options} options
 * @param {...(Config | Config[])} overrides Extra configs appended last.
 * @returns {Promise<Config[]>}
 */
export async function createConfig(options, ...overrides) {
  const normalized = normalizeOptions(options);
  return [
    ...ignores(normalized),
    ...javascript(normalized),
    ...(await typescript(normalized)),
    ...imports(normalized),
    ...(await angular(normalized)),
    ...(await vitest(normalized)),
    ...prettier(),
    ...overrides.flat(),
  ];
}
