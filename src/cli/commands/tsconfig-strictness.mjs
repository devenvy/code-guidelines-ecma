import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonc } from '../lib/json.mjs';
import { readText } from '../lib/text.mjs';
import { findProjectFiles } from '../lib/walk.mjs';

const PACKAGE_PREFIX = '@devenvy/code-guidelines/tsconfig/';
const BASES_DIR = realpathSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../tsconfig'),
);
const MAX_EXTENDS_DEPTH = 10;
const TSCONFIG = /^tsconfig(?:\..+)?\.json$/;

/** Checks that turning off weakens type checking; the bases turn all of them on. */
const CHECKS = {
  compilerOptions: [
    'strict',
    'noImplicitOverride',
    'noImplicitReturns',
    'noFallthroughCasesInSwitch',
    'noPropertyAccessFromIndexSignature',
    'noUncheckedIndexedAccess',
    'isolatedModules',
    'forceConsistentCasingInFileNames',
    'checkJs',
  ],
  angularCompilerOptions: [
    'strictTemplates',
    'strictInjectionParameters',
    'strictInputAccessModifiers',
  ],
};

/** Flags an umbrella option turns on, which can still be turned off one by one. */
const FAMILIES = {
  compilerOptions: {
    strict: [
      'alwaysStrict',
      'noImplicitAny',
      'noImplicitThis',
      'strictBindCallApply',
      'strictBuiltinIteratorReturn',
      'strictFunctionTypes',
      'strictNullChecks',
      'strictPropertyInitialization',
      'useUnknownInCatchVariables',
    ],
  },
  angularCompilerOptions: {
    strictTemplates: [
      'strictAttributeTypes',
      'strictContextGenerics',
      'strictDomEventTypes',
      'strictDomLocalRefTypes',
      'strictInputTypes',
      'strictLiteralTypes',
      'strictNullInputTypes',
      'strictOutputEventTypes',
      'strictSafeNavigationTypes',
    ],
  },
};

/**
 * @typedef {{ file: string, message: string }} Problem
 * @typedef {Record<string, unknown>} Options
 * @typedef {{ compilerOptions: Options, angularCompilerOptions: Options }} Resolved
 */

/**
 * Every tsconfig*.json in the project must extend a packaged base (directly or through other
 * tsconfigs) and must not turn off a check the base turns on.
 * @param {string} dir
 * @returns {Problem[]}
 */
export function checkTsconfigStrictness(dir) {
  if (!readText(path.join(dir, 'tsconfig.json')).exists) {
    return [{ file: 'tsconfig.json', message: 'missing' }];
  }
  return findProjectFiles(dir, (name) => TSCONFIG.test(name)).flatMap((file) => {
    const relative = path.relative(dir, file).replaceAll('\\', '/');
    /** @type {string[]} */
    const messages = [];
    try {
      const { resolved, base } = resolve(file, 0);
      if (base) {
        messages.push(...weakened(resolve(base, 0).resolved, resolved));
      } else {
        messages.push(`does not extend ${PACKAGE_PREFIX}<base>.json`);
      }
    } catch (error) {
      messages.push(/** @type {Error} */ (error).message);
    }
    return messages.map((message) => ({ file: relative, message }));
  });
}

/**
 * Merges a tsconfig with everything it extends, and finds the packaged base it reaches.
 * @param {string} file absolute
 * @param {number} depth
 * @returns {{ resolved: Resolved, base: string | null }}
 */
function resolve(file, depth) {
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error('extends nests too deep (a cycle?)');
  }
  const json = parseJsonc(readText(file).text, path.basename(file));
  const raw = json.extends;
  const parents = (Array.isArray(raw) ? raw : [raw]).filter((value) => typeof value === 'string');
  /** @type {Resolved} */
  const resolved = { compilerOptions: {}, angularCompilerOptions: {} };
  /** @type {string | null} */
  let base = isBase(file) ? file : null;
  for (const parent of parents) {
    const inherited = resolve(locate(parent, file), depth + 1);
    Object.assign(resolved.compilerOptions, inherited.resolved.compilerOptions);
    Object.assign(resolved.angularCompilerOptions, inherited.resolved.angularCompilerOptions);
    base ??= inherited.base;
  }
  Object.assign(resolved.compilerOptions, json.compilerOptions);
  Object.assign(resolved.angularCompilerOptions, json.angularCompilerOptions);
  return { resolved, base };
}

/**
 * @param {string} spec an `extends` value
 * @param {string} from the tsconfig that has it
 * @returns {string}
 */
function locate(spec, from) {
  if (spec.startsWith(PACKAGE_PREFIX)) {
    return path.join(BASES_DIR, spec.slice(PACKAGE_PREFIX.length));
  }
  if (spec.startsWith('.') || path.isAbsolute(spec)) {
    const full = path.resolve(path.dirname(from), spec);
    const file = full.endsWith('.json') ? full : `${full}.json`;
    if (!existsSync(file)) {
      throw new Error(`extends "${spec}", which does not exist`);
    }
    return file;
  }
  try {
    return createRequire(from).resolve(spec);
  } catch {
    throw new Error(`extends "${spec}", which cannot be resolved`);
  }
}

/** @param {string} file */
function isBase(file) {
  return path.dirname(realpathSync(file)) === BASES_DIR;
}

/**
 * Checks the base turns on that `resolved` turns off.
 * @param {Resolved} base
 * @param {Resolved} resolved
 * @returns {string[]}
 */
function weakened(base, resolved) {
  /** @type {string[]} */
  const messages = [];
  for (const section of /** @type {const} */ (['compilerOptions', 'angularCompilerOptions'])) {
    const want = base[section];
    const got = resolved[section];
    const families = /** @type {Record<string, string[]>} */ (FAMILIES[section]);
    for (const option of CHECKS[section].filter((name) => want[name] === true)) {
      if (got[option] !== true) {
        messages.push(`${section}.${option} must stay true (the base sets it)`);
      }
      for (const member of families[option] ?? []) {
        if (got[member] === false) {
          messages.push(`${section}.${member} must not be false (the base sets ${option})`);
        }
      }
    }
  }
  return messages;
}
