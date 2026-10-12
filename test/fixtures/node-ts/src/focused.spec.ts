import { describe, expect, it } from 'vitest';

import { double } from './util.js';

describe('focused', () => {
  it.only('doubles', () => {
    expect(double(1)).toBe(2);
  });
});
