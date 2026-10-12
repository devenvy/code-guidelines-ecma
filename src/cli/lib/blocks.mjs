import { CliError } from './errors.mjs';

export const BLOCK_START = '# >>> @devenvy/code-guidelines >>>';
export const BLOCK_END = '# <<< @devenvy/code-guidelines <<<';

/**
 * Returns the managed block's content (without markers), or null if absent.
 * @param {string} text LF text
 * @returns {string | null}
 */
export function extractBlock(text) {
  const start = text.indexOf(`${BLOCK_START}\n`);
  const end = text.indexOf(BLOCK_END, start);
  if (start === -1 || end === -1) {
    return null;
  }
  return text.slice(start + BLOCK_START.length + 1, end);
}

/**
 * Inserts or replaces the managed block. Content outside the markers is preserved.
 *
 * New blocks go after a line matching `after` (when given and present), otherwise at the start
 * or end of the file per `position`.
 * @param {string} text LF text
 * @param {string} content block content, LF, ending with a newline
 * @param {{ position: 'start' | 'end', after?: RegExp }} placement
 * @param {string} [file] named in errors
 * @returns {string}
 */
export function upsertBlock(text, content, placement, file = 'file') {
  const block = `${BLOCK_START}\n${content}${BLOCK_END}\n`;
  const start = text.indexOf(`${BLOCK_START}\n`);
  const end = start === -1 ? -1 : text.indexOf(BLOCK_END, start);
  // a hand-edited file with only one marker: refuse rather than add a second block
  if ((start === -1) !== (end === -1) || (start === -1 && text.includes(BLOCK_END))) {
    throw new CliError(
      `${file} has an incomplete @devenvy/code-guidelines block (one marker is missing); remove the leftover marker and re-run`,
    );
  }
  if (start !== -1 && end !== -1) {
    const afterEnd = text.indexOf('\n', end);
    return text.slice(0, start) + block + (afterEnd === -1 ? '' : text.slice(afterEnd + 1));
  }
  if (placement.after) {
    const match = placement.after.exec(text);
    if (match) {
      const lineEnd = text.indexOf('\n', match.index);
      const insertAt = lineEnd === -1 ? text.length : lineEnd + 1;
      const head = lineEnd === -1 ? `${text}\n` : text.slice(0, insertAt);
      return `${head}\n${block}${separate(text.slice(insertAt))}`;
    }
  }
  if (placement.position === 'start') {
    return block + separate(text);
  }
  if (text === '') {
    return block;
  }
  return `${text.endsWith('\n') ? text : `${text}\n`}\n${block}`;
}

/** @param {string} rest */
function separate(rest) {
  if (rest === '') {
    return '';
  }
  return rest.startsWith('\n') ? rest : `\n${rest}`;
}
