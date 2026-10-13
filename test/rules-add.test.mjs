import { describe, expect, it } from 'vitest';

import { updateTable } from '../scripts/rules-add.mjs';

const TABLE = `/*
 * header
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  // these two are off
  'p/old': 'off',
  curly: [
    'error',
    { option: true },
  ],
  'p/kept': 'error',

  // next group
  'p/gone': [
    'error',
    'always',
  ],
  last: 'warn',
});
`;

describe('updateTable', () => {
  it('removes single-line and multi-line entries, keeping comments', () => {
    expect(updateTable(TABLE, { remove: ['p/old', 'curly', 'p/gone'], add: [] })).toBe(`/*
 * header
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  // these two are off
  'p/kept': 'error',

  // next group
  last: 'warn',
});
`);
  });

  it('appends new rules before the closing line', () => {
    const updated = updateTable(TABLE, {
      remove: [],
      add: [
        ['p/new', 'error'],
        ['no-new-thing', 'off'],
      ],
    });
    expect(updated).toContain(`  last: 'warn',
  // added on a plugin update
  'p/new': "error",
  // added on a plugin update
  'no-new-thing': "off",
});
`);
  });

  it('refuses a file without a closing line', () => {
    expect(() => updateTable('export default {', { remove: [], add: [['a', 'error']] })).toThrow(
      'table has no closing line',
    );
  });
});
