import { DEFAULT_TEST_FILES } from './files.mjs';

/** ESLint `settings` key holding the options `createConfig` was called with. */
export const OPTIONS_SETTING = 'devenvy/options';

/**
 * @typedef {object} AngularOptions
 * @property {string | string[]} prefix Component/directive selector prefix(es).
 * @property {string[]} [controlComponents] Components that render their own native form control,
 *   for `@angular-eslint/template/label-has-associated-control`.
 */

/**
 * @typedef {object} Options
 * @property {string} rootDir Directory containing the root tsconfig; usually `import.meta.dirname`.
 * @property {'browser' | 'node'} env Globals for source files.
 * @property {boolean} [typescript] Lint TypeScript with type information. Default `true`.
 * @property {string[]} [untypedFiles] TypeScript files outside every tsconfig, linted without type information.
 * @property {boolean | { files?: string[] }} [vitest] Vitest rules for test files. Default `false`.
 * @property {false | AngularOptions} [angular] Angular rules. Default `false`.
 * @property {{ internal?: string[] }} [importOrder] Extra regex sources treated as internal imports.
 * @property {string[]} [ignores] Extra global ignore patterns.
 */

/**
 * @typedef {object} NormalizedOptions
 * @property {string} rootDir
 * @property {'browser' | 'node'} env
 * @property {boolean} typescript
 * @property {string[]} untypedFiles
 * @property {false | { files: string[] }} vitest
 * @property {false | { prefix: string[], controlComponents: string[] }} angular
 * @property {string[]} internalImports
 * @property {string[]} ignores
 */

/**
 * Validates options and fills defaults.
 * @param {Options} options
 * @returns {NormalizedOptions}
 */
export function normalizeOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError(
      'createConfig: options are required, e.g. createConfig({ rootDir: import.meta.dirname, env: "node" })',
    );
  }
  if (typeof options.rootDir !== 'string' || options.rootDir === '') {
    throw new TypeError('createConfig: "rootDir" is required (usually import.meta.dirname)');
  }
  if (options.env !== 'browser' && options.env !== 'node') {
    throw new TypeError('createConfig: "env" must be "browser" or "node"');
  }
  const typescript = options.typescript ?? true;
  const angular = options.angular ?? false;
  /** @type {string[]} */
  let prefix = [];
  if (angular) {
    if (!typescript) {
      throw new TypeError(
        'createConfig: "angular" requires "typescript" (angular-eslint needs the TypeScript parser)',
      );
    }
    prefix = typeof angular.prefix === 'string' ? [angular.prefix] : angular.prefix;
    if (
      !Array.isArray(prefix) ||
      prefix.length === 0 ||
      prefix.some((p) => typeof p !== 'string' || p === '')
    ) {
      throw new TypeError(
        'createConfig: "angular.prefix" is required, e.g. angular: { prefix: "app" }',
      );
    }
  }
  const vitest = options.vitest ?? false;
  if (typeof vitest === 'object' && Array.isArray(vitest.files) && vitest.files.length === 0) {
    throw new TypeError('createConfig: "vitest.files" must not be empty; omit it for the default');
  }
  return {
    rootDir: options.rootDir,
    env: options.env,
    typescript,
    untypedFiles: options.untypedFiles ?? [],
    vitest: vitest
      ? { files: (typeof vitest === 'object' && vitest.files) || DEFAULT_TEST_FILES }
      : false,
    angular: angular ? { prefix, controlComponents: angular.controlComponents ?? [] } : false,
    internalImports: options.importOrder?.internal ?? [],
    ignores: options.ignores ?? [],
  };
}
