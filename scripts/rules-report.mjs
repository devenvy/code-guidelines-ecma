#!/usr/bin/env node
/*
 * Lists what the rule tables do not decide for the installed plugins: rules that are on only
 * because they are new (undecided), table entries for rules the plugins no longer ship (unknown),
 * deprecated rules still listed, and enabled rules that eslint-config-prettier turns off anyway.
 * None of this breaks anything (see src/eslint/rules/complete.mjs); run it to tidy the tables.
 *
 *   pnpm run rules:report
 */
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

/**
 * @param {PluginRules | Record<string, unknown> | undefined} rules
 * @param {string} prefix
 * @param {boolean} wantDeprecated
 */
const names = (rules, prefix, wantDeprecated) =>
  Object.entries(/** @type {PluginRules} */ (rules ?? {}))
    .filter(([, rule]) => Boolean(rule.meta?.deprecated) === wantDeprecated)
    .map(([name]) => `${prefix}${name}`);

const core = /** @type {PluginRules} */ (Object.fromEntries(builtinRules));
const tsAll = /** @type {import('eslint').Linter.Config[]} */ (tseslint.configs.all).find(
  (config) => config.name === 'typescript-eslint/all',
)?.rules;

/** @type {{ name: string, table: Record<string, unknown>, active: string[], deprecated: string[] }[]} */
const inventories = [
  {
    name: 'core',
    table: javascriptRules,
    active: names(core, '', false),
    deprecated: names(core, '', true),
  },
  {
    // typescript-eslint rules plus the core rules their extension rules replace, and camelcase,
    // which naming-convention replaces
    name: 'typescript-eslint',
    table: typescriptRules,
    active: [...Object.keys(tsAll ?? {}), 'camelcase'],
    deprecated: names(
      /** @type {PluginRules} */ (/** @type {{ rules?: PluginRules }} */ (tseslint.plugin).rules),
      '@typescript-eslint/',
      true,
    ),
  },
  {
    name: 'import-x',
    table: importRules,
    active: names(importX.rules, 'import-x/', false),
    deprecated: names(importX.rules, 'import-x/', true),
  },
  {
    name: '@angular-eslint',
    table: angularRules,
    active: names(angular.tsPlugin.rules, '@angular-eslint/', false),
    deprecated: names(angular.tsPlugin.rules, '@angular-eslint/', true),
  },
  {
    name: '@angular-eslint/template',
    table: angularTemplateRules,
    active: names(angular.templatePlugin.rules, '@angular-eslint/template/', false),
    deprecated: names(angular.templatePlugin.rules, '@angular-eslint/template/', true),
  },
  {
    name: '@vitest/eslint-plugin',
    table: vitestRules,
    active: names(/** @type {PluginRules} */ (vitestPlugin.rules), 'vitest/', false),
    deprecated: names(/** @type {PluginRules} */ (vitestPlugin.rules), 'vitest/', true),
  },
];

/** Rules the prettier layer turns back on after eslint-config-prettier. */
const RE_ENABLED = new Set(['curly']);
const isOn = (/** @type {unknown} */ value) =>
  !['off', 0].includes(/** @type {string | number} */ (Array.isArray(value) ? value[0] : value));
const turnedOffByPrettier = new Set(
  Object.entries(prettierConfig.rules ?? {})
    .filter(([, value]) => !isOn(value))
    .map(([name]) => name),
);

let findings = 0;
const report = (/** @type {string} */ title, /** @type {string[]} */ rules) => {
  if (rules.length > 0) {
    findings += rules.length;
    console.log(`  ${title}:\n${rules.map((rule) => `    ${rule}`).join('\n')}`);
  }
};
for (const { name, table, active, deprecated } of inventories) {
  const listed = Object.keys(table);
  console.log(name);
  report(
    'undecided (on as error)',
    active.filter((rule) => !listed.includes(rule)),
  );
  report(
    'unknown (dropped)',
    listed.filter((rule) => !active.includes(rule) && !deprecated.includes(rule)),
  );
  report(
    'deprecated',
    listed.filter((rule) => deprecated.includes(rule)),
  );
  report(
    'turned off by eslint-config-prettier',
    listed.filter(
      (rule) => isOn(table[rule]) && turnedOffByPrettier.has(rule) && !RE_ENABLED.has(rule),
    ),
  );
}
console.log(findings === 0 ? '\nThe tables decide every rule.' : `\n${findings} to tidy.`);
