import path from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { createConfig } from '../src/eslint/index.mjs';
import angularRules from '../src/eslint/rules/angular.mjs';

const fixtures = path.resolve(import.meta.dirname, 'fixtures');

/**
 * Lints a fixture and returns `{ [relativeFile]: sortedRuleIds }` for every file linted.
 * @param {string} name
 * @param {Omit<import('../src/eslint/index.mjs').Options, 'rootDir'>} options
 * @param {import('eslint').Linter.Config[]} [overrides]
 */
async function lintFixture(name, options, overrides = []) {
  const cwd = path.join(fixtures, name);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: await createConfig({ rootDir: cwd, ...options }, overrides),
  });
  const results = await eslint.lintFiles(['.']);
  return Object.fromEntries(
    results.map((result) => [
      path.relative(cwd, result.filePath).replaceAll('\\', '/'),
      [...new Set(result.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`))].sort(),
    ]),
  );
}

describe('plain-js fixture', () => {
  /** @type {Record<string, string[]>} */
  let report;
  beforeAll(async () => {
    report = await lintFixture('plain-js', { env: 'browser', typescript: false });
  });

  it('clean file reports nothing', () => expect(report['clean.js']).toEqual([]));
  it('reports undefined identifiers in JS', () => expect(report['undef.js']).toEqual(['no-undef']));
  it('orders imports', () => expect(report['order.js']).toEqual(['import-x/order']));
});

describe('node-ts fixture', () => {
  /** @type {Record<string, string[]>} */
  let report;
  beforeAll(async () => {
    report = await lintFixture('node-ts', {
      env: 'node',
      vitest: true,
      untypedFiles: ['scripts/**'],
      importOrder: { internal: ['^@app/'] },
    });
  });

  it('clean files report nothing', () => {
    expect(report['src/clean.ts']).toEqual([]);
    expect(report['src/util.ts']).toEqual([]);
    expect(report['src/util.spec.ts']).toEqual([]);
    expect(report['src/placeholder.ts']).toEqual([]);
  });
  it('reports floating promises (type-aware)', () =>
    expect(report['src/floating.ts']).toEqual(['@typescript-eslint/no-floating-promises']));
  it('orders custom internal imports before relative ones', () =>
    expect(report['src/order.ts']).toEqual(['import-x/order']));
  it('forbids leading underscores (use #private)', () =>
    expect(report['src/underscore.ts']).toEqual([
      '@typescript-eslint/naming-convention',
      'no-underscore-dangle',
    ]));
  it('applies vitest rules to spec files', () =>
    expect(report['src/focused.spec.ts']).toEqual(['vitest/no-focused-tests']));
  it('lints a root config file outside every tsconfig', () =>
    expect(report['vitest.config.ts']).toEqual([]));
  it('lints untypedFiles without type information', () =>
    expect(report['scripts/tool.ts']).toEqual([]));
});

describe('angular fixture', () => {
  /** @type {Record<string, string[]>} */
  let report;
  beforeAll(async () => {
    report = await lintFixture('angular', {
      env: 'browser',
      vitest: true,
      angular: { prefix: 'app', controlComponents: ['app-text-field'] },
    });
  });

  it('suffixless component and its external template are clean', () => {
    expect(report['src/app/user-profile.ts']).toEqual([]);
    expect(report['src/app/user-profile.html']).toEqual([]);
  });
  it('idiomatic Angular code is clean', () => {
    expect(report['src/app/conventions.ts']).toEqual([]);
    expect(report['src/app/shout.pipe.ts']).toEqual([]);
    expect(report['src/app/toggle.module.ts']).toEqual([]);
    expect(report['src/app/reactive.ts']).toEqual([]);
    expect(report['src/app/shout.pipe.spec.ts']).toEqual([]);
  });
  it('enforces the selector prefix', () =>
    expect(report['src/app/bad-prefix.ts']).toEqual(['@angular-eslint/component-selector']));
  it('lints inline templates of suffixless components', () =>
    expect(report['src/app/legacy-template.ts']).toEqual([
      '@angular-eslint/template/prefer-control-flow',
    ]));
  it('does not lint index.html as an Angular template', () =>
    expect(report['src/index.html']).toBeUndefined());

  it('allows style bindings but not static inline styles', () => {
    expect(report['src/app/style-binding.ts']).toEqual([]);
    expect(report['src/app/static-style.html']).toEqual([
      '@angular-eslint/template/no-inline-styles',
    ]);
  });
  it('honours controlComponents for label association', () => {
    expect(report['src/app/label-ok.html']).toEqual([]);
    expect(report['src/app/label-bad.html']).toEqual([
      '@angular-eslint/template/label-has-associated-control',
    ]);
  });
});

describe('reactive-context-must-read-signal', () => {
  it('ships off exactly while the upstream crash reproduces', async () => {
    let crashed = false;
    try {
      await lintFixture('angular', { env: 'browser', angular: { prefix: 'app' } }, [
        {
          files: ['src/app/reactive.ts'],
          rules: { '@angular-eslint/reactive-context-must-read-signal': 'error' },
        },
      ]);
    } catch (error) {
      // only a crash inside the rule counts; configuration errors must still fail the test
      if (
        !String(/** @type {Error} */ (error).stack).includes('reactive-context-must-read-signal')
      ) {
        throw error;
      }
      crashed = true;
    }
    // When this fails, upstream fixed the crash: enable the rule in src/eslint/rules/angular.mjs.
    expect(angularRules['@angular-eslint/reactive-context-must-read-signal']).toBe(
      crashed ? 'off' : 'error',
    );
  });
});
