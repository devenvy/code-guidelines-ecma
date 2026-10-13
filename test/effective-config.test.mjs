/*
 * Snapshots the resolved rules for representative files, so any change to what is enforced —
 * from a table edit or a plugin upgrade — shows up as a reviewable snapshot diff.
 */
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { createConfig } from '../src/eslint/index.mjs';

const fixtures = path.resolve(import.meta.dirname, 'fixtures');

/**
 * @param {string} fixture
 * @param {Omit<import('../src/eslint/index.mjs').Options, 'rootDir'>} options
 * @param {string} file
 */
async function effectiveRules(fixture, options, file) {
  const cwd = path.join(fixtures, fixture);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: await createConfig({ rootDir: cwd, ...options }),
  });
  const config = await eslint.calculateConfigForFile(path.join(cwd, file));
  return Object.fromEntries(
    Object.entries(config.rules ?? {})
      .map(([rule, [severity, ...rest]]) => [
        rule,
        rest.length > 0 ? [severity, ...rest] : severity,
      ])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

const angular = { env: 'browser', vitest: true, angular: { prefix: 'app' } };
const node = { env: 'node', vitest: true };

describe('effective config', () => {
  it.each([
    ['plain JS', 'plain-js', { env: 'browser', typescript: false }, 'clean.js'],
    ['Node TS', 'node-ts', node, 'src/clean.ts'],
    ['TS spec', 'node-ts', node, 'src/util.spec.ts'],
    ['root config file', 'node-ts', node, 'vitest.config.ts'],
    ['Angular TS', 'angular', angular, 'src/app/user-profile.ts'],
    ['Angular template', 'angular', angular, 'src/app/user-profile.html'],
  ])('%s', async (_name, fixture, options, file) => {
    expect(await effectiveRules(fixture, options, file)).toMatchSnapshot();
  });
});
