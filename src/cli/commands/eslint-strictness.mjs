import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { ESLint } from 'eslint';

import { createConfig } from '../../eslint/index.mjs';
import { OPTIONS_SETTING } from '../../eslint/options.mjs';
import { findProjectFiles } from '../lib/walk.mjs';

/** Files the shared config can lint. */
const LINTABLE = /\.(?:[cm]?js|[cm]?ts|html)$/;
/** File paths listed per problem before "and N more". */
const EXAMPLES = 3;
const SEVERITY = ['off', 'warn', 'error'];

/**
 * @typedef {{ file: string, message: string }} Problem
 * @typedef {import('eslint').Linter.Config} Config
 * @typedef {import('../../eslint/options.mjs').Options} Options
 */

/**
 * Compares the project's resolved ESLint config with `createConfig(<its own options>)` for every
 * lintable file: every file the shared config lints must be linted, every rule it turns on must be
 * on at the same or a higher severity with the same options, and the parser, processor, language
 * and linter options must be the shared config's. Rules the shared config leaves off are free.
 * @param {string} dir
 * @param {string} configFile the project's ESLint config, relative to `dir`
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Promise<Problem[]>}
 */
export async function checkEslintStrictness(dir, configFile, choices) {
  const problem = (/** @type {string} */ message) => [{ file: configFile, message }];
  const actual = new ESLint({ cwd: dir });
  /** @type {Config | undefined} */
  let own;
  try {
    own = await actual.calculateConfigForFile(path.join(dir, configFile));
  } catch (error) {
    return problem(`could not be loaded: ${/** @type {Error} */ (error).message}`);
  }
  const options = /** @type {Options | undefined} */ (own?.settings?.[OPTIONS_SETTING]);
  if (!options) {
    return problem('does not use createConfig from @devenvy/code-guidelines/eslint');
  }
  /** @type {Problem[]} */
  const problems = choiceMismatches(options, choices).map((message) => ({
    file: configFile,
    message,
  }));
  const baseline = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: await createConfig(options),
  });

  /** @type {Map<string, string[]>} problem → files */
  const found = new Map();
  for (const file of findProjectFiles(dir, (name) => LINTABLE.test(name))) {
    const expected = await baseline.calculateConfigForFile(file);
    const messages = expected ? compare(expected, await actual.calculateConfigForFile(file)) : [];
    const relative = path.relative(dir, file).replaceAll('\\', '/');
    for (const message of messages) {
      found.set(message, [...(found.get(message) ?? []), relative]);
    }
  }
  for (const [message, files] of found) {
    const examples = files.slice(0, EXAMPLES).join(', ');
    const more = files.length > EXAMPLES ? ` and ${files.length - EXAMPLES} more` : '';
    problems.push({ file: configFile, message: `${message} (${examples}${more})` });
  }
  return problems;
}

/**
 * How `actual` is weaker than `expected` for one file.
 * @param {Config} expected
 * @param {Config | undefined} actual undefined when the project does not lint the file
 * @returns {string[]}
 */
function compare(expected, actual) {
  if (!actual) {
    return ['ignores files the shared config lints'];
  }
  /** @type {string[]} */
  const messages = [];
  const enabled = Object.entries(expected.rules ?? {}).filter(
    ([, entry]) => /** @type {[number]} */ (entry)[0] > 0,
  );
  for (const [rule, entry] of enabled) {
    const [severity, ...options] = /** @type {[number, ...unknown[]]} */ (entry);
    const actualEntry = actual.rules?.[rule];
    const [actualSeverity = 0, ...actualOptions] = /** @type {[number?, ...unknown[]]} */ (
      actualEntry ?? []
    );
    if (actualSeverity < severity) {
      messages.push(`turns down "${rule}" (${SEVERITY[severity]} → ${SEVERITY[actualSeverity]})`);
    } else if (!isDeepStrictEqual(actualOptions, options)) {
      messages.push(`changes the options of "${rule}"`);
    }
  }
  const { parser: expectedParser } = expected.languageOptions ?? {};
  const { parser: actualParser } = actual.languageOptions ?? {};
  /** @type {[string, unknown, unknown][]} */
  const replaced = [
    ['parser', expectedParser, actualParser],
    ['processor', expected.processor, actual.processor],
    ['language', expected.language, actual.language],
  ];
  for (const [what, want, got] of replaced) {
    if (want !== got) {
      messages.push(`replaces the shared config's ${what}`);
    }
  }
  if (!isDeepStrictEqual(actual.linterOptions, expected.linterOptions)) {
    messages.push('changes linterOptions');
  }
  return messages;
}

/**
 * @param {Options} options
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]}
 */
function choiceMismatches(options, choices) {
  /** @type {[string, unknown, unknown][]} */
  const pairs = [
    ['env', choices.env, options.env],
    ['typescript', choices.typescript, options.typescript ?? true],
    ['angular', choices.angular, Boolean(options.angular)],
    ['vitest', choices.vitest, Boolean(options.vitest)],
  ];
  return pairs
    .filter(([, chosen, configured]) => chosen !== configured)
    .map(
      ([key, chosen, configured]) =>
        `package.json codeGuidelines.${key} is ${JSON.stringify(chosen)} but createConfig has ${JSON.stringify(configured)}`,
    );
}
