import { parseArgs } from 'node:util';

import { check } from './commands/check.mjs';
import { CliError } from './commands/choices.mjs';
import { init } from './commands/init.mjs';
import { sync } from './commands/sync.mjs';

/** Exit code for invalid usage (unknown command or option). */
const EXIT_USAGE = 2;

const USAGE = `Usage: code-guidelines <command> [options]

Commands:
  init    Set up ESLint, Prettier, tsconfig, editor and git config
          --env node|browser   globals for source files (--angular implies browser)
          --angular --prefix <p>
          --vitest
          --no-typescript      plain JavaScript project
          --force              replace conflicting existing config
  check   Verify the project still matches the baseline (exit 1 on drift)
  sync    Rewrite managed content from the installed version
          --dry-run            show changes without writing`;

/**
 * @param {string[]} argv
 * @param {string} cwd
 * @returns {Promise<{ code: number, output: string[] }>}
 */
export async function run(argv, cwd) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        env: { type: 'string' },
        angular: { type: 'boolean' },
        prefix: { type: 'string' },
        vitest: { type: 'boolean' },
        'no-typescript': { type: 'boolean' },
        force: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return {
      code: EXIT_USAGE,
      output: [`code-guidelines: ${/** @type {Error} */ (error).message}`, '', USAGE],
    };
  }
  const { positionals, values } = parsed;
  const [command] = positionals;
  try {
    switch (command) {
      case 'init': {
        const result = await init(cwd, {
          env: /** @type {'browser' | 'node' | undefined} */ (values.env),
          angular: values.angular,
          prefix: values.prefix,
          vitest: values.vitest,
          typescript: !values['no-typescript'],
          force: values.force,
        });
        return { code: result.ok ? 0 : 1, output: result.output };
      }
      case 'check': {
        const result = check(cwd);
        return { code: result.ok ? 0 : 1, output: result.output };
      }
      case 'sync':
        return { code: 0, output: (await sync(cwd, { dryRun: values['dry-run'] })).output };
      default:
        return { code: values.help ? 0 : EXIT_USAGE, output: [USAGE] };
    }
  } catch (error) {
    if (error instanceof CliError) {
      return { code: 1, output: [`code-guidelines: ${error.message}`] };
    }
    throw error;
  }
}
