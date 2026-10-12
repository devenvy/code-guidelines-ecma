#!/usr/bin/env node
/*
 * Checks or applies the DevEnvy GitHub repository baseline (baseline.json) with the gh CLI.
 *
 *   node scripts/repo-settings/repo-settings.mjs check devenvy/storm-watch
 *   node scripts/repo-settings/repo-settings.mjs apply devenvy/storm-watch
 *   node scripts/repo-settings/repo-settings.mjs check devenvy/code-guidelines-ecma --required-check result
 *
 * Language-agnostic: used for code-guidelines-dotnet repos too. Not shipped in the npm package.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** The aggregate job every DevEnvy ci.yml defines. */
const DEFAULT_REQUIRED_CHECK = 'result';
const EXIT_USAGE = 2;

/**
 * @param {string} requiredCheck
 * @returns {any}
 */
export function loadBaseline(requiredCheck) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'baseline.json');
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  // substituted after parsing, so any check name is safe
  for (const rule of baseline.ruleset.rules) {
    for (const check of rule.parameters?.required_status_checks ?? []) {
      if (check.context === '{{requiredCheck}}') {
        check.context = requiredCheck;
      }
    }
  }
  return baseline;
}

/**
 * True when every key in `expected` deep-equals the same key in `actual` (extra keys ignored).
 * @param {unknown} expected
 * @param {unknown} actual
 * @returns {boolean}
 */
export function matches(expected, actual) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matches(item, actual[index]))
    );
  }
  if (expected && typeof expected === 'object') {
    return (
      Boolean(actual) &&
      typeof actual === 'object' &&
      Object.entries(expected).every(([key, value]) =>
        matches(value, /** @type {Record<string, unknown>} */ (actual)[key]),
      )
    );
  }
  return expected === actual;
}

/**
 * @typedef {object} CurrentSettings
 * @property {Record<string, unknown>} repository
 * @property {boolean} vulnerabilityAlerts
 * @property {boolean} automatedSecurityFixes
 * @property {boolean} privateVulnerabilityReporting
 * @property {Record<string, unknown> | null} codeScanningDefaultSetup
 * @property {Record<string, unknown>} actionsWorkflowPermissions
 * @property {boolean | null} pagesHttpsEnforced null when Pages is not enabled
 * @property {any} ruleset null when no ruleset with the baseline's name exists
 */

/**
 * Differences between the current settings and the baseline, one line each.
 * @param {CurrentSettings} current
 * @param {any} baseline
 * @returns {string[]}
 */
export function diffSettings(current, baseline) {
  /** @type {string[]} */
  const problems = [];
  for (const [key, value] of Object.entries(baseline.repository)) {
    if (current.repository[key] !== value) {
      problems.push(
        `repository.${key}: ${JSON.stringify(current.repository[key])} → ${JSON.stringify(value)}`,
      );
    }
  }
  const { security_and_analysis: security } =
    /** @type {{ security_and_analysis?: Record<string, { status?: string } | undefined> }} */ (
      current.repository
    );
  for (const [key, status] of Object.entries(baseline.securityAndAnalysis)) {
    if (security?.[key]?.status !== status) {
      problems.push(
        `security_and_analysis.${key}: ${security?.[key]?.status ?? 'unknown'} → ${status}`,
      );
    }
  }
  for (const key of [
    'vulnerabilityAlerts',
    'automatedSecurityFixes',
    'privateVulnerabilityReporting',
  ]) {
    const actual = current[/** @type {'vulnerabilityAlerts'} */ (key)];
    if (actual !== baseline[key]) {
      problems.push(`${key}: ${actual} → ${baseline[key]}`);
    }
  }
  if (!matches(baseline.codeScanningDefaultSetup, current.codeScanningDefaultSetup)) {
    problems.push(
      `code scanning default setup: ${JSON.stringify(current.codeScanningDefaultSetup)} → ${JSON.stringify(baseline.codeScanningDefaultSetup)}`,
    );
  }
  if (!matches(baseline.actionsWorkflowPermissions, current.actionsWorkflowPermissions)) {
    problems.push(
      `actions workflow permissions: ${JSON.stringify(current.actionsWorkflowPermissions)} → ${JSON.stringify(baseline.actionsWorkflowPermissions)}`,
    );
  }
  if (
    current.pagesHttpsEnforced !== null &&
    current.pagesHttpsEnforced !== baseline.pagesHttpsEnforced
  ) {
    problems.push(
      `pages https_enforced: ${current.pagesHttpsEnforced} → ${baseline.pagesHttpsEnforced}`,
    );
  }
  if (current.ruleset === null) {
    problems.push(`ruleset "${baseline.ruleset.name}": missing`);
  } else {
    const { rules, ...rest } = baseline.ruleset;
    if (!matches(rest, current.ruleset)) {
      problems.push(
        `ruleset "${baseline.ruleset.name}": enforcement, conditions or bypass actors differ`,
      );
    }
    for (const rule of rules) {
      const actual = current.ruleset.rules?.find(
        (/** @type {{ type: string }} */ r) => r.type === rule.type,
      );
      if (!actual) {
        problems.push(`ruleset rule ${rule.type}: missing`);
      } else if (!matches(rule, actual)) {
        problems.push(
          `ruleset rule ${rule.type}: ${JSON.stringify(actual.parameters)} → ${JSON.stringify(rule.parameters)}`,
        );
      }
    }
    for (const actual of current.ruleset.rules ?? []) {
      if (!rules.some((/** @type {{ type: string }} */ r) => r.type === actual.type)) {
        problems.push(`ruleset rule ${actual.type}: not in baseline (will be removed)`);
      }
    }
  }
  return problems;
}

/**
 * Calls the GitHub REST API: `(args, body?) => parsed JSON | null`; throws on HTTP errors.
 * @typedef {(args: string[], body?: unknown) => any} GitHubApi
 */

/** @type {GitHubApi} */
function gh(args, body) {
  const output = execFileSync(
    'gh',
    ['api', ...args, ...(body === undefined ? [] : ['--input', '-'])],
    {
      encoding: 'utf8',
      input: body === undefined ? undefined : JSON.stringify(body),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  return output.trim() === '' ? null : JSON.parse(output);
}

/**
 * True when the endpoint answers 2xx (used for the "enabled = 204" endpoints).
 * @param {GitHubApi} api
 * @param {string} endpoint
 */
function succeeds(api, endpoint) {
  try {
    api([endpoint]);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {GitHubApi} api
 * @param {string} endpoint
 * @returns {any}
 */
function getOrNull(api, endpoint) {
  try {
    return api([endpoint]);
  } catch {
    return null;
  }
}

/**
 * @param {string} repo owner/name
 * @param {string} rulesetName
 * @param {GitHubApi} [api]
 * @returns {CurrentSettings}
 */
export function readCurrent(repo, rulesetName, api = gh) {
  const summary = api([`repos/${repo}/rulesets`]).find(
    (/** @type {{ name: string }} */ r) => r.name === rulesetName,
  );
  const pages = getOrNull(api, `repos/${repo}/pages`);
  return {
    repository: api([`repos/${repo}`]),
    vulnerabilityAlerts: succeeds(api, `repos/${repo}/vulnerability-alerts`),
    automatedSecurityFixes:
      getOrNull(api, `repos/${repo}/automated-security-fixes`)?.enabled === true,
    privateVulnerabilityReporting:
      getOrNull(api, `repos/${repo}/private-vulnerability-reporting`)?.enabled === true,
    codeScanningDefaultSetup: getOrNull(api, `repos/${repo}/code-scanning/default-setup`),
    actionsWorkflowPermissions: api([`repos/${repo}/actions/permissions/workflow`]),
    pagesHttpsEnforced: pages ? pages.https_enforced : null,
    ruleset: summary ? api([`repos/${repo}/rulesets/${summary.id}`]) : null,
  };
}

/**
 * @param {string} repo
 * @param {any} baseline
 * @param {CurrentSettings} current
 * @param {GitHubApi} [api]
 */
export function apply(repo, baseline, current, api = gh) {
  const security = Object.fromEntries(
    Object.entries(baseline.securityAndAnalysis).map(([key, status]) => [key, { status }]),
  );
  const toggle = (/** @type {boolean} */ on) => (on ? 'PUT' : 'DELETE');
  api(['-X', 'PATCH', `repos/${repo}`], {
    ...baseline.repository,
    security_and_analysis: security,
  });
  api(['-X', toggle(baseline.vulnerabilityAlerts), `repos/${repo}/vulnerability-alerts`]);
  api(['-X', toggle(baseline.automatedSecurityFixes), `repos/${repo}/automated-security-fixes`]);
  api([
    '-X',
    toggle(baseline.privateVulnerabilityReporting),
    `repos/${repo}/private-vulnerability-reporting`,
  ]);
  api(
    ['-X', 'PATCH', `repos/${repo}/code-scanning/default-setup`],
    baseline.codeScanningDefaultSetup,
  );
  api(
    ['-X', 'PUT', `repos/${repo}/actions/permissions/workflow`],
    baseline.actionsWorkflowPermissions,
  );
  if (current.pagesHttpsEnforced !== null) {
    api(['-X', 'PUT', `repos/${repo}/pages`], { https_enforced: baseline.pagesHttpsEnforced });
  }
  if (current.ruleset) {
    api(['-X', 'PUT', `repos/${repo}/rulesets/${current.ruleset.id}`], baseline.ruleset);
  } else {
    api(['-X', 'POST', `repos/${repo}/rulesets`], baseline.ruleset);
  }
}

const USAGE = 'Usage: repo-settings.mjs check|apply <owner/repo> [--required-check <context>]';
const SETTLE_ATTEMPTS = 10;
const SETTLE_DELAY_MS = 3000;

/** Synchronous sleep for the settle loop (this script is synchronous throughout). */
function sleep(/** @type {number} */ ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)), 0, 0, ms);
}

/**
 * @param {string[]} argv
 * @param {GitHubApi} [api]
 * @param {{ attempts?: number, delayMs?: number }} [settle] re-read policy after apply;
 *   code-scanning default setup is applied asynchronously by GitHub
 * @returns {{ code: number, output: string[] }}
 */
export function run(argv, api = gh, settle = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { 'required-check': { type: 'string', default: DEFAULT_REQUIRED_CHECK } },
    });
  } catch (error) {
    return { code: EXIT_USAGE, output: [/** @type {Error} */ (error).message, USAGE] };
  }
  const { positionals, values } = parsed;
  const [command, repo] = positionals;
  if (!['check', 'apply'].includes(command ?? '') || !repo?.includes('/')) {
    return { code: EXIT_USAGE, output: [USAGE] };
  }
  const baseline = loadBaseline(values['required-check']);
  const current = readCurrent(repo, baseline.ruleset.name, api);
  const problems = diffSettings(current, baseline);
  if (problems.length === 0) {
    return { code: 0, output: [`${repo}: matches the baseline.`] };
  }
  const output = [`${repo}:`, ...problems.map((p) => `  ${p}`)];
  if (command !== 'apply') {
    return { code: 1, output };
  }
  apply(repo, baseline, current, api);
  const attempts = settle.attempts ?? SETTLE_ATTEMPTS;
  let remaining = diffSettings(readCurrent(repo, baseline.ruleset.name, api), baseline);
  for (let attempt = 1; attempt < attempts && remaining.length > 0; attempt += 1) {
    sleep(settle.delayMs ?? SETTLE_DELAY_MS);
    remaining = diffSettings(readCurrent(repo, baseline.ruleset.name, api), baseline);
  }
  if (remaining.length === 0) {
    return { code: 0, output: [...output, 'Applied.'] };
  }
  return { code: 1, output: [...output, 'Still different:', ...remaining.map((p) => `  ${p}`)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , ...args] = process.argv;
  const { code, output } = run(args);
  console.log(output.join('\n'));
  process.exitCode = code;
}
