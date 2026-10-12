/*
 * Packs the real tarball, installs it with npm into throwaway consumer projects and runs the
 * consumer workflow end to end: init, eslint, prettier --check, typecheck, knip, check. Also
 * asserts that each kind of consumer installs only what its features need.
 * Slow (network + installs); set SKIP_PACK_TEST=1 to skip locally.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = path.join(root, 'test/fixtures');
const devDependencies = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
).devDependencies;
const PACK_TIMEOUT = 600_000;

/** @param {string} name */
const version = (name) => `${name}@${devDependencies[name]}`;

/**
 * @param {string} command
 * @param {string} cwd
 * @returns {{ code: number, output: string }}
 */
function sh(command, cwd) {
  try {
    return { code: 0, output: execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    const failure = /** @type {{ status: number, stdout: string, stderr: string }} */ (error);
    return { code: failure.status, output: `${failure.stdout}\n${failure.stderr}` };
  }
}

/** @type {string} */
let tarball;
/** @type {string[]} */
const dirs = [];

beforeAll(() => {
  const out = mkdtempSync(path.join(tmpdir(), 'cg-pack-'));
  dirs.push(out);
  const result = sh(`pnpm pack --pack-destination "${out}"`, root);
  if (result.code !== 0) {
    throw new Error(`pnpm pack failed:\n${result.output}`);
  }
  const name = result.output.trim().split(/\r?\n/).at(-1) ?? '';
  tarball = path.isAbsolute(name) ? name : path.join(out, path.basename(name));
}, PACK_TIMEOUT);

afterAll(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Creates a consumer project from fixture files, installs the tarball and peers, runs init.
 * @param {{ fixture: string, files: string[], pkg: object, tsconfig?: string, extra?: Record<string, string>, install: string[], init: string }} spec
 */
function consumer(spec) {
  const dir = mkdtempSync(path.join(tmpdir(), `cg-consumer-${spec.fixture}-`));
  dirs.push(dir);
  cpSync(path.join(fixtures, 'workflows'), dir, { recursive: true });
  for (const file of spec.files) {
    cpSync(path.join(fixtures, spec.fixture, file), path.join(dir, file), { recursive: true });
  }
  writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(spec.pkg, null, 2)}\n`);
  if (spec.tsconfig) {
    writeFileSync(path.join(dir, 'tsconfig.json'), spec.tsconfig);
  }
  for (const [file, content] of Object.entries(spec.extra ?? {})) {
    writeFileSync(path.join(dir, file), content);
  }
  const install = sh(
    `npm install --no-audit --no-fund -D "${tarball}" ${spec.install.join(' ')}`,
    dir,
  );
  expect(install.code, install.output).toBe(0);
  const init = sh(`npx code-guidelines init ${spec.init}`, dir);
  expect(init.code, init.output).toBe(0);
  return dir;
}

/** Packages that belong to features a consumer may not use. */
const TYPESCRIPT_PACKAGES = ['typescript', 'typescript-eslint', '@typescript-eslint/parser'];
const ANGULAR_PACKAGES = ['angular-eslint', '@angular-eslint/eslint-plugin', '@angular/core'];
const VITEST_PACKAGES = ['@vitest/eslint-plugin', 'vitest'];

/**
 * npm installs flat, so anything pulled in at any depth shows up in the root node_modules.
 * @param {string} dir
 * @param {string[]} names
 */
function expectNotInstalled(dir, names) {
  const installed = names.filter((name) => existsSync(path.join(dir, 'node_modules', name)));
  expect(installed).toEqual([]);
}

/**
 * @param {string} dir
 * @param {{ typecheck?: boolean, knip?: boolean }} [options]
 */
function expectWorkflowPasses(dir, { typecheck = true, knip = true } = {}) {
  for (const command of [
    'npx eslint . --max-warnings 0',
    'npx prettier --check .',
    ...(typecheck ? ['npm run typecheck'] : []),
    ...(knip ? ['npx knip'] : []),
    'npx code-guidelines check',
  ]) {
    const result = sh(command, dir);
    expect(result.code, `${command}\n${result.output}`).toBe(0);
  }
}

describe.skipIf(process.env.SKIP_PACK_TEST)('packed package', () => {
  it(
    'plain JavaScript consumer',
    () => {
      const dir = consumer({
        fixture: 'plain-js',
        files: ['clean.js'],
        pkg: { name: 'plain', private: true, type: 'module', main: 'clean.js' },
        install: [version('eslint'), version('prettier'), version('knip')],
        init: '--env browser --no-typescript',
      });
      expectNotInstalled(dir, [...TYPESCRIPT_PACKAGES, ...ANGULAR_PACKAGES, ...VITEST_PACKAGES]);
      expect(existsSync(path.join(dir, 'tsconfig.json'))).toBe(false);
      expectWorkflowPasses(dir, { typecheck: false });
    },
    PACK_TIMEOUT,
  );

  it(
    'plain JavaScript consumer with vitest',
    () => {
      const dir = consumer({
        fixture: 'plain-js',
        files: ['clean.js'],
        pkg: { name: 'plain-vitest', private: true, type: 'module', main: 'clean.js' },
        extra: {
          'clean.test.js': [
            "import { expect, it } from 'vitest';",
            '',
            "import { greet } from './clean.js';",
            '',
            "it('greets', () => {",
            "  expect(greet('Ada').textContent).toBe('Hello Ada');",
            '});',
            '',
          ].join('\n'),
        },
        install: [
          version('eslint'),
          version('prettier'),
          version('knip'),
          version('vitest'),
          version('@vitest/eslint-plugin'),
        ],
        init: '--env browser --no-typescript --vitest',
      });
      // typescript itself arrives through @vitest/eslint-plugin (documented); the TypeScript
      // tooling and Angular do not
      expectNotInstalled(dir, [
        'typescript-eslint',
        '@typescript-eslint/parser',
        ...ANGULAR_PACKAGES,
      ]);
      expectWorkflowPasses(dir, { typecheck: false });
    },
    PACK_TIMEOUT,
  );

  it(
    'Node/TS consumer with vitest',
    () => {
      const dir = consumer({
        fixture: 'node-ts',
        files: ['src/clean.ts', 'src/util.ts', 'src/util.spec.ts', 'vitest.config.ts'],
        pkg: { name: 'node-consumer', private: true, type: 'module', main: 'src/clean.ts' },
        tsconfig: '{\n  "compilerOptions": { "noEmit": true },\n  "include": ["src"]\n}\n',
        install: [
          version('eslint'),
          version('typescript'),
          version('typescript-eslint'),
          version('prettier'),
          version('knip'),
          version('vitest'),
          version('@vitest/eslint-plugin'),
          version('@types/node'),
        ],
        init: '--env node --vitest',
      });
      expectNotInstalled(dir, ANGULAR_PACKAGES);
      expectWorkflowPasses(dir);
    },
    PACK_TIMEOUT,
  );

  it(
    'Angular consumer, including strict template type checking',
    () => {
      // mirrors `ng new` (Angular 22): a solution-style root with app and spec references
      const ngNewTsconfig = `/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }]
}
`;
      const appTsconfig = `{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./out-tsc/app", "types": [] },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
`;
      const specTsconfig = `{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./out-tsc/spec", "types": ["vitest/globals"] },
  "include": ["src/**/*.ts"]
}
`;
      const dir = consumer({
        fixture: 'angular',
        files: [
          'src/app/user-profile.ts',
          'src/app/user-profile.html',
          'src/app/conventions.ts',
          'src/app/shout.pipe.ts',
          'src/app/toggle.module.ts',
          'src/app/reactive.ts',
          'src/app/shout.pipe.spec.ts',
        ],
        pkg: { name: 'ng-consumer', private: true },
        tsconfig: ngNewTsconfig,
        extra: { 'tsconfig.app.json': appTsconfig, 'tsconfig.spec.json': specTsconfig },
        install: [
          version('eslint'),
          version('typescript'),
          version('typescript-eslint'),
          version('prettier'),
          version('knip'),
          version('angular-eslint'),
          version('@angular/core'),
          version('@angular/common'),
          version('@angular/compiler'),
          version('@angular/compiler-cli'),
          version('@angular/forms'),
          version('@angular/platform-browser'),
          version('rxjs'),
          version('tslib'),
          version('vitest'),
          version('@vitest/eslint-plugin'),
        ],
        init: '--angular --prefix app --vitest',
      });
      expect(readFileSync(path.join(dir, 'tsconfig.json'), 'utf8')).toContain(
        '"extends": "@devenvy/code-guidelines/tsconfig/angular.json"',
      );
      // knip needs a real Angular workspace (angular.json, main.ts) to find entry points; the
      // fixture is only components
      expectWorkflowPasses(dir, { knip: false });

      // strictTemplates comes from the packaged base: a template type error must fail ngc
      writeFileSync(
        path.join(dir, 'src/app/user-profile.html'),
        '<p>{{ name().toFixed(2) }}</p>\n',
      );
      const typecheck = sh('npm run typecheck', dir);
      expect(typecheck.code).not.toBe(0);
      expect(typecheck.output).toContain('toFixed');
    },
    PACK_TIMEOUT,
  );
});
