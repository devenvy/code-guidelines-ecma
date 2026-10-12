import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** @typedef {'pnpm' | 'yarn' | 'bun' | 'npm'} PackageManager */

/** Lockfile → package manager, first match wins; npm otherwise. */
const LOCKFILES = /** @type {const} */ ([
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
]);

/**
 * `dir` and its ancestors up to the repository root (the nearest directory with `.git`), nearest
 * first. Outside a repository only `dir` itself, so nothing above the project is ever used.
 * @param {string} dir
 * @returns {string[]}
 */
function projectDirs(dir) {
  const dirs = [];
  let current = path.resolve(dir);
  let parent = path.dirname(current);
  while (!existsSync(path.join(current, '.git')) && parent !== current) {
    dirs.push(current);
    current = parent;
    parent = path.dirname(current);
  }
  return existsSync(path.join(current, '.git')) ? [...dirs, current] : [path.resolve(dir)];
}

/**
 * The nearest lockfile within the repository (a workspace package's lockfile is usually at the
 * workspace root).
 * @param {string} dir
 * @returns {{ packageManager: PackageManager, root: string } | undefined}
 */
function nearestLockfile(dir) {
  for (const current of projectDirs(dir)) {
    const match = LOCKFILES.find(([lockfile]) => existsSync(path.join(current, lockfile)));
    if (match) {
      return { packageManager: match[1], root: current };
    }
  }
  return undefined;
}

/**
 * @param {string} dir
 * @returns {PackageManager}
 */
export function detectPackageManager(dir) {
  return nearestLockfile(dir)?.packageManager ?? 'npm';
}

/**
 * pnpm-workspace.yaml of a pnpm project, relative to `dir`: the nearest existing one within the
 * repository (the workspace's, for a workspace package), else a new one next to the lockfile.
 * `null` when the project does not use pnpm.
 * @param {string} dir
 * @returns {string | null}
 */
export function pnpmWorkspaceFile(dir) {
  const lockfile = nearestLockfile(dir);
  if (lockfile?.packageManager !== 'pnpm') {
    return null;
  }
  const found = projectDirs(dir).find((current) =>
    existsSync(path.join(current, 'pnpm-workspace.yaml')),
  );
  const file = path.join(found ?? lockfile.root, 'pnpm-workspace.yaml');
  return path.relative(dir, file).replaceAll('\\', '/');
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
