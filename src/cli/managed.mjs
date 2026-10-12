import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templatesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

/**
 * What a consumer chose at `init`, recorded in package.json under `codeGuidelines`.
 * @typedef {object} Choices
 * @property {'browser' | 'node'} env
 * @property {boolean} typescript
 * @property {boolean} angular
 * @property {boolean} vitest
 * @property {boolean} [workflows] check the CI/release workflow convention (default true)
 */

/**
 * @typedef {object} ManagedBlock
 * @property {string} file
 * @property {string} content
 * @property {{ position: 'start' | 'end', after?: RegExp }} placement
 * @property {string} [ensureLine] line to add at the top if no line matches `ensureLinePattern`
 * @property {RegExp} [ensureLinePattern]
 */

/**
 * @typedef {object} ManagedJson
 * @property {string} file
 * @property {import('./lib/json.mjs').JsonEntry[]} entries
 */

/** @param {string} name */
const template = (name) =>
  readFileSync(path.join(templatesDir, name), 'utf8').replaceAll('\r\n', '\n');

/**
 * The same for every project type.
 * @returns {ManagedBlock[]}
 */
export function managedBlocks() {
  return [
    {
      file: '.editorconfig',
      content: template('editorconfig'),
      // first, so consumer sections after the block win; after `root = true`
      placement: { position: 'start', after: /^root\s*=.*$/m },
      ensureLine: 'root = true',
      ensureLinePattern: /^root\s*=/m,
    },
    {
      file: '.gitattributes',
      content: template('gitattributes'),
      placement: { position: 'start' },
    },
    {
      file: '.prettierignore',
      content: template('prettierignore'),
      placement: { position: 'start' },
    },
  ];
}

/**
 * @param {Choices} choices
 * @returns {ManagedJson[]}
 */
export function managedJson(choices) {
  const recommendations = [
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
    'editorconfig.editorconfig',
  ];
  if (choices.angular) {
    recommendations.push('angular.ng-template');
  }
  if (choices.vitest) {
    recommendations.push('vitest.explorer');
  }
  /** @type {import('./lib/json.mjs').JsonEntry[]} */
  const settings = [
    { path: ['editor.defaultFormatter'], value: 'esbenp.prettier-vscode' },
    { path: ['editor.formatOnSave'], value: true },
    { path: ['editor.codeActionsOnSave', 'source.fixAll.eslint'], value: 'explicit' },
    { path: ['editor.codeActionsOnSave', 'source.organizeImports'], value: 'never' },
  ];
  if (choices.typescript) {
    settings.push({ path: ['typescript.tsdk'], value: 'node_modules/typescript/lib' });
  }
  return [
    {
      file: '.vscode/extensions.json',
      entries: [{ path: ['recommendations'], includes: recommendations }],
    },
    { file: '.vscode/settings.json', entries: settings },
  ];
}

/**
 * @param {Choices} choices
 * @returns {string}
 */
export function prettierConfigFor(choices) {
  return choices.angular
    ? '@devenvy/code-guidelines/prettier/angular'
    : '@devenvy/code-guidelines/prettier';
}

/**
 * @param {Choices} choices
 * @returns {'angular' | 'node' | 'browser' | 'js'}
 */
export function tsconfigBaseFor(choices) {
  if (!choices.typescript) {
    return 'js';
  }
  if (choices.angular) {
    return 'angular';
  }
  return choices.env;
}

/**
 * @param {Choices & { prefix?: string }} choices
 * @returns {string}
 */
export function eslintConfigFor(choices) {
  const lines = [
    "import { createConfig } from '@devenvy/code-guidelines/eslint';",
    '',
    'export default createConfig({',
    '  rootDir: import.meta.dirname,',
    `  env: '${choices.env}',`,
  ];
  if (!choices.typescript) {
    lines.push('  typescript: false,');
  }
  if (choices.vitest) {
    lines.push('  vitest: true,');
  }
  if (choices.angular) {
    lines.push(`  angular: { prefix: '${choices.prefix}' },`);
  }
  lines.push('});', '');
  return lines.join('\n');
}

/**
 * Resolved compiler options of a packaged tsconfig base (follows its relative `extends`).
 * @param {string} name
 * @returns {{ compilerOptions: Record<string, unknown>, angularCompilerOptions: Record<string, unknown> }}
 */
export function resolvedBase(name) {
  const file = path.resolve(templatesDir, '../tsconfig', `${name}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const parent = json.extends ? resolvedBase(path.basename(json.extends, '.json')) : null;
  return {
    compilerOptions: { ...parent?.compilerOptions, ...json.compilerOptions },
    angularCompilerOptions: { ...parent?.angularCompilerOptions, ...json.angularCompilerOptions },
  };
}
