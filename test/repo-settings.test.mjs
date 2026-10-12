import { describe, expect, it } from 'vitest';

import {
  apply,
  diffSettings,
  loadBaseline,
  matches,
  readCurrent,
  run,
} from '../scripts/repo-settings/repo-settings.mjs';

const baseline = loadBaseline('result');

/** Current settings that satisfy the baseline exactly. */
function compliant() {
  return {
    repository: {
      ...baseline.repository,
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    },
    vulnerabilityAlerts: true,
    automatedSecurityFixes: true,
    privateVulnerabilityReporting: true,
    codeScanningDefaultSetup: {
      state: 'configured',
      query_suite: 'extended',
      languages: ['actions'],
    },
    actionsWorkflowPermissions: {
      default_workflow_permissions: 'read',
      can_approve_pull_request_reviews: false,
    },
    pagesHttpsEnforced: true,
    ruleset: structuredClone(baseline.ruleset),
  };
}

describe('repo settings', () => {
  it('substitutes the required check', () => {
    const checks = baseline.ruleset.rules.find((r) => r.type === 'required_status_checks');
    // pinned to the GitHub Actions app so no other integration can satisfy the check
    expect(checks.parameters.required_status_checks).toEqual([
      { context: 'result', integration_id: 15368 },
    ]);
    expect(JSON.stringify(loadBaseline('ci / result'))).toContain('"context":"ci / result"');
  });

  it('accepts compliant settings, ignoring extra keys', () => {
    expect(diffSettings(compliant(), baseline)).toEqual([]);
  });

  it('reports each kind of drift', () => {
    const current = compliant();
    current.repository.allow_merge_commit = true;
    current.repository.security_and_analysis.secret_scanning.status = 'disabled';
    current.vulnerabilityAlerts = false;
    current.codeScanningDefaultSetup = { state: 'not-configured' };
    current.actionsWorkflowPermissions.default_workflow_permissions = 'write';
    current.pagesHttpsEnforced = false;
    current.ruleset.rules = current.ruleset.rules.filter((r) => r.type !== 'deletion');
    current.ruleset.rules.push({ type: 'update' });
    expect(diffSettings(current, baseline)).toEqual([
      'repository.allow_merge_commit: true → false',
      'security_and_analysis.secret_scanning: disabled → enabled',
      'vulnerabilityAlerts: false → true',
      'code scanning default setup: {"state":"not-configured"} → {"state":"configured","query_suite":"extended"}',
      'actions workflow permissions: {"default_workflow_permissions":"write","can_approve_pull_request_reviews":false} → {"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}',
      'pages https_enforced: false → true',
      'ruleset rule deletion: missing',
      'ruleset rule update: not in baseline (will be removed)',
    ]);
  });

  it('skips pages when Pages is not enabled and reports a missing ruleset', () => {
    const current = { ...compliant(), pagesHttpsEnforced: null, ruleset: null };
    expect(diffSettings(current, baseline)).toEqual(['ruleset "main": missing']);
  });

  it('matches subsets deeply', () => {
    expect(matches({ a: [{ b: 1 }] }, { a: [{ b: 1, c: 2 }], d: 3 })).toBe(true);
    expect(matches({ a: [1, 2] }, { a: [1] })).toBe(false);
  });
});

/**
 * In-memory GitHub API: GETs answer from `routes` (an Error value or missing route means an HTTP
 * failure); writes are recorded and passed to `onWrite`.
 */
function fakeApi(routes, onWrite = () => undefined) {
  const writes = [];
  const api = (args, body) => {
    if (args[0] === '-X') {
      writes.push([args[1], args[2], body]);
      onWrite(args[1], args[2], body);
      return null;
    }
    const value = routes[args[0]];
    if (value === undefined || value instanceof Error) {
      throw value ?? new Error(`404 ${args[0]}`);
    }
    return structuredClone(value);
  };
  return { api, writes };
}

/** Routes for a repo that already matches the baseline. */
function compliantRoutes() {
  const current = compliant();
  return {
    'repos/o/r/rulesets': [{ id: 7, name: 'main' }],
    'repos/o/r/rulesets/7': { ...current.ruleset, id: 7 },
    'repos/o/r': current.repository,
    'repos/o/r/vulnerability-alerts': null,
    'repos/o/r/automated-security-fixes': { enabled: true },
    'repos/o/r/private-vulnerability-reporting': { enabled: true },
    'repos/o/r/code-scanning/default-setup': current.codeScanningDefaultSetup,
    'repos/o/r/actions/permissions/workflow': current.actionsWorkflowPermissions,
    'repos/o/r/pages': { https_enforced: true },
  };
}

const calls = (writes) => writes.map(([method, endpoint]) => `${method} ${endpoint}`);

describe('repo settings against the API', () => {
  it('reads settings, treating failed toggle endpoints as disabled', () => {
    const routes = compliantRoutes();
    routes['repos/o/r/vulnerability-alerts'] = new Error('404');
    delete routes['repos/o/r/pages'];
    const current = readCurrent('o/r', 'main', fakeApi(routes).api);
    expect(current.vulnerabilityAlerts).toBe(false);
    expect(current.automatedSecurityFixes).toBe(true);
    expect(current.pagesHttpsEnforced).toBeNull();
    expect(current.ruleset.id).toBe(7);
  });

  it('reads a missing ruleset as null', () => {
    const routes = { ...compliantRoutes(), 'repos/o/r/rulesets': [] };
    expect(readCurrent('o/r', 'main', fakeApi(routes).api).ruleset).toBeNull();
  });

  it('check passes for a compliant repo and lists differences otherwise', () => {
    expect(run(['check', 'o/r'], fakeApi(compliantRoutes()).api)).toEqual({
      code: 0,
      output: ['o/r: matches the baseline.'],
    });
    const routes = compliantRoutes();
    routes['repos/o/r'] = { ...routes['repos/o/r'], allow_merge_commit: true };
    expect(run(['check', 'o/r'], fakeApi(routes).api)).toEqual({
      code: 1,
      output: ['o/r:', '  repository.allow_merge_commit: true → false'],
    });
  });

  it('apply writes every setting and creates a missing ruleset', () => {
    const routes = { ...compliantRoutes(), 'repos/o/r/rulesets': [] };
    delete routes['repos/o/r/pages'];
    const { api, writes } = fakeApi(routes);
    apply('o/r', baseline, readCurrent('o/r', 'main', api), api);
    expect(calls(writes)).toEqual([
      'PATCH repos/o/r',
      'PUT repos/o/r/vulnerability-alerts',
      'PUT repos/o/r/automated-security-fixes',
      'PUT repos/o/r/private-vulnerability-reporting',
      'PATCH repos/o/r/code-scanning/default-setup',
      'PUT repos/o/r/actions/permissions/workflow',
      'POST repos/o/r/rulesets',
    ]);
    expect(writes[0][2].security_and_analysis.secret_scanning).toEqual({ status: 'enabled' });
  });

  it('apply updates an existing ruleset and pages, then reports success', () => {
    const routes = compliantRoutes();
    routes['repos/o/r'] = { ...routes['repos/o/r'], delete_branch_on_merge: false };
    const { api, writes } = fakeApi(routes, (method, endpoint, body) => {
      if (method === 'PATCH' && endpoint === 'repos/o/r') {
        routes['repos/o/r'] = { ...routes['repos/o/r'], ...body };
      }
    });
    const result = run(['apply', 'o/r'], api);
    expect(calls(writes)).toContain('PUT repos/o/r/rulesets/7');
    expect(calls(writes)).toContain('PUT repos/o/r/pages');
    expect(result.code).toBe(0);
    expect(result.output.at(-1)).toBe('Applied.');
  });

  it('apply reports settings that did not take effect', () => {
    const routes = compliantRoutes();
    routes['repos/o/r'] = { ...routes['repos/o/r'], allow_auto_merge: false };
    const { api, writes } = fakeApi(routes);
    const result = run(['apply', 'o/r'], api, { attempts: 2, delayMs: 0 });
    expect(writes.length).toBeGreaterThan(0);
    expect(result.code).toBe(1);
    expect(result.output.slice(-2)).toEqual([
      'Still different:',
      '  repository.allow_auto_merge: false → true',
    ]);
  });

  it('prints usage for bad arguments and unknown flags', () => {
    expect(run(['frob', 'o/r'], fakeApi({}).api).code).toBe(2);
    expect(run(['check', 'no-slash'], fakeApi({}).api).output[0]).toContain('Usage:');
    expect(run(['check', 'o/r', '--nope'], fakeApi({}).api)).toMatchObject({ code: 2 });
  });

  it('accepts any required check name, including quotes', () => {
    const checks = loadBaseline('say "hi"').ruleset.rules.find(
      (r) => r.type === 'required_status_checks',
    ).parameters.required_status_checks;
    expect(checks).toEqual([{ context: 'say "hi"', integration_id: 15368 }]);
  });
});
