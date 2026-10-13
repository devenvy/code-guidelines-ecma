/*
 * What each rule table must decide for the installed plugins. Shared by the rule-inventory test
 * (which fails on any gap) and `pnpm run rules:add` (which closes the gaps).
 */
import path from 'node:path';

import vitestPlugin from '@vitest/eslint-plugin';
import angular from 'angular-eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

import angularTemplateRules from '../src/eslint/rules/angular-template.mjs';
import angularRules from '../src/eslint/rules/angular.mjs';
import importRules from '../src/eslint/rules/imports.mjs';
import javascriptRules from '../src/eslint/rules/javascript.mjs';
import typescriptRules from '../src/eslint/rules/typescript.mjs';
import vitestRules from '../src/eslint/rules/vitest.mjs';

/** @typedef {Record<string, { meta?: { deprecated?: unknown } }>} PluginRules */
/** @typedef {import('eslint').Linter.RuleEntry} RuleEntry */

/**
 * @typedef {object} Inventory
 * @property {string} name
 * @property {string} file the table's source file, relative to the repo root
 * @property {Record<string, unknown>} table
 * @property {string[]} expected every rule the table must decide
 * @property {string[]} deprecated deprecated rules (the table must not list them)
 * @property {(rule: string) => RuleEntry} initial the decision `rules:add` writes for a new rule
 */

const RULES_DIR = 'src/eslint/rules';

/**
 * @param {PluginRules | Record<string, unknown> | undefined} rules
 * @param {string} prefix
 * @param {boolean} wantDeprecated
 */
const names = (rules, prefix, wantDeprecated) =>
  Object.entries(/** @type {PluginRules} */ (rules ?? {}))
    .filter(([, rule]) => Boolean(rule.meta?.deprecated) === wantDeprecated)
    .map(([name]) => `${prefix}${name}`);

const core = Object.fromEntries(builtinRules);
const tsAll =
  /** @type {import('eslint').Linter.Config[]} */ (tseslint.configs.all).find(
    (config) => config.name === 'typescript-eslint/all',
  )?.rules ?? {};
const tsPluginRules = /** @type {{ rules?: PluginRules }} */ (tseslint.plugin).rules;

/** Rules the prettier layer turns back on after eslint-config-prettier. */
const RE_ENABLED = ['curly'];

/** @param {unknown} value */
export const isOn = (value) =>
  !['off', 0].includes(/** @type {string | number} */ (Array.isArray(value) ? value[0] : value));

/** Rules eslint-config-prettier turns off: Prettier decides them. */
export const TURNED_OFF_BY_PRETTIER = new Set(
  Object.entries(prettierConfig.rules ?? {})
    .filter(([name, value]) => !isOn(value) && !RE_ENABLED.includes(name))
    .map(([name]) => name),
);

/** New rules are on, except formatting rules Prettier owns. */
const onUnlessPrettier = (/** @type {string} */ rule) =>
  /** @type {RuleEntry} */ (TURNED_OFF_BY_PRETTIER.has(rule) ? 'off' : 'error');

/** @type {Inventory[]} */
export const inventories = [
  {
    name: 'core',
    file: path.posix.join(RULES_DIR, 'javascript.mjs'),
    table: javascriptRules,
    expected: names(core, '', false),
    deprecated: names(core, '', true),
    initial: onUnlessPrettier,
  },
  {
    // typescript-eslint rules plus the core rules their extension rules replace, and camelcase,
    // which naming-convention replaces; new ones take typescript-eslint's `all` setting
    name: 'typescript-eslint',
    file: path.posix.join(RULES_DIR, 'typescript.mjs'),
    table: typescriptRules,
    expected: [...Object.keys(tsAll), 'camelcase'],
    deprecated: names(tsPluginRules, '@typescript-eslint/', true),
    initial: (rule) =>
      isOn(tsAll[rule]) ? onUnlessPrettier(rule) : /** @type {RuleEntry} */ ('off'),
  },
  {
    name: 'import-x',
    file: path.posix.join(RULES_DIR, 'imports.mjs'),
    table: importRules,
    expected: names(importX.rules, 'import-x/', false),
    deprecated: names(importX.rules, 'import-x/', true),
    initial: onUnlessPrettier,
  },
  {
    name: '@angular-eslint',
    file: path.posix.join(RULES_DIR, 'angular.mjs'),
    table: angularRules,
    expected: names(angular.tsPlugin.rules, '@angular-eslint/', false),
    deprecated: names(angular.tsPlugin.rules, '@angular-eslint/', true),
    initial: onUnlessPrettier,
  },
  {
    name: '@angular-eslint/template',
    file: path.posix.join(RULES_DIR, 'angular-template.mjs'),
    table: angularTemplateRules,
    expected: names(angular.templatePlugin.rules, '@angular-eslint/template/', false),
    deprecated: names(angular.templatePlugin.rules, '@angular-eslint/template/', true),
    initial: onUnlessPrettier,
  },
  {
    name: '@vitest/eslint-plugin',
    file: path.posix.join(RULES_DIR, 'vitest.mjs'),
    table: vitestRules,
    expected: names(vitestPlugin.rules, 'vitest/', false),
    deprecated: names(vitestPlugin.rules, 'vitest/', true),
    initial: onUnlessPrettier,
  },
];

/**
 * @param {Inventory} inventory
 * @returns {{ undecided: string[], unknown: string[], deprecated: string[] }}
 */
export function gaps(inventory) {
  const listed = Object.keys(inventory.table);
  return {
    undecided: inventory.expected.filter((rule) => !listed.includes(rule)).sort(),
    unknown: listed
      .filter((rule) => !inventory.expected.includes(rule) && !inventory.deprecated.includes(rule))
      .sort(),
    deprecated: listed.filter((rule) => inventory.deprecated.includes(rule)).sort(),
  };
}
