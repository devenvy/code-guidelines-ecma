import path from 'node:path';

import { parse } from 'yaml';

import { readText } from '../lib/text.mjs';

const CI_FILE = '.github/workflows/ci.yml';

/**
 * ci.yml jobs every repo has. `result` is the single required status check and must need every
 * other job except `dependabot-auto-merge` (which runs only on Dependabot PRs).
 */
const CI_JOBS = [
  'pr-title',
  'lint',
  'test',
  'build',
  'audit',
  'dependency-review',
  'dependabot-auto-merge',
  'result',
];
const NOT_GATED = new Set(['result', 'dependabot-auto-merge']);

/** Files that must exist, with an action one of their steps must use (`null`: existence only). */
const REQUIRED_FILES = /** @type {const} */ ([
  ['.github/workflows/release.yml', 'googleapis/release-please-action'],
  ['.github/workflows/scorecard.yml', 'ossf/scorecard-action'],
  ['.github/dependabot.yml', null],
  ['release-please-config.json', null],
  ['.release-please-manifest.json', null],
]);

/**
 * @typedef {{ file: string, message: string }} Problem
 * @typedef {{ run?: unknown, uses?: unknown }} Step
 * @typedef {{ if?: unknown, needs?: unknown, steps?: unknown }} Job
 * @typedef {{ on?: unknown, jobs?: unknown }} Workflow
 */

/**
 * Scripts that CI runs, so package.json must define them.
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]}
 */
export function ciScripts(choices) {
  return [...lintScripts(choices), ...(choices.vitest ? ['test:ci'] : [])];
}

/**
 * Scripts the lint job runs (plain JavaScript projects have no typecheck).
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]}
 */
function lintScripts(choices) {
  return [
    'guidelines:check',
    'lint',
    'format:check',
    ...(choices.typescript ? ['typecheck'] : []),
    'knip',
  ];
}

/**
 * Checks the DevEnvy CI and release convention (see the README's "CI and releases").
 * @param {string} dir
 * @param {import('../managed.mjs').Choices} choices
 * @returns {Problem[]}
 */
export function checkWorkflows(dir, choices) {
  /** @type {Problem[]} */
  const problems = [];
  const ci = readYaml(dir, CI_FILE, problems);
  if (ci) {
    problems.push(...checkCi(ci, choices).map((message) => ({ file: CI_FILE, message })));
  }
  for (const [file, action] of REQUIRED_FILES) {
    if (file.endsWith('.yml')) {
      const doc = readYaml(dir, file, problems);
      if (doc && action && !allSteps(doc).some((step) => usesAction(step, action))) {
        problems.push({ file, message: `no step uses ${action}` });
      }
    } else if (!readText(path.join(dir, file)).exists) {
      problems.push({ file, message: 'missing' });
    }
  }
  return problems;
}

/**
 * @param {Workflow} ci
 * @param {import('../managed.mjs').Choices} choices
 * @returns {string[]}
 */
function checkCi(ci, choices) {
  /** @type {string[]} */
  const messages = [];
  // `yaml` parses the bare key `on` as the string "on" (YAML 1.2), not a boolean.
  const { pull_request: rawPullRequest } = asRecord(ci.on) ?? {};
  const pullRequest = asRecord(rawPullRequest);
  const { types } = pullRequest ?? {};
  if (!pullRequest) {
    messages.push('must run on pull_request');
  } else if (!Array.isArray(types) || !types.includes('edited')) {
    messages.push('pull_request types must include "edited" so a fixed PR title is checked again');
  }

  const jobs = asRecord(ci.jobs) ?? {};
  for (const name of CI_JOBS.filter((job) => !(job in jobs))) {
    messages.push(`missing job "${name}"`);
  }

  const { result: rawResult, lint, test, 'dependency-review': review } = jobs;
  const result = /** @type {Job | null} */ (asRecord(rawResult));
  if (result) {
    if (typeof result.if !== 'string' || !result.if.includes('always()')) {
      messages.push('job "result" must run with if: always()');
    }
    const needs = new Set(toStrings(result.needs));
    const ungated = Object.keys(jobs).filter((job) => !NOT_GATED.has(job) && !needs.has(job));
    if (ungated.length > 0) {
      messages.push(`job "result" must need every job; missing: ${ungated.join(', ')}`);
    }
  }

  /** @type {[string, unknown, string[]][]} */
  const expectations = [
    ['lint', lint, lintScripts(choices)],
    ['test', test, choices.vitest ? ['test:ci'] : []],
  ];
  for (const [name, job, scripts] of expectations) {
    const steps = jobSteps(job);
    for (const script of scripts.filter((s) => !steps.some((step) => runsScript(step, s)))) {
      messages.push(`job "${name}" must run the "${script}" script`);
    }
  }
  const lintSteps = jobSteps(lint);
  for (const tool of ['actionlint', 'zizmor']) {
    if (lint && !lintSteps.some((step) => mentions(step, tool))) {
      messages.push(`job "lint" must run ${tool}`);
    }
  }
  if (
    review &&
    !jobSteps(review).some((step) => usesAction(step, 'actions/dependency-review-action'))
  ) {
    messages.push('job "dependency-review" must use actions/dependency-review-action');
  }
  return messages;
}

/**
 * @param {string} dir
 * @param {string} file
 * @param {Problem[]} problems receives "missing" and parse errors
 * @returns {Record<string, unknown> | null}
 */
function readYaml(dir, file, problems) {
  const { exists, text } = readText(path.join(dir, file));
  if (!exists) {
    problems.push({ file, message: 'missing' });
    return null;
  }
  try {
    return asRecord(parse(text)) ?? {};
  } catch (error) {
    problems.push({ file, message: `invalid YAML: ${/** @type {Error} */ (error).message}` });
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStrings(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item) => typeof item === 'string');
}

/**
 * @param {unknown} job
 * @returns {Step[]}
 */
function jobSteps(job) {
  const steps = /** @type {Job | null} */ (asRecord(job))?.steps;
  return Array.isArray(steps) ? steps.map((step) => asRecord(step) ?? {}) : [];
}

/**
 * @param {Workflow} doc
 * @returns {Step[]}
 */
function allSteps(doc) {
  return Object.values(asRecord(doc.jobs) ?? {}).flatMap((job) => jobSteps(job));
}

/**
 * @param {Step} step
 * @param {string} action owner/repo
 */
function usesAction(step, action) {
  return typeof step.uses === 'string' && step.uses.startsWith(`${action}@`);
}

/**
 * @param {Step} step
 * @param {string} script
 */
function runsScript(step, script) {
  const escaped = script.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return (
    typeof step.run === 'string' &&
    new RegExp(String.raw`\b(pnpm|npm|yarn|bun)( run)? ${escaped}(\s|$)`, 'm').test(step.run)
  );
}

/**
 * @param {Step} step
 * @param {string} tool
 */
function mentions(step, tool) {
  return [step.uses, step.run].some((value) => typeof value === 'string' && value.includes(tool));
}
