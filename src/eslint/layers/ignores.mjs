import { DEFAULT_IGNORES } from '../files.mjs';

/**
 * @param {import('../options.mjs').NormalizedOptions} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function ignores(options) {
  return [{ name: 'devenvy/ignores', ignores: [...DEFAULT_IGNORES, ...options.ignores] }];
}
