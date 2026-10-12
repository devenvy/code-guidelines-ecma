import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { upsertBlock } from '../lib/blocks.mjs';
import { formatWritten } from '../lib/format.mjs';
import { mergeJson } from '../lib/json.mjs';
import { lineDiff, readText, writeText } from '../lib/text.mjs';
import { managedBlocks, managedJson } from '../managed.mjs';
import { readChoices } from './choices.mjs';

/**
 * @typedef {object} PlannedChange
 * @property {string} file path relative to the project
 * @property {string} before LF text ('' when the file does not exist)
 * @property {string} after LF text
 * @property {'\r\n' | '\n'} eol
 */

/**
 * Computes the managed-content changes for a project without writing anything.
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {PlannedChange[]}
 */
export function planManaged(dir, choices) {
  /** @type {PlannedChange[]} */
  const changes = [];
  for (const block of managedBlocks()) {
    const { text, eol } = readText(path.join(dir, block.file));
    let after = upsertBlock(text, block.content, block.placement, block.file);
    if (block.ensureLine && block.ensureLinePattern && !block.ensureLinePattern.test(after)) {
      after = `${block.ensureLine}\n\n${after}`;
    }
    if (after !== text) {
      changes.push({ file: block.file, before: text, after, eol });
    }
  }
  for (const json of managedJson(choices)) {
    const { text, eol } = readText(path.join(dir, json.file));
    const after = mergeJson(text, json.entries, json.file);
    if (after !== text) {
      changes.push({ file: json.file, before: text, after, eol });
    }
  }
  return changes;
}

/**
 * @param {string} dir
 * @param {PlannedChange[]} changes
 */
export function writeChanges(dir, changes) {
  for (const change of changes) {
    const file = path.join(dir, change.file);
    mkdirSync(path.dirname(file), { recursive: true });
    writeText(file, change.after, change.eol);
  }
}

/**
 * `code-guidelines sync [--dry-run]`
 * @param {string} dir
 * @param {{ dryRun?: boolean }} [flags]
 * @returns {Promise<{ changes: PlannedChange[], output: string[] }>}
 */
export async function sync(dir, flags = {}) {
  const choices = readChoices(dir);
  const changes = planManaged(dir, choices);
  /** @type {string[]} */
  let warnings = [];
  if (!flags.dryRun) {
    writeChanges(dir, changes);
    warnings = await formatWritten(
      dir,
      changes.map((change) => change.file),
    );
  }
  const verb = flags.dryRun ? 'would update' : 'updated';
  const output =
    changes.length === 0
      ? ['Managed files are up to date.']
      : changes.map((change) => `${verb} ${change.file}\n${lineDiff(change.before, change.after)}`);
  return { changes, output: [...output, ...warnings] };
}
