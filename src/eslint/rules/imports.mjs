/*
 * eslint-plugin-import-x rules. Every non-deprecated plugin rule is listed; effective configuration.
 *
 * Resolution-based rules are off except no-cycle: TypeScript already reports unresolved modules
 * and missing named exports. The imports layer configures the TypeScript resolver for no-cycle.
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  // -- ordering and layout --
  // groups and internal patterns are set by the imports layer
  'import-x/order': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
  // export placement is not enforced: exports-last, group-exports
  'import-x/exports-last': 'off',
  'import-x/group-exports': 'off',

  // -- correctness that needs no resolver --
  'import-x/no-self-import': 'error',
  'import-x/no-mutable-exports': 'error',
  'import-x/no-absolute-path': 'error',
  'import-x/no-empty-named-blocks': 'error',
  'import-x/no-useless-path-segments': 'error',
  'import-x/no-webpack-loader-syntax': 'error',
  'import-x/no-amd': 'error',
  'import-x/no-import-module-exports': 'error',
  'import-x/no-named-default': 'error',

  // -- resolution-based: covered by TypeScript or knip, except no-cycle --
  'import-x/no-unresolved': 'off',
  'import-x/named': 'off',
  'import-x/default': 'off',
  'import-x/namespace': 'off',
  'import-x/export': 'off',
  'import-x/no-named-as-default': 'off',
  'import-x/no-named-as-default-member': 'off',
  'import-x/no-deprecated': 'off', // @typescript-eslint/no-deprecated covers this with type info
  // circular imports cause undefined-at-runtime bugs; resolved with the TypeScript resolver
  'import-x/no-cycle': ['error', { ignoreExternal: true }],
  // knip reports unused files and exports across the whole project
  'import-x/no-unused-modules': 'off',
  // knip reports unlisted and unused dependencies
  'import-x/no-extraneous-dependencies': 'off',
  // only arises in monorepos; enable there
  'import-x/no-relative-packages': 'off',
  'import-x/no-restricted-paths': 'off', // project-specific; configure per repo
  'import-x/no-internal-modules': 'off', // project-specific
  'import-x/extensions': 'off', // module resolution mode decides this; TS reports wrong specifiers

  // -- style preferences we do not enforce --
  'import-x/consistent-type-specifier-style': 'off', // @typescript-eslint/consistent-type-imports owns this
  'import-x/no-namespace': 'off',
  'import-x/no-anonymous-default-export': 'off',
  'import-x/no-rename-default': 'off',
  'import-x/prefer-default-export': 'off',
  'import-x/prefer-namespace-import': 'off',
  'import-x/no-default-export': 'off',
  'import-x/no-named-export': 'off',
  'import-x/no-relative-parent-imports': 'off',
  'import-x/max-dependencies': 'off',
  'import-x/no-unassigned-import': 'off', // side-effect imports (polyfills, styles) are legitimate
  'import-x/dynamic-import-chunkname': 'off', // webpack-specific
  // module type comes from package.json type and file extensions
  'import-x/unambiguous': 'off',

  // -- environment-specific --
  'import-x/no-commonjs': 'off', // CJS config files are legitimate
  'import-x/no-dynamic-require': 'error',
  // Node built-ins are expected in Node projects; browser builds fail without polyfills anyway
  'import-x/no-nodejs-modules': 'off',
});
