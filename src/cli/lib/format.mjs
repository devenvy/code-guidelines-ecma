import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Formats files the CLI wrote with the project's own Prettier and config, so a fresh `init`
 * passes `prettier --check`. Skipped when the project has no Prettier installed yet.
 *
 * Never throws: files are already written by the time this runs, so a Prettier failure (for
 * example a config that cannot be resolved yet) becomes a warning instead of a half-finished run.
 * @param {string} dir
 * @param {string[]} files paths relative to `dir`
 * @returns {Promise<string[]>} warnings
 */
export async function formatWritten(dir, files) {
  const prettier = await loadPrettier(dir);
  if (!prettier) {
    return [];
  }
  /** @type {string[]} */
  const failed = [];
  for (const file of files) {
    try {
      await formatFile(prettier, dir, file);
    } catch {
      failed.push(file);
    }
  }
  return failed.length === 0
    ? []
    : [`Could not format ${failed.join(', ')} with Prettier; run: prettier --write .`];
}

/**
 * @param {typeof import('prettier')} prettier
 * @param {string} dir
 * @param {string} file
 */
async function formatFile(prettier, dir, file) {
  const absolute = path.join(dir, file);
  // the project's ignore files, as the Prettier CLI uses them (not the process cwd's)
  const info = await prettier.getFileInfo(absolute, {
    ignorePath: [path.join(dir, '.gitignore'), path.join(dir, '.prettierignore')],
    resolveConfig: false,
  });
  if (info.ignored || !info.inferredParser) {
    return;
  }
  const source = readFileSync(absolute, 'utf8');
  const options = (await prettier.resolveConfig(absolute)) ?? {};
  const formatted = await prettier.format(source, { ...options, filepath: absolute });
  if (formatted !== source) {
    writeFileSync(absolute, formatted);
  }
}

/**
 * @param {string} dir
 * @returns {Promise<typeof import('prettier') | null>}
 */
async function loadPrettier(dir) {
  try {
    // require.resolve finds Prettier's CommonJS entry, whose API is the default export
    const entry = createRequire(path.join(dir, 'package.json')).resolve('prettier');
    const module = await import(pathToFileURL(entry).href);
    return module.default ?? module;
  } catch {
    return null;
  }
}
