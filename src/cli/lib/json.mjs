import { applyEdits, modify, parse } from 'jsonc-parser';

import { CliError } from './errors.mjs';

/**
 * A managed JSON entry: either an exact value at `path`, or an array at `path` that must
 * include `includes` (other items preserved).
 * @typedef {{ path: string[], value: unknown } | { path: string[], includes: string[] }} JsonEntry
 */

/**
 * @param {string} text
 * @returns {{ insertSpaces: boolean, tabSize: number, eol: string }}
 */
function formatting(text) {
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
  return {
    insertSpaces: !indent.startsWith('\t'),
    tabSize: indent.startsWith('\t') ? 1 : indent.length,
    eol: '\n',
  };
}

/**
 * @param {string} text
 * @param {string} [file] named in the error message
 * @returns {any}
 */
export function parseJsonc(text, file = 'file') {
  /** @type {import('jsonc-parser').ParseError[]} */
  const errors = [];
  const value = parse(text === '' ? '{}' : text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new CliError(
      `${file} is not valid JSON (${errors.length} parse error(s)); fix it and re-run`,
    );
  }
  return value ?? {};
}

/**
 * @param {any} root
 * @param {string[]} path
 */
function getAt(root, path) {
  return path.reduce(
    (node, key) => (node && typeof node === 'object' ? node[key] : undefined),
    root,
  );
}

/**
 * Applies managed entries, preserving comments, formatting and unmanaged keys.
 * @param {string} text LF JSON/JSONC text ('' for a new file)
 * @param {JsonEntry[]} entries
 * @param {string} [file] named in parse errors
 * @returns {string}
 */
export function mergeJson(text, entries, file) {
  let result = text.trim() === '' ? '{}\n' : text;
  for (const entry of entries) {
    const current = getAt(parseJsonc(result, file), entry.path);
    if ('includes' in entry) {
      const items = Array.isArray(current) ? [...current] : [];
      for (const item of entry.includes) {
        if (!items.includes(item)) {
          items.push(item);
        }
      }
      if (!Array.isArray(current) || items.length !== current.length) {
        result = applyEdits(
          result,
          modify(result, entry.path, items, { formattingOptions: formatting(result) }),
        );
      }
    } else if (JSON.stringify(current) !== JSON.stringify(entry.value)) {
      result = applyEdits(
        result,
        modify(result, entry.path, entry.value, { formattingOptions: formatting(result) }),
      );
    }
  }
  return result.endsWith('\n') ? result : `${result}\n`;
}

/**
 * Lists entries the text does not satisfy.
 * @param {string} text
 * @param {JsonEntry[]} entries
 * @param {string} [file] named in parse errors
 * @returns {string[]}
 */
export function diffJson(text, entries, file) {
  const root = parseJsonc(text, file);
  /** @type {string[]} */
  const problems = [];
  for (const entry of entries) {
    const current = getAt(root, entry.path);
    const where = entry.path.join(' > ');
    if ('includes' in entry) {
      const missing = entry.includes.filter(
        (item) => !Array.isArray(current) || !current.includes(item),
      );
      if (missing.length > 0) {
        problems.push(`${where} is missing ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
      }
    } else if (JSON.stringify(current) !== JSON.stringify(entry.value)) {
      problems.push(
        `${where} should be ${JSON.stringify(entry.value)} (found ${JSON.stringify(current)})`,
      );
    }
  }
  return problems;
}
