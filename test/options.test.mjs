import { describe, expect, it } from 'vitest';

import { angular, createConfig, normalizeOptions } from '../src/eslint/index.mjs';

describe('createConfig options', () => {
  it.each([
    [undefined, /options are required/],
    [{ env: 'node' }, /"rootDir" is required/],
    [{ rootDir: '.', env: 'deno' }, /"env" must be "browser" or "node"/],
    [
      { rootDir: '.', env: 'browser', typescript: false, angular: { prefix: 'app' } },
      /"angular" requires "typescript"/,
    ],
    [{ rootDir: '.', env: 'browser', angular: {} }, /"angular.prefix" is required/],
    [{ rootDir: '.', env: 'browser', angular: { prefix: [] } }, /"angular.prefix" is required/],
  ])('rejects %j', async (options, message) => {
    await expect(createConfig(options)).rejects.toThrow(message);
  });

  it('names every block and appends overrides last', async () => {
    const config = await createConfig(
      { rootDir: '.', env: 'node', vitest: true },
      { name: 'consumer/one' },
      [{ name: 'consumer/two' }],
    );
    expect(config.every((block) => typeof block.name === 'string')).toBe(true);
    expect(config.slice(-2).map((block) => block.name)).toEqual(['consumer/one', 'consumer/two']);
    expect(config.map((block) => block.name)).toContain('devenvy/vitest/rules');
  });

  it('omits typescript blocks when typescript is false', async () => {
    const config = await createConfig({ rootDir: '.', env: 'browser', typescript: false });
    expect(config.some((block) => block.name?.startsWith('devenvy/typescript'))).toBe(false);
  });

  it('explains how to install angular-eslint when it is missing', async () => {
    const missing = Object.assign(
      new Error("Cannot find package 'angular-eslint' imported from /x/index.mjs"),
      { code: 'ERR_MODULE_NOT_FOUND' },
    );
    const options = normalizeOptions({ rootDir: '.', env: 'browser', angular: { prefix: 'app' } });
    await expect(angular(options, { importModule: () => Promise.reject(missing) })).rejects.toThrow(
      'createConfig: angular: {...} requires "angular-eslint". Install it: npm i -D angular-eslint',
    );
  });

  it('reports a missing dependency of angular-eslint as itself, not as angular-eslint', async () => {
    const nested = Object.assign(
      new Error("Cannot find package '@angular-eslint/utils' imported from /x/angular-eslint.mjs"),
      { code: 'ERR_MODULE_NOT_FOUND' },
    );
    const options = normalizeOptions({ rootDir: '.', env: 'browser', angular: { prefix: 'app' } });
    await expect(angular(options, { importModule: () => Promise.reject(nested) })).rejects.toThrow(
      '@angular-eslint/utils',
    );
  });

  it('rejects an empty vitest files list', async () => {
    await expect(
      createConfig({ rootDir: '.', env: 'node', vitest: { files: [] } }),
    ).rejects.toThrow('"vitest.files" must not be empty');
  });
});
