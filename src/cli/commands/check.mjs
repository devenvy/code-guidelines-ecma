import path from 'node:path';

import { extractBlock } from '../lib/blocks.mjs';
import { diffJson, parseJsonc } from '../lib/json.mjs';
import {
  ESLINT_CONFIG_FILES,
  findFiles,
  LEGACY_ESLINT_FILES,
  pnpmWorkspaceFile,
  PRETTIER_CONFIG_FILES,
} from '../lib/project.mjs';
import { lineDiff, readText } from '../lib/text.mjs';
import { undecidedBuilds } from '../lib/yaml.mjs';
import { managedBlocks, managedJson, PNPM_BUILDS, prettierConfigFor } from '../managed.mjs';
import { readChoices } from './choices.mjs';
import { checkEslintStrictness } from './eslint-strictness.mjs';
import { checkTsconfigStrictness } from './tsconfig-strictness.mjs';

/**
 * @typedef {{ file: string, message: string }} Problem
 */

/**
 * `code-guidelines check` — read-only.
 * @param {string} dir
 * @returns {Promise<{ ok: boolean, problems: Problem[], output: string[] }>}
 */
export async function check(dir) {
  const choices = readChoices(dir);
  /** @type {Problem[]} */
  const problems = [
    ...checkBlocks(dir),
    ...checkJson(dir, choices),
    ...checkPnpmBuilds(dir),
    ...(await checkEslint(dir, choices)),
    ...checkPrettier(dir, choices),
    ...(choices.typescript ? checkTsconfigStrictness(dir) : []),
  ];
  const output =
    problems.length === 0
      ? ['code-guidelines: everything matches.']
      : [
          ...problems.map((p) => `${p.file}: ${p.message}`),
          '',
          'Run "code-guidelines sync" to fix managed content.',
        ];
  return { ok: problems.length === 0, problems, output };
}

/**
 * @param {string} dir
 * @returns {Problem[]}
 */
function checkBlocks(dir) {
  return managedBlocks().flatMap((block) => {
    const { exists, text } = readText(path.join(dir, block.file));
    if (!exists) {
      return [{ file: block.file, message: 'missing' }];
    }
    const actual = extractBlock(text);
    if (actual === null) {
      return [{ file: block.file, message: 'managed block missing' }];
    }
    /** @type {Problem[]} */
    const found = [];
    if (actual !== block.content) {
      found.push({
        file: block.file,
        message: `managed block differs:\n${lineDiff(block.content, actual)}`,
      });
    }
    if (block.ensureLinePattern && !block.ensureLinePattern.test(text)) {
      found.push({ file: block.file, message: `missing "${block.ensureLine}"` });
    }
    return found;
  });
}

/**
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Problem[]}
 */
function checkJson(dir, choices) {
  return managedJson(choices).flatMap((json) => {
    const { exists, text } = readText(path.join(dir, json.file));
    if (!exists) {
      return [{ file: json.file, message: 'missing' }];
    }
    return diffJson(text, json.entries, json.file).map((message) => ({ file: json.file, message }));
  });
}

/**
 * pnpm projects must decide the build scripts our dependencies bring in.
 * @param {string} dir
 * @returns {Problem[]}
 */
function checkPnpmBuilds(dir) {
  const workspace = pnpmWorkspaceFile(dir);
  if (!workspace) {
    return [];
  }
  const { text } = readText(path.join(dir, workspace));
  return undecidedBuilds(text, Object.keys(PNPM_BUILDS), workspace).map((name) => ({
    file: workspace,
    message: `allowBuilds must set "${name}" to true or false (pnpm install fails otherwise)`,
  }));
}

/**
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Promise<Problem[]>}
 */
async function checkEslint(dir, choices) {
  const configs = findFiles(dir, ESLINT_CONFIG_FILES);
  const legacy = findFiles(dir, LEGACY_ESLINT_FILES);
  /** @type {Problem[]} */
  const problems = legacy.map((file) => ({ file, message: 'legacy ESLint config; delete it' }));
  const [config] = configs;
  if (config === undefined) {
    return [...problems, { file: 'eslint.config.mjs', message: 'missing' }];
  }
  if (configs.length > 1) {
    problems.push({
      file: configs.join(', '),
      message: 'more than one ESLint config; ESLint uses only the first',
    });
  }
  return [...problems, ...(await checkEslintStrictness(dir, config, choices))];
}

/**
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Problem[]}
 */
function checkPrettier(dir, choices) {
  const expected = prettierConfigFor(choices);
  const pkg = parseJsonc(readText(path.join(dir, 'package.json')).text, 'package.json');
  /** @type {Problem[]} */
  const problems = findFiles(dir, PRETTIER_CONFIG_FILES).map((file) => ({
    file,
    message: 'overrides package.json "prettier"; delete it',
  }));
  if (pkg.prettier !== expected) {
    problems.push({
      file: 'package.json',
      message: `"prettier" should be "${expected}" (found ${JSON.stringify(pkg.prettier)})`,
    });
  }
  return problems;
}
