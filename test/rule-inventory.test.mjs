import { describe, expect, it } from 'vitest';

import { gaps, inventories, isOn, TURNED_OFF_BY_PRETTIER } from '../scripts/rule-inventory.mjs';

// `pnpm run rules:add` closes every gap reported here (CI runs it on Dependabot PRs).
describe('rule inventory', () => {
  for (const inventory of inventories) {
    describe(`${inventory.name}`, () => {
      it('decides every rule the plugin ships, and no rule it does not', () => {
        const { undecided, unknown } = gaps(inventory);
        expect({ undecided, unknown }).toEqual({ undecided: [], unknown: [] });
      });

      it('lists no deprecated rule', () => {
        expect(gaps(inventory).deprecated).toEqual([]);
      });
    });
  }
});

describe('prettier overlap', () => {
  it('enables no rule that eslint-config-prettier turns off', () => {
    const enabled = inventories
      .flatMap((inventory) => Object.entries(inventory.table))
      .filter(([, value]) => isOn(value))
      .map(([name]) => name);
    expect(enabled.filter((rule) => TURNED_OFF_BY_PRETTIER.has(rule))).toEqual([]);
  });
});
