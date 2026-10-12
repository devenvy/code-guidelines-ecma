import path from 'node:path';

import { CliError } from '../lib/errors.mjs';
import { parseJsonc } from '../lib/json.mjs';
import { readText } from '../lib/text.mjs';

export { CliError };

/**
 * Reads the choices `init` recorded in package.json.
 * @param {string} dir
 * @returns {import('../managed.mjs').Choices}
 */
export function readChoices(dir) {
  const pkg = readText(path.join(dir, 'package.json'));
  if (!pkg.exists) {
    throw new CliError('No package.json found. Run code-guidelines in a package root.');
  }
  const recorded = parseJsonc(pkg.text, 'package.json').codeGuidelines;
  if (!recorded || typeof recorded !== 'object') {
    throw new CliError('package.json has no "codeGuidelines" entry. Run: code-guidelines init');
  }
  return {
    env: recorded.env === 'node' ? 'node' : 'browser',
    typescript: recorded.typescript !== false,
    angular: recorded.angular === true,
    vitest: recorded.vitest === true,
    workflows: recorded.workflows !== false,
  };
}
