#!/usr/bin/env node
/*
 * Closes the gaps the rule-inventory test reports, so plugin updates keep moving: rules a plugin
 * added go into their table (on as `error`, or as typescript-eslint's `all` config sets them, or
 * `off` where Prettier owns the formatting), and entries for removed or deprecated rules come
 * out. CI runs it on Dependabot PRs and commits the result; turn a rule off in a later PR.
 *
 *   pnpm run rules:add
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import { gaps, inventories } from './rule-inventory.mjs';

/** A table entry's first line: `  'rule-name': ...` or `  rule: ...`. */
const ENTRY = /^ {2}(?:'(?<quoted>[^']+)'|(?<bare>[A-Za-z][\w-]*)):/;
/** A line at entry level that is not the continuation of the entry above it. */
const ENTRY_LEVEL = /^(?: {2}(?:'|[A-Za-z]|\/\/)|\S)/;

/**
 * Removes entries and appends new ones before the table's closing line. Comments stay: one often
 * describes several entries.
 * @param {string} text a table module (Prettier-formatted)
 * @param {{ remove: string[], add: [string, unknown][] }} changes
 * @returns {string}
 */
export function updateTable(text, { remove, add }) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const kept = [];
  let removing = false;
  for (const line of lines) {
    const match = ENTRY.exec(line);
    if (match) {
      const { quoted, bare } = match.groups ?? {};
      removing = remove.includes(quoted ?? bare ?? '');
    } else if (line.trim() === '' || ENTRY_LEVEL.test(line)) {
      removing = false;
    }
    if (!removing) {
      kept.push(line);
    }
  }
  const close = kept.findLastIndex((line) => line.startsWith('}'));
  if (close === -1) {
    throw new Error('table has no closing line');
  }
  const added = add.map(
    ([rule, entry]) => `  // added on a plugin update\n  '${rule}': ${JSON.stringify(entry)},`,
  );
  return [...kept.slice(0, close), ...added, ...kept.slice(close)].join('\n');
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let changed = 0;
  const pending = inventories
    .map((inventory) => {
      const { undecided, unknown, deprecated } = gaps(inventory);
      return { inventory, undecided, remove: [...unknown, ...deprecated] };
    })
    .filter(({ undecided, remove }) => undecided.length + remove.length > 0);
  for (const { inventory, undecided, remove } of pending) {
    const file = path.join(root, inventory.file);
    const updated = updateTable(readFileSync(file, 'utf8'), {
      remove,
      add: undecided.map((rule) => [rule, inventory.initial(rule)]),
    });
    const options = await prettier.resolveConfig(file);
    writeFileSync(file, await prettier.format(updated, { ...options, filepath: file }));
    changed += undecided.length + remove.length;
    for (const rule of undecided) {
      console.log(`${inventory.file}: added ${rule}: ${JSON.stringify(inventory.initial(rule))}`);
    }
    for (const rule of remove) {
      console.log(`${inventory.file}: removed ${rule}`);
    }
  }
  console.log(changed === 0 ? 'The tables decide every rule.' : `${changed} table changes.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
