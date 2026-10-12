import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

import { applyEdits, modify } from 'jsonc-parser';

import { formatWritten } from '../lib/format.mjs';
import { mergeJson, parseJsonc } from '../lib/json.mjs';
import {
  detectPackageManager,
  ESLINT_CONFIG_FILES,
  findFiles,
  installCommand,
  LEGACY_ESLINT_FILES,
  missingPackages,
  PRETTIER_CONFIG_FILES,
} from '../lib/project.mjs';
import { readText, writeText } from '../lib/text.mjs';
import { eslintConfigFor, prettierConfigFor, resolvedBase, tsconfigBaseFor } from '../managed.mjs';
import { CliError } from './choices.mjs';
import { planManaged, writeChanges } from './sync.mjs';

/**
 * @typedef {object} InitFlags
 * @property {'browser' | 'node'} [env]
 * @property {boolean} [angular]
 * @property {string} [prefix]
 * @property {boolean} [vitest]
 * @property {boolean} [typescript] default true; `--no-typescript` sets false
 * @property {boolean} [force]
 */

const OUR_ESLINT_IMPORT = '@devenvy/code-guidelines/eslint';
const JSON_INDENT = 2;

/**
 * `code-guidelines init`
 * @param {string} dir
 * @param {InitFlags} flags
 * @returns {Promise<{ ok: boolean, output: string[] }>}
 */
export async function init(dir, flags) {
  const pkgFile = path.join(dir, 'package.json');
  const pkg = readText(pkgFile);
  if (!pkg.exists) {
    throw new CliError('No package.json found. Run code-guidelines init in a package root.');
  }
  const choices = choicesFrom(flags);
  const output = [];

  // 1. conflicts: stop before writing anything unless --force
  const conflicts = findConflicts(dir, parseJsonc(pkg.text, 'package.json'), choices);
  if (conflicts.length > 0 && !flags.force) {
    return {
      ok: false,
      output: [
        'Existing configuration would conflict with @devenvy/code-guidelines:',
        ...conflicts.map((c) => `  ${c.file}: ${c.reason}`),
        'Nothing was written. Re-run with --force to replace them.',
      ],
    };
  }
  for (const conflict of conflicts) {
    if (conflict.remove) {
      rmSync(path.join(dir, conflict.file));
      output.push(`removed ${conflict.file}`);
    }
  }

  // 2. tsconfig (plain JavaScript projects have none)
  if (choices.typescript) {
    output.push(...writeTsconfig(dir, choices));
  }

  // 3. consumer-owned files, only when absent
  const eslintFile = path.join(dir, 'eslint.config.mjs');
  if (findFiles(dir, ESLINT_CONFIG_FILES).length === 0) {
    writeText(eslintFile, eslintConfigFor(choices));
    output.push('created eslint.config.mjs');
  }
  if (!existsSync(path.join(dir, '.nvmrc'))) {
    writeText(path.join(dir, '.nvmrc'), '24\n');
    output.push('created .nvmrc');
  }

  // 4. package.json
  const scripts = scriptsFor(dir, choices);
  const current = parseJsonc(pkg.text, 'package.json');
  const pkgText = mergeJson(pkg.text, [
    { path: ['prettier'], value: prettierConfigFor(choices) },
    {
      path: ['codeGuidelines'],
      value: {
        env: choices.env,
        typescript: choices.typescript,
        angular: choices.angular,
        vitest: choices.vitest,
      },
    },
    ...Object.entries(scripts)
      .filter(([name]) => current.scripts?.[name] === undefined)
      .map(([name, command]) => ({ path: ['scripts', name], value: command })),
  ]);
  if (pkgText !== pkg.text) {
    writeText(pkgFile, pkgText, pkg.eol);
    output.push('updated package.json');
  }

  // 5. managed content
  const changes = planManaged(dir, choices);
  writeChanges(dir, changes);
  output.push(
    ...changes.map((change) => `${change.before === '' ? 'created' : 'updated'} ${change.file}`),
  );

  // 6. format what was written with the project's Prettier (no-op until it is installed)
  const warnings = await formatWritten(
    dir,
    [
      'tsconfig.json',
      'eslint.config.mjs',
      'package.json',
      ...changes.map((change) => change.file),
    ].filter((file) => existsSync(path.join(dir, file))),
  );
  output.push(...warnings);

  // 7. peers: only what the chosen features use
  const missing = missingPackages(dir, peersFor(choices));
  if (missing.length > 0) {
    output.push('', `Install missing peers: ${installCommand(detectPackageManager(dir), missing)}`);
  }
  return { ok: true, output };
}

/**
 * Packages the project installs itself for the chosen features. (node.json sets
 * types: ["node"], so Node/TS projects need @types/node.)
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]}
 */
function peersFor(choices) {
  return [
    'eslint',
    'prettier',
    'knip',
    ...(choices.typescript ? ['typescript', 'typescript-eslint'] : []),
    ...(choices.angular ? ['angular-eslint'] : []),
    ...(choices.vitest ? ['@vitest/eslint-plugin'] : []),
    ...(choices.env === 'node' && choices.typescript ? ['@types/node'] : []),
  ];
}

/**
 * @param {InitFlags} flags
 * @returns {import('../managed.mjs').Choices & { prefix?: string }}
 */
function choicesFrom(flags) {
  const angular = flags.angular === true;
  if (angular && !flags.prefix) {
    throw new CliError('--angular requires --prefix <prefix>, e.g. --prefix app');
  }
  // the prefix is written into eslint.config.mjs, so only allow selector-safe values
  if (flags.prefix !== undefined && !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(flags.prefix)) {
    throw new CliError(
      `--prefix must be lowercase kebab-case (e.g. app, my-lib), got "${flags.prefix}"`,
    );
  }
  const env = flags.env ?? (angular ? 'browser' : undefined);
  if (env !== 'browser' && env !== 'node') {
    throw new CliError('--env node|browser is required (--angular implies browser)');
  }
  const typescript = flags.typescript !== false;
  if (angular && !typescript) {
    throw new CliError('--angular cannot be combined with --no-typescript');
  }
  return { env, typescript, angular, vitest: flags.vitest === true, prefix: flags.prefix };
}

/**
 * @param {string} dir
 * @param {any} pkg
 * @param {import('../managed.mjs').Choices} choices
 * @returns {{ file: string, reason: string, remove: boolean }[]}
 */
function findConflicts(dir, pkg, choices) {
  const conflicts = [];
  for (const file of findFiles(dir, ESLINT_CONFIG_FILES)) {
    if (!readText(path.join(dir, file)).text.includes(OUR_ESLINT_IMPORT)) {
      conflicts.push({ file, reason: 'existing ESLint config', remove: true });
    }
  }
  for (const file of findFiles(dir, LEGACY_ESLINT_FILES)) {
    conflicts.push({ file, reason: 'legacy ESLint config', remove: true });
  }
  for (const file of findFiles(dir, PRETTIER_CONFIG_FILES)) {
    conflicts.push({
      file,
      reason: 'Prettier config file (package.json "prettier" is used instead)',
      remove: true,
    });
  }
  if (pkg.prettier !== undefined && pkg.prettier !== prettierConfigFor(choices)) {
    conflicts.push({
      file: 'package.json',
      reason: `"prettier" is ${JSON.stringify(pkg.prettier)}`,
      remove: false,
    });
  }
  return conflicts;
}

/**
 * Writes tsconfig.json for new projects, or migrates an existing one onto the packaged base.
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]} output lines
 */
function writeTsconfig(dir, choices) {
  const base = tsconfigBaseFor(choices);
  const specifier = `@devenvy/code-guidelines/tsconfig/${base}.json`;
  const file = path.join(dir, 'tsconfig.json');
  const { exists, text, eol } = readText(file);
  if (!exists) {
    // No "include": TypeScript takes every project file, so tests and scripts outside src/ are
    // type-checked and lint with type information. Root tool configs (*.config.*) run under Node
    // and are linted untyped, so they stay out. Setting "exclude" drops TypeScript's defaults,
    // hence node_modules and build output are listed.
    const tsconfig = {
      extends: specifier,
      compilerOptions: {},
      exclude: ['node_modules', 'dist', 'coverage', '*.config.*'],
    };
    writeText(file, `${JSON.stringify(tsconfig, null, JSON_INDENT)}\n`);
    return ['created tsconfig.json'];
  }
  const json = parseJsonc(text, 'tsconfig.json');
  const current = (Array.isArray(json.extends) ? json.extends : [json.extends]).filter(Boolean);
  if (current.includes(specifier)) {
    return [];
  }
  const formattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' };
  const nextExtends = current.length === 0 ? specifier : [specifier, ...current];
  // `extends` goes first, where readers look for it
  let next = applyEdits(
    text,
    modify(text, ['extends'], nextExtends, { formattingOptions, getInsertionIndex: () => 0 }),
  );
  const output = [`updated tsconfig.json (extends ${specifier})`];
  const resolved = resolvedBase(base);
  for (const section of /** @type {const} */ (['compilerOptions', 'angularCompilerOptions'])) {
    const options = json[section] ?? {};
    const overlapping = Object.entries(options).filter(([key]) => key in resolved[section]);
    let removed = 0;
    for (const [key, value] of overlapping) {
      if (sameValue(value, resolved[section][key])) {
        next = applyEdits(next, modify(next, [section, key], undefined, { formattingOptions }));
        removed += 1;
      } else {
        output.push(
          `  kept ${section}.${key} = ${JSON.stringify(value)} (base has ${JSON.stringify(resolved[section][key])})`,
        );
      }
    }
    // drop a section the base now fully covers, rather than leaving an empty object
    if (removed > 0 && removed === Object.keys(options).length) {
      next = applyEdits(next, modify(next, [section], undefined, { formattingOptions }));
    }
  }
  writeText(file, next, eol);
  return output;
}

/**
 * Compares tsconfig values case-insensitively (TS accepts "ES2022" and "es2022").
 * @param {unknown} a
 * @param {unknown} b
 */
function sameValue(a, b) {
  const norm = (/** @type {unknown} */ v) => JSON.stringify(v).toLowerCase();
  return norm(a) === norm(b);
}

/**
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Record<string, string>}
 */
function scriptsFor(dir, choices) {
  /** @type {Record<string, string>} */
  const scripts = {
    lint: 'eslint . --max-warnings 0',
    format: 'prettier --write .',
    'format:check': 'prettier --check .',
    ...typecheckScript(dir, choices),
    knip: 'knip',
    'guidelines:check': 'code-guidelines check',
  };
  // CI runs test:ci (one run, with coverage for its thresholds)
  if (choices.vitest) {
    scripts['test:ci'] = choices.angular
      ? 'ng test --watch=false --coverage'
      : 'vitest run --coverage';
  }
  return scripts;
}

/**
 * Plain JavaScript projects have no TypeScript, so no typecheck.
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {{ typecheck?: string }}
 */
function typecheckScript(dir, choices) {
  if (choices.angular) {
    return {
      typecheck: existsSync(path.join(dir, 'tsconfig.spec.json'))
        ? 'ngc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit'
        : 'ngc -p tsconfig.app.json --noEmit',
    };
  }
  return choices.typescript ? { typecheck: 'tsc --noEmit' } : {};
}
