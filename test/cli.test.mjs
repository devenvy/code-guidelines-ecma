import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { run } from '../src/cli/index.mjs';
import { BLOCK_START } from '../src/cli/lib/blocks.mjs';

/** @type {string[]} */
const dirs = [];

/** Workflow files that satisfy the CI convention check. */
const WORKFLOWS = path.join(import.meta.dirname, 'fixtures/workflows');

/** Creates a temp project with the convention's workflow files and the given files. */
function project(files = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cg-cli-'));
  dirs.push(dir);
  // a repository root: lockfile detection never looks above it
  mkdirSync(path.join(dir, '.git'));
  cpSync(WORKFLOWS, dir, { recursive: true });
  const all = {
    'package.json': '{\n  "name": "demo",\n  "scripts": {\n    "build": "x"\n  }\n}\n',
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const read = (dir, name) => readFileSync(path.join(dir, name), 'utf8');
const json = (dir, name) => JSON.parse(read(dir, name));
const cli = (dir, ...args) => run(args, dir);

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('init', () => {
  it('sets up a node project and check passes', async () => {
    const dir = project();
    const result = await cli(dir, 'init', '--env', 'node', '--vitest');
    expect(result.code).toBe(0);
    expect(read(dir, 'eslint.config.mjs')).toContain("env: 'node'");
    expect(read(dir, 'eslint.config.mjs')).toContain('vitest: true');
    // no "include": the whole project type-checks, except root tool configs
    expect(json(dir, 'tsconfig.json')).toEqual({
      extends: '@devenvy/code-guidelines/tsconfig/node.json',
      compilerOptions: {},
      exclude: ['node_modules', 'dist', 'coverage', '*.config.*'],
    });
    expect(result.output.at(-1)).toBe(
      'Install missing peers: npm i -D eslint prettier knip typescript typescript-eslint @vitest/eslint-plugin @types/node',
    );
    const pkg = json(dir, 'package.json');
    expect(pkg.prettier).toBe('@devenvy/code-guidelines/prettier');
    expect(pkg.codeGuidelines).toEqual({
      env: 'node',
      typescript: true,
      angular: false,
      vitest: true,
    });
    expect(pkg.scripts).toMatchObject({
      build: 'x',
      lint: 'eslint . --max-warnings 0',
      typecheck: 'tsc --noEmit',
      'test:ci': 'vitest run --coverage',
    });
    expect(read(dir, '.nvmrc')).toBe('24\n');
    expect(
      read(dir, '.editorconfig').startsWith('root = true\n\n# >>> @devenvy/code-guidelines >>>\n'),
    ).toBe(true);
    expect(json(dir, '.vscode/extensions.json').recommendations).toContain('vitest.explorer');
    expect(await cli(dir, 'check')).toEqual({
      code: 0,
      output: ['code-guidelines: everything matches.'],
    });
  });

  it('sets up an angular project with the angular prettier config', async () => {
    const dir = project({ 'tsconfig.spec.json': '{}' });
    const result = await cli(dir, 'init', '--angular', '--prefix', 'sw');
    expect(result.code).toBe(0);
    expect(result.output.at(-1)).toBe(
      'Install missing peers: npm i -D eslint prettier knip typescript typescript-eslint angular-eslint',
    );
    expect(read(dir, 'eslint.config.mjs')).toContain("angular: { prefix: 'sw' }");
    expect(read(dir, 'eslint.config.mjs')).toContain("env: 'browser'");
    const pkg = json(dir, 'package.json');
    expect(pkg.prettier).toBe('@devenvy/code-guidelines/prettier/angular');
    expect(pkg.scripts.typecheck).toBe(
      'ngc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit',
    );
    expect(pkg.scripts['test:ci']).toBeUndefined(); // no --vitest
    expect(json(dir, '.vscode/extensions.json').recommendations).toContain('angular.ng-template');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('adds the Angular test:ci script with --vitest', async () => {
    const dir = project();
    await cli(dir, 'init', '--angular', '--prefix', 'app', '--vitest');
    expect(json(dir, 'package.json').scripts['test:ci']).toBe('ng test --watch=false --coverage');
  });

  it('rejects a prefix that is not kebab-case', async () => {
    const result = await cli(project(), 'init', '--angular', '--prefix', "a'b");
    expect(result.code).toBe(1);
    expect(result.output[0]).toContain('--prefix must be lowercase kebab-case');
  });

  it('sets up a plain JavaScript project without TypeScript', async () => {
    const dir = project();
    const result = await cli(dir, 'init', '--env', 'browser', '--no-typescript');
    expect(result.code).toBe(0);
    expect(result.output.at(-1)).toBe('Install missing peers: npm i -D eslint prettier knip');
    expect(read(dir, 'eslint.config.mjs')).toContain('typescript: false');
    expect(existsSync(path.join(dir, 'tsconfig.json'))).toBe(false);
    expect(json(dir, 'package.json').scripts.typecheck).toBeUndefined();
    expect(json(dir, '.vscode/settings.json')['typescript.tsdk']).toBeUndefined();
    expect(await cli(dir, 'check')).toEqual({
      code: 0,
      output: ['code-guidelines: everything matches.'],
    });
  });

  it('decides pnpm build scripts in a pnpm project, keeping existing decisions', async () => {
    const dir = project({
      'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
      'pnpm-workspace.yaml': '# ours\nallowBuilds:\n  esbuild: true\n',
    });
    expect((await cli(dir, 'init', '--env', 'node')).output).toContain(
      'updated pnpm-workspace.yaml',
    );
    expect(read(dir, 'pnpm-workspace.yaml')).toBe(
      '# ours\nallowBuilds:\n  esbuild: true\n  unrs-resolver: false\n',
    );
    expect((await cli(dir, 'check')).code).toBe(0);

    writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'allowBuilds: {}\n');
    expect((await cli(dir, 'check')).output).toContain(
      'pnpm-workspace.yaml: allowBuilds must set "unrs-resolver" to true or false (pnpm install fails otherwise)',
    );
    writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'allowBuilds:\n  unrs-resolver: true\n');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it.each([
    [
      'an empty allowBuilds, keeping its comment',
      'allowBuilds:\n  # esbuild: true\n',
      'allowBuilds:\n  # esbuild: true\n  unrs-resolver: false\n',
    ],
    [
      "pnpm's undecided placeholder",
      'allowBuilds:\n  unrs-resolver: set this to true or false\n',
      'allowBuilds:\n  unrs-resolver: false\n',
    ],
  ])('decides unrs-resolver over %s, in init and in sync', async (_case, workspace, decided) => {
    const dir = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': workspace });
    await cli(dir, 'init', '--env', 'node');
    expect(read(dir, 'pnpm-workspace.yaml')).toBe(decided);

    writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), workspace);
    expect((await cli(dir, 'check')).output.join('\n')).toContain('allowBuilds must set');
    await cli(dir, 'sync');
    expect(read(dir, 'pnpm-workspace.yaml')).toBe(decided);
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('keeps long pnpm-workspace.yaml values on one line', async () => {
    const long = `overrides:\n  pkg: https://example.com/${'x'.repeat(120)}.tgz\n`;
    const dir = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': long });
    await cli(dir, 'init', '--env', 'node');
    expect(read(dir, 'pnpm-workspace.yaml')).toBe(`${long}allowBuilds:\n  unrs-resolver: false\n`);
  });

  it("leaves build decisions to pnpm's permissions setting when it is used", async () => {
    const workspace = 'permissions:\n  unrs-resolver: deny\n';
    const dir = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': workspace });
    await cli(dir, 'init', '--env', 'node');
    expect(read(dir, 'pnpm-workspace.yaml')).toBe(workspace);
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('uses the workspace root lockfile and pnpm-workspace.yaml for a workspace package', async () => {
    const root = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': "packages: ['apps/*']\n" });
    const dir = path.join(root, 'apps/web');
    mkdirSync(dir, { recursive: true });
    cpSync(WORKFLOWS, dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{ "name": "web" }\n');
    const result = await cli(dir, 'init', '--env', 'node');
    expect(result.output).toContain('updated ../../pnpm-workspace.yaml');
    expect(result.output.at(-1)).toMatch(/^Install missing peers: pnpm add -D /);
    expect(read(root, 'pnpm-workspace.yaml')).toBe(
      "packages: ['apps/*']\nallowBuilds:\n  unrs-resolver: false\n",
    );
    expect(existsSync(path.join(dir, 'pnpm-workspace.yaml'))).toBe(false);
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it("updates the workspace's pnpm-workspace.yaml for a package with its own lockfile", async () => {
    // sharedWorkspaceLockfile: false gives every workspace package its own pnpm-lock.yaml
    const root = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': "packages: ['apps/*']\n" });
    const dir = path.join(root, 'apps/web');
    mkdirSync(dir, { recursive: true });
    cpSync(WORKFLOWS, dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{ "name": "web" }\n');
    writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    expect((await cli(dir, 'init', '--env', 'node')).output).toContain(
      'updated ../../pnpm-workspace.yaml',
    );
    expect(existsSync(path.join(dir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('never looks above a project that is not in a git repository', async () => {
    const home = mkdtempSync(path.join(tmpdir(), 'cg-home-'));
    dirs.push(home);
    writeFileSync(path.join(home, 'pnpm-lock.yaml'), '');
    const dir = path.join(home, 'proj');
    mkdirSync(dir);
    cpSync(WORKFLOWS, dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{ "name": "proj" }\n');
    const result = await cli(dir, 'init', '--env', 'node');
    expect(result.output.at(-1)).toMatch(/^Install missing peers: npm i -D /);
    expect(existsSync(path.join(home, 'pnpm-workspace.yaml'))).toBe(false);
    expect(existsSync(path.join(dir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it.each([
    ['a list', '- a\n', /pnpm-workspace.yaml must be a YAML map/],
    ['allowBuilds set to a list', 'allowBuilds: [esbuild]\n', /allowBuilds must map package names/],
  ])('reports a pnpm-workspace.yaml that is %s', async (_case, workspace, message) => {
    const dir = project({ 'pnpm-lock.yaml': '' });
    await cli(dir, 'init', '--env', 'node');
    writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), workspace);
    for (const command of ['check', 'sync']) {
      const result = await cli(dir, command);
      expect(result.code).toBe(1);
      expect(result.output[0]).toMatch(message);
    }
  });

  it('leaves pnpm-workspace.yaml alone outside pnpm projects', async () => {
    const dir = project();
    await cli(dir, 'init', '--env', 'node');
    expect(existsSync(path.join(dir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('reports an invalid pnpm-workspace.yaml', async () => {
    const dir = project({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': 'allowBuilds: [\n' });
    expect((await cli(dir, 'init', '--env', 'node')).output[0]).toMatch(
      /^code-guidelines: pnpm-workspace.yaml is not valid YAML \(.+\); fix it and re-run$/,
    );
  });

  it('asks a plain JavaScript project with vitest only for the vitest plugin', async () => {
    const result = await cli(project(), 'init', '--env', 'node', '--no-typescript', '--vitest');
    expect(result.output.at(-1)).toBe(
      'Install missing peers: npm i -D eslint prettier knip @vitest/eslint-plugin',
    );
  });

  it('prints usage for unknown flags and commands', async () => {
    expect(await cli(project(), 'init', '--nope')).toMatchObject({ code: 2 });
    expect((await cli(project(), 'frobnicate')).output[0]).toContain('Usage: code-guidelines');
  });

  it('requires --env without --angular and --prefix with --angular', async () => {
    expect((await cli(project(), 'init')).output[0]).toMatch(/--env node\|browser is required/);
    expect((await cli(project(), 'init', '--angular')).output[0]).toMatch(
      /--angular requires --prefix/,
    );
  });

  it('stops on an existing eslint.config.js without writing anything', async () => {
    const dir = project({ 'eslint.config.js': 'module.exports = [];\n', '.prettierrc': '{}' });
    const result = await cli(dir, 'init', '--env', 'node');
    expect(result.code).toBe(1);
    expect(result.output.join('\n')).toContain('eslint.config.js: existing ESLint config');
    expect(result.output.join('\n')).toContain('.prettierrc');
    expect(existsSync(path.join(dir, 'eslint.config.mjs'))).toBe(false);
    expect(existsSync(path.join(dir, '.editorconfig'))).toBe(false);
  });

  it('replaces conflicting config with --force', async () => {
    const dir = project({ 'eslint.config.js': 'module.exports = [];\n', '.prettierrc': '{}' });
    expect((await cli(dir, 'init', '--env', 'node', '--force')).code).toBe(0);
    expect(existsSync(path.join(dir, 'eslint.config.js'))).toBe(false);
    expect(existsSync(path.join(dir, '.prettierrc'))).toBe(false);
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('is idempotent', async () => {
    const dir = project();
    await cli(dir, 'init', '--env', 'node');
    const before =
      read(dir, 'package.json') + read(dir, '.editorconfig') + read(dir, 'tsconfig.json');
    expect((await cli(dir, 'init', '--env', 'node')).code).toBe(0);
    expect(
      read(dir, 'package.json') + read(dir, '.editorconfig') + read(dir, 'tsconfig.json'),
    ).toBe(before);
  });

  it('preserves a CRLF package.json', async () => {
    const dir = project({ 'package.json': '{\r\n  "name": "demo"\r\n}\r\n' });
    await cli(dir, 'init', '--env', 'node');
    const text = read(dir, 'package.json');
    expect(text).toContain('\r\n');
    expect(text.replaceAll('\r\n', '')).not.toContain('\n');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('migrates an ng new tsconfig onto the angular base', async () => {
    const ngNew = `/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
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
    "module": "preserve",
    "outDir": "./dist/out-tsc"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": []
}
`;
    const dir = project({ 'tsconfig.json': ngNew });
    const result = await cli(dir, 'init', '--angular', '--prefix', 'app');
    expect(result.code).toBe(0);
    const text = read(dir, 'tsconfig.json');
    expect(text).toContain('To learn more about Typescript');
    expect(text).toContain('"extends": "@devenvy/code-guidelines/tsconfig/angular.json"');
    expect(text).toContain('"outDir": "./dist/out-tsc"');
    expect(text).not.toContain('noImplicitOverride');
    expect(text).not.toContain('strictInjectionParameters');
    expect(text).not.toContain('angularCompilerOptions');
    expect(text.indexOf('"extends"')).toBeLessThan(text.indexOf('"compilerOptions"'));
    expect(text).toContain('"files": []');
  });

  it('keeps tsconfig options that differ from the base and reports them', async () => {
    const dir = project({
      'tsconfig.json': '{ "compilerOptions": { "target": "ES2020", "strict": true } }\n',
    });
    const result = await cli(dir, 'init', '--env', 'node');
    expect(result.output.join('\n')).toContain('kept compilerOptions.target = "ES2020"');
    expect(read(dir, 'tsconfig.json')).not.toContain('"strict"');
  });
});

describe('check', () => {
  /** A fully initialised node project. */
  async function initialised() {
    const dir = project();
    await cli(dir, 'init', '--env', 'node');
    return dir;
  }

  it('fails when a managed block was edited, and sync restores it', async () => {
    const dir = await initialised();
    writeFileSync(
      path.join(dir, '.editorconfig'),
      read(dir, '.editorconfig').replace('indent_size = 2', 'indent_size = 4'),
    );
    const result = await cli(dir, 'check');
    expect(result.code).toBe(1);
    expect(result.output.join('\n')).toContain('- indent_size = 2\n+ indent_size = 4');
    expect((await cli(dir, 'sync', '--dry-run')).output.join('\n')).toContain(
      'would update .editorconfig',
    );
    expect((await cli(dir, 'check')).code).toBe(1);
    await cli(dir, 'sync');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('keeps consumer content outside the block through sync', async () => {
    const dir = await initialised();
    writeFileSync(
      path.join(dir, '.editorconfig'),
      `${read(dir, '.editorconfig')}\n[*.cs]\nindent_size = 4\n`,
    );
    await cli(dir, 'sync');
    expect(read(dir, '.editorconfig')).toContain('[*.cs]\nindent_size = 4\n');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('fails when the ESLint config no longer uses createConfig', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];\n');
    expect((await cli(dir, 'check')).output.join('\n')).toContain('does not use createConfig');
  });

  it('fails when the prettier key is removed', async () => {
    const dir = await initialised();
    const pkg = json(dir, 'package.json');
    delete pkg.prettier;
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    expect((await cli(dir, 'check')).output.join('\n')).toContain(
      '"prettier" should be "@devenvy/code-guidelines/prettier"',
    );
  });

  it('fails when tsconfig no longer extends the base', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
    expect((await cli(dir, 'check')).output.join('\n')).toContain(
      'does not extend @devenvy/code-guidelines/tsconfig/',
    );
  });

  it('follows relative tsconfig extends', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, 'tsconfig.base.json'), read(dir, 'tsconfig.json'));
    writeFileSync(path.join(dir, 'tsconfig.json'), '{ "extends": "./tsconfig.base.json" }');
    expect((await cli(dir, 'check')).code).toBe(0);
  });

  it('fails on a stray prettier config file and a second eslint config', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, '.prettierrc.json'), '{}');
    writeFileSync(path.join(dir, 'eslint.config.js'), 'export default [];');
    const output = (await cli(dir, 'check')).output.join('\n');
    expect(output).toContain('.prettierrc.json: overrides package.json "prettier"');
    expect(output).toContain('more than one ESLint config');
  });

  it('fails when the angular choice and the ESLint config disagree', async () => {
    const dir = await initialised();
    const pkg = json(dir, 'package.json');
    pkg.codeGuidelines.angular = true;
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    expect((await cli(dir, 'check')).output.join('\n')).toContain('codeGuidelines.angular is true');
  });

  it('explains when init has not run', async () => {
    expect((await cli(project(), 'check')).output[0]).toContain('Run: code-guidelines init');
  });

  it('refuses to sync a file with a leftover block marker', async () => {
    const dir = await initialised();
    const text = read(dir, '.gitattributes').replace('# <<< @devenvy/code-guidelines <<<\n', '');
    writeFileSync(path.join(dir, '.gitattributes'), text);
    const result = await cli(dir, 'sync');
    expect(result.code).toBe(1);
    expect(result.output[0]).toContain(
      '.gitattributes has an incomplete @devenvy/code-guidelines block',
    );
  });

  it('names a malformed JSON file instead of crashing', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, '.vscode/settings.json'), '{ "a": ');
    const result = await cli(dir, 'check');
    expect(result.code).toBe(1);
    expect(result.output[0]).toContain('.vscode/settings.json is not valid JSON');
  });

  it('accepts a managed block placed by init in a file the dotnet package also manages', async () => {
    const dir = project({ '.editorconfig': 'root = true\n\n[*.cs]\nindent_size = 4\n' });
    await cli(dir, 'init', '--env', 'node');
    const text = read(dir, '.editorconfig');
    expect(text.indexOf(BLOCK_START)).toBeLessThan(text.indexOf('[*.cs]'));
    expect(text.match(/root = true/g)).toHaveLength(1);
  });
});

describe('check: CI convention', () => {
  const CI = '.github/workflows/ci.yml';

  /** An initialised node project with Vitest. */
  async function initialised() {
    const dir = project();
    await cli(dir, 'init', '--env', 'node', '--vitest');
    return dir;
  }

  /** Problems check reports, one per line. */
  async function problems(dir) {
    return (await cli(dir, 'check')).output;
  }

  // A repo chooses how it releases, so no release workflow is required.
  it('reports every missing workflow file except a release workflow', async () => {
    const dir = await initialised();
    rmSync(path.join(dir, '.github'), { recursive: true });
    const output = await problems(dir);
    expect(output).toEqual(
      expect.arrayContaining([
        `${CI}: missing`,
        '.github/workflows/scorecard.yml: missing',
        '.github/dependabot.yml: missing',
      ]),
    );
    expect(output.some((line) => line.includes('release'))).toBe(false);
  });

  it('reports jobs and steps that drift from the convention', async () => {
    const dir = await initialised();
    const ci = read(dir, CI)
      .replace('      - run: pnpm run knip\n', '')
      .replace('      - uses: zizmorcore/zizmor-action@v0\n', '')
      .replace('      - run: pnpm run test:ci\n', '      - run: pnpm test\n')
      .replace('actions/dependency-review-action@v5', 'actions/checkout@v7')
      .replace('  audit:\n    steps:\n      - run: pnpm audit --prod\n', '')
      .replace('    if: always()\n', '')
      .replace('  dependabot-auto-merge:', '  docker:\n    steps: []\n  dependabot-auto-merge:');
    writeFileSync(path.join(dir, CI), ci);
    expect(await problems(dir)).toEqual(
      expect.arrayContaining([
        `${CI}: missing job "audit"`,
        `${CI}: job "result" must run with if: always()`,
        `${CI}: job "result" must need every job; missing: docker`,
        `${CI}: job "lint" must run the "knip" script`,
        `${CI}: job "test" must run the "test:ci" script`,
        `${CI}: job "lint" must run zizmor`,
        `${CI}: job "dependency-review" must use actions/dependency-review-action`,
      ]),
    );
  });

  it('requires a pull_request trigger and valid YAML', async () => {
    const dir = await initialised();
    writeFileSync(path.join(dir, CI), read(dir, CI).replace(/^on:\n.*\n/m, 'on: push\n'));
    writeFileSync(path.join(dir, '.github/workflows/scorecard.yml'), 'jobs: [\n');
    const output = await problems(dir);
    expect(output).toContain(`${CI}: must run on pull_request`);
    expect(output.join('\n')).toContain('.github/workflows/scorecard.yml: invalid YAML');
  });

  it('accepts every form of the pull_request trigger', async () => {
    const dir = await initialised();
    for (const on of [
      'on: pull_request\n',
      'on: [push, pull_request]\n',
      'on:\n  pull_request:\n',
      'on:\n  pull_request:\n    types: [opened]\n',
    ]) {
      const text = read(dir, CI);
      writeFileSync(path.join(dir, CI), on + text.slice(text.indexOf('jobs:')));
      expect(await problems(dir)).not.toContain(`${CI}: must run on pull_request`);
    }
  });

  it('requires the scripts CI runs', async () => {
    const dir = await initialised();
    const pkg = json(dir, 'package.json');
    delete pkg.scripts.knip;
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    expect(await problems(dir)).toContain('package.json: missing script "knip" (CI runs it)');
  });

  it('requires typecheck in CI only for TypeScript projects', async () => {
    const withoutTypecheck = (/** @type {string} */ dir) =>
      writeFileSync(
        path.join(dir, CI),
        read(dir, CI).replace('      - run: pnpm run typecheck\n', ''),
      );
    const ts = await initialised();
    withoutTypecheck(ts);
    expect(await problems(ts)).toContain(`${CI}: job "lint" must run the "typecheck" script`);

    const js = project();
    await cli(js, 'init', '--env', 'browser', '--no-typescript');
    withoutTypecheck(js);
    expect((await cli(js, 'check')).code).toBe(0);
  });

  it('skips the workflow checks with codeGuidelines.workflows: false', async () => {
    const dir = await initialised();
    rmSync(path.join(dir, '.github'), { recursive: true });
    const pkg = json(dir, 'package.json');
    pkg.codeGuidelines.workflows = false;
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    expect((await cli(dir, 'check')).code).toBe(0);
  });
});
