import { describe, expect, it } from 'vitest';

import { completePluginRules, completeRules } from '../src/eslint/rules/complete.mjs';

const plugin = {
  decided: {},
  added: {},
  old: { meta: { deprecated: true } },
};

describe('completeRules', () => {
  it('turns on rules the table does not decide, except deprecated ones', () => {
    expect(completePluginRules({ 'p/decided': 'off' }, plugin, 'p/')).toEqual({
      'p/added': 'error',
      'p/decided': 'off',
    });
  });

  it('keeps decisions for deprecated rules and drops rules the plugin no longer ships', () => {
    expect(completePluginRules({ 'p/old': 'warn', 'p/removed': 'error' }, plugin, 'p/')).toEqual({
      'p/decided': 'error',
      'p/added': 'error',
      'p/old': 'warn',
    });
  });

  it('uses the given entries for undecided rules', () => {
    const available = new Set(['a', 'b', 'c']);
    expect(completeRules({ b: 'error' }, { a: 'off', b: 'off', c: 'error' }, available)).toEqual({
      a: 'off',
      b: 'error',
      c: 'error',
    });
  });
});
