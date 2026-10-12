/** @typedef {(specifier: string) => Promise<any>} ImportModule */

/**
 * Resolves first, then imports the URL: same result as `import(specifier)` in Node, but Vitest's
 * module runner (our tests) cannot resolve a bare dynamic import of a `@vitest/*` package.
 * @type {ImportModule}
 */
const defaultImport = (specifier) => import(import.meta.resolve(specifier));

/**
 * Imports an optional peer dependency's default export. When the peer itself is not installed,
 * throws `missingMessage`; a missing dependency *of* the peer is rethrown as is.
 * @param {string} specifier
 * @param {string} missingMessage
 * @param {ImportModule} [importModule] test seam for dynamic import
 * @returns {Promise<any>}
 */
export async function importPeer(specifier, missingMessage, importModule = defaultImport) {
  try {
    return (await importModule(specifier)).default;
  } catch (error) {
    const { code, message } = /** @type {NodeJS.ErrnoException} */ (error);
    if (code === 'ERR_MODULE_NOT_FOUND' && message.includes(`'${specifier}'`)) {
      throw new Error(missingMessage, { cause: error });
    }
    throw error;
  }
}
