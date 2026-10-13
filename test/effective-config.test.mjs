/*
 * Snapshots the resolved severity of every tabled rule for representative files, so a table or
 * layer change shows up as a reviewable snapshot diff. Options and undecided rules are left out:
 * they change with plugin upgrades, which must pass without a snapshot update.
 */
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { TABLED_RULES } from './tabled-rules.mjs';
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
      .filter(([rule]) => TABLED_RULES.has(rule))
      .map(([rule, [severity]]) => [rule, severity])
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
