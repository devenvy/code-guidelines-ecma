import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Never searched: dependencies, git internals and the build output the ESLint baseline ignores. */
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.angular', 'out-tsc']);

/**
 * Files under `dir` whose name passes `accept`, as absolute paths.
 * @param {string} dir
 * @param {(name: string) => boolean} accept
 * @returns {string[]}
 */
export function findProjectFiles(dir, accept) {
  /** @type {string[]} */
  const found = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        found.push(...findProjectFiles(full, accept));
      }
    } else if (entry.isFile() && accept(entry.name)) {
      found.push(full);
    }
  }
  return found;
}
