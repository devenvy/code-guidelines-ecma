import path from 'node:path';

import { extractBlock } from '../lib/blocks.mjs';
import { diffJson, parseJsonc } from '../lib/json.mjs';
import {
  ESLINT_CONFIG_FILES,
  findFiles,
  LEGACY_ESLINT_FILES,
  PRETTIER_CONFIG_FILES,
} from '../lib/project.mjs';
import { lineDiff, readText } from '../lib/text.mjs';
import { managedBlocks, managedJson, prettierConfigFor } from '../managed.mjs';
import { readChoices } from './choices.mjs';
import { checkWorkflows, ciScripts } from './workflows.mjs';

const TSCONFIG_PREFIX = '@devenvy/code-guidelines/tsconfig/';
const MAX_EXTENDS_DEPTH = 10;

/**
 * @typedef {{ file: string, message: string }} Problem
 */

/**
 * `code-guidelines check` — read-only.
 * @param {string} dir
 * @returns {{ ok: boolean, problems: Problem[], output: string[] }}
 */
export function check(dir) {
  const choices = readChoices(dir);
  /** @type {Problem[]} */
  const problems = [
    ...checkBlocks(dir),
    ...checkJson(dir, choices),
    ...checkEslint(dir, choices),
    ...checkPrettier(dir, choices),
    ...checkTsconfig(dir),
    ...checkScripts(dir, choices),
    ...(choices.workflows === false ? [] : checkWorkflows(dir, choices)),
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
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Problem[]}
 */
function checkEslint(dir, choices) {
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
  const { text } = readText(path.join(dir, config));
  if (!text.includes('@devenvy/code-guidelines/eslint')) {
    problems.push({
      file: config,
      message: 'does not use createConfig from @devenvy/code-guidelines/eslint',
    });
  }
  const mentionsAngular = /\bangular\s*:/.test(text);
  if (mentionsAngular !== choices.angular) {
    problems.push({
      file: config,
      message: `package.json codeGuidelines.angular is ${choices.angular} but the ESLint config ${mentionsAngular ? 'enables' : 'does not enable'} angular`,
    });
  }
  return problems;
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

/**
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Problem[]}
 */
function checkScripts(dir, choices) {
  const scripts = parseJsonc(readText(path.join(dir, 'package.json')).text, 'package.json').scripts;
  return ciScripts(choices)
    .filter((name) => typeof scripts?.[name] !== 'string')
    .map((name) => ({ file: 'package.json', message: `missing script "${name}" (CI runs it)` }));
}

/**
 * Follows relative `extends` from tsconfig.json until a packaged base is found.
 * @param {string} dir
 * @returns {Problem[]}
 */
function checkTsconfig(dir) {
  let file = path.join(dir, 'tsconfig.json');
  for (let depth = 0; depth < MAX_EXTENDS_DEPTH; depth += 1) {
    const { exists, text } = readText(file);
    if (!exists) {
      return [{ file: path.relative(dir, file) || 'tsconfig.json', message: 'missing' }];
    }
    const raw = parseJsonc(text, path.relative(dir, file)).extends;
    const extendsList = (Array.isArray(raw) ? raw : [raw]).filter(
      (value) => typeof value === 'string',
    );
    if (extendsList.some((value) => value.startsWith(TSCONFIG_PREFIX))) {
      return [];
    }
    const relative = extendsList.find((value) => value.startsWith('.'));
    if (!relative) {
      break;
    }
    file = path.resolve(
      path.dirname(file),
      relative.endsWith('.json') ? relative : `${relative}.json`,
    );
  }
  return [{ file: 'tsconfig.json', message: `does not extend ${TSCONFIG_PREFIX}<base>.json` }];
}
