import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../tsconfig');

/** @param {string} name */
function load(name) {
  const file = path.join(root, `${name}.json`);
  const { config, error } = ts.readConfigFile(file, ts.sys.readFile);
  expect(error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root, undefined, file);
  expect(parsed.errors.filter((e) => e.code !== 18003)).toEqual([]); // 18003: no inputs found
  return { options: parsed.options, raw: parsed.raw };
}

describe('tsconfig bases', () => {
  it('base sets every strictness flag explicitly', () => {
    const { options } = load('base');
    expect(options).toMatchObject({
      strict: true,
      noImplicitOverride: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noPropertyAccessFromIndexSignature: true,
      noUncheckedIndexedAccess: true,
      isolatedModules: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
    });
  });

  it('node targets nodenext and includes node types', () => {
    const { options } = load('node');
    expect(options.module).toBe(ts.ModuleKind.NodeNext);
    expect(options.types).toEqual(['node']);
    expect(options.strict).toBe(true);
  });

  it('browser uses bundler resolution with DOM libs', () => {
    const { options } = load('browser');
    expect(options.moduleResolution).toBe(ts.ModuleResolutionKind.Bundler);
    expect(options.lib).toEqual(['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts']);
  });

  it('angular adds decorators and strict template options', () => {
    const { options } = load('angular');
    expect(options.experimentalDecorators).toBe(true);
    expect(options.importHelpers).toBe(true);
    expect(options.moduleResolution).toBe(ts.ModuleResolutionKind.Bundler);
    const { config } = ts.readConfigFile(path.join(root, 'angular.json'), ts.sys.readFile);
    expect(config.angularCompilerOptions).toEqual({
      enableI18nLegacyMessageIdFormat: false,
      strictInjectionParameters: true,
      strictInputAccessModifiers: true,
      strictTemplates: true,
    });
  });

  it('js type-checks plain JavaScript', () => {
    const { options } = load('js');
    expect(options).toMatchObject({ allowJs: true, checkJs: true, noEmit: true, strict: true });
  });
});
