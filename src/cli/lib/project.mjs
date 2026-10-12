import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** @typedef {'pnpm' | 'yarn' | 'bun' | 'npm'} PackageManager */

/** Lockfile → package manager, first match wins; npm otherwise. */
const LOCKFILES = /** @type {const} */ ([
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
]);

/**
 * @param {string} dir
 * @returns {PackageManager}
 */
export function detectPackageManager(dir) {
  return LOCKFILES.find(([lockfile]) => existsSync(path.join(dir, lockfile)))?.[1] ?? 'npm';
}

/**
 * @param {PackageManager} packageManager
 * @param {string[]} packages
 */
export function installCommand(packageManager, packages) {
  const add = { pnpm: 'pnpm add -D', yarn: 'yarn add -D', bun: 'bun add -d', npm: 'npm i -D' };
  return `${add[packageManager]} ${packages.join(' ')}`;
}

/**
 * Packages from `names` not installed in a node_modules folder at or above `dir`. Walks the
 * folders itself: require.resolve would also search NODE_PATH, which pnpm sets for scripts.
 * @param {string} dir
 * @param {string[]} names
 * @returns {string[]}
 */
export function missingPackages(dir, names) {
  return names.filter((name) => {
    for (let current = path.resolve(dir); ; current = path.dirname(current)) {
      if (existsSync(path.join(current, 'node_modules', name, 'package.json'))) {
        return false;
      }
      if (path.dirname(current) === current) {
        return true;
      }
    }
  });
}

/**
 * Files in `dir` (non-recursive) whose names match `pattern`.
 * @param {string} dir
 * @param {RegExp} pattern
 * @returns {string[]}
 */
export function findFiles(dir, pattern) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => pattern.test(name))
        .sort()
    : [];
}

export const ESLINT_CONFIG_FILES = /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/;
export const LEGACY_ESLINT_FILES = /^\.eslintrc(\..+)?$/;
export const PRETTIER_CONFIG_FILES =
  /^(\.prettierrc(\..+)?|prettier\.config\.(js|mjs|cjs|ts|mts|cts))$/;
