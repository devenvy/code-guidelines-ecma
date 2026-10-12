import vitestPlugin from '@vitest/eslint-plugin';
import angular from 'angular-eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import angularTemplateRules from '../src/eslint/rules/angular-template.mjs';
import angularRules from '../src/eslint/rules/angular.mjs';
import importRules from '../src/eslint/rules/imports.mjs';
import javascriptRules from '../src/eslint/rules/javascript.mjs';
import typescriptRules from '../src/eslint/rules/typescript.mjs';
import vitestRules from '../src/eslint/rules/vitest.mjs';

const active = (rules, prefix) =>
  Object.entries(rules)
    .filter(([, rule]) => !rule.meta?.deprecated)
    .map(([name]) => `${prefix}${name}`);

const deprecated = (rules, prefix) =>
  Object.entries(rules)
    .filter(([, rule]) => rule.meta?.deprecated)
    .map(([name]) => `${prefix}${name}`);

const tsAll = tseslint.configs.all.find((c) => c.name === 'typescript-eslint/all').rules;

const inventories = [
  {
    name: 'core',
    table: javascriptRules,
    expected: active(Object.fromEntries(builtinRules), ''),
    deprecated: deprecated(Object.fromEntries(builtinRules), ''),
  },
  {
    // typescript-eslint rules plus the core rules their extension rules disable, and camelcase,
    // which naming-convention replaces
    name: 'typescript-eslint',
    table: typescriptRules,
    expected: [...Object.keys(tsAll), 'camelcase'],
    deprecated: deprecated(tseslint.plugin.rules, '@typescript-eslint/'),
  },
  {
    name: 'import-x',
    table: importRules,
    expected: active(importX.rules, 'import-x/'),
    deprecated: deprecated(importX.rules, 'import-x/'),
  },
  {
    name: '@angular-eslint',
    table: angularRules,
    expected: active(angular.tsPlugin.rules, '@angular-eslint/'),
    deprecated: deprecated(angular.tsPlugin.rules, '@angular-eslint/'),
  },
  {
    name: '@angular-eslint/template',
    table: angularTemplateRules,
    expected: active(angular.templatePlugin.rules, '@angular-eslint/template/'),
    deprecated: deprecated(angular.templatePlugin.rules, '@angular-eslint/template/'),
  },
  {
    name: '@vitest/eslint-plugin',
    table: vitestRules,
    expected: active(vitestPlugin.rules, 'vitest/'),
    deprecated: deprecated(vitestPlugin.rules, 'vitest/'),
  },
];

const severity = (value) => (Array.isArray(value) ? value[0] : value);
const isOn = (value) => !['off', 0].includes(severity(value));

describe('rule inventory', () => {
  for (const inventory of inventories) {
    describe(`${inventory.name}`, () => {
      it('decides every rule the plugin ships', () => {
        const tableRules = Object.keys(inventory.table);
        expect({
          undecided: inventory.expected.filter((rule) => !tableRules.includes(rule)).sort(),
          unknown: tableRules.filter((rule) => !inventory.expected.includes(rule)).sort(),
        }).toEqual({ undecided: [], unknown: [] });
      });

      it('lists no deprecated rule', () => {
        const tableRules = Object.keys(inventory.table);
        expect(inventory.deprecated.filter((rule) => tableRules.includes(rule))).toEqual([]);
      });
    });
  }
});

describe('prettier overlap', () => {
  // rules the prettier layer turns back on after eslint-config-prettier
  const reEnabled = ['curly'];

  it('enables no rule that eslint-config-prettier turns off', () => {
    const turnedOff = Object.entries(prettierConfig.rules)
      .filter(([, value]) => !isOn(value))
      .map(([name]) => name);
    const enabled = inventories
      .flatMap((inventory) => Object.entries(inventory.table))
      .filter(([, value]) => isOn(value))
      .map(([name]) => name);
    expect(enabled.filter((rule) => turnedOff.includes(rule) && !reEnabled.includes(rule))).toEqual(
      [],
    );
  });
});
