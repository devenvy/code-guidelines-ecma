import { describe, expect, it } from 'vitest';

import { ShoutPipe } from './shout.pipe';

describe('ShoutPipe', () => {
  it('upper-cases', () => {
    expect(new ShoutPipe().transform('hi')).toBe('HI');
  });
});
