import { describe, expect, it } from 'vitest';

import { double } from './util.js';

describe('double', () => {
  it('doubles', () => {
    expect(double(2)).toBe(4);
  });
});
