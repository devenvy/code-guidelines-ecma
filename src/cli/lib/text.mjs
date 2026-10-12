import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * @param {string} text
 * @returns {'\r\n' | '\n'}
 */
export function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * @param {string} text
 * @returns {string}
 */
export function toLf(text) {
  return text.replaceAll('\r\n', '\n');
}

/**
 * Reads a file as LF text, remembering its original line ending.
 * @param {string} file
 * @returns {{ exists: boolean, text: string, eol: '\r\n' | '\n' }}
 */
export function readText(file) {
  if (!existsSync(file)) {
    return { exists: false, text: '', eol: '\n' };
  }
  const raw = readFileSync(file, 'utf8');
  return { exists: true, text: toLf(raw), eol: detectEol(raw) };
}

/**
 * Writes LF text using the given line ending.
 * @param {string} file
 * @param {string} text LF text
 * @param {'\r\n' | '\n'} [eol]
 */
export function writeText(file, text, eol = '\n') {
  writeFileSync(file, eol === '\n' ? text : text.replaceAll('\n', eol));
}

/**
 * Minimal line diff (LCS) for drift reports.
 * @param {string} expected
 * @param {string} actual
 * @returns {string}
 */
export function lineDiff(expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const width = b.length + 1;
  const lengths = new Array((a.length + 1) * width).fill(0);
  /** Longest common subsequence length of a[i..] and b[j..]. */
  const lcs = (/** @type {number} */ i, /** @type {number} */ j) => lengths[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        a[i] === b[j] ? lcs(i + 1, j + 1) + 1 : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (lcs(i + 1, j) >= lcs(i, j + 1)) {
      lines.push(`- ${a[i]}`);
      i += 1;
    } else {
      lines.push(`+ ${b[j]}`);
      j += 1;
    }
  }
  lines.push(...a.slice(i).map((line) => `- ${line}`), ...b.slice(j).map((line) => `+ ${line}`));
  return lines.join('\n');
}
