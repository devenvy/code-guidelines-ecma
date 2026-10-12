import { ROOT_CONFIG_FILES, TS_FILES } from '../files.mjs';
import { importPeer } from '../peer.mjs';
import { typescriptRelaxations } from '../rules/test-relaxations.mjs';
import typescriptRules from '../rules/typescript.mjs';

const MISSING_TYPESCRIPT_ESLINT =
  'createConfig: TypeScript linting (the default) requires "typescript-eslint". Install it: npm i -D typescript typescript-eslint. For a plain JavaScript project, pass typescript: false.';

/**
 * typescript-eslint with type information via the project service.
 * @param {import('../options.mjs').NormalizedOptions} options
 * @param {{ importModule?: import('../peer.mjs').ImportModule }} [deps] test seam for dynamic import
 * @returns {Promise<import('eslint').Linter.Config[]>}
 */
export async function typescript(options, deps = {}) {
  if (!options.typescript) {
    return [];
  }
  const tseslint = await importPeer(
    'typescript-eslint',
    MISSING_TYPESCRIPT_ESLINT,
    deps.importModule,
  );
  const disableTypeChecked = /** @type {import('eslint').Linter.Config} */ (
    tseslint.configs.disableTypeChecked
  );
  return [
    {
      name: 'devenvy/typescript/rules',
      files: TS_FILES,
      plugins: { '@typescript-eslint': tseslint.plugin },
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { projectService: true, tsconfigRootDir: options.rootDir },
      },
      rules: typescriptRules,
    },
    {
      // root tool configs and declared untyped files need not belong to a tsconfig
      ...disableTypeChecked,
      name: 'devenvy/typescript/untyped-files',
      files: [...ROOT_CONFIG_FILES, ...options.untypedFiles],
    },
    {
      name: 'devenvy/typescript/config-files',
      files: ROOT_CONFIG_FILES,
      rules: typescriptRelaxations,
    },
  ];
}
