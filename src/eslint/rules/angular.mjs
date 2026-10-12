/*
 * @angular-eslint rules for TypeScript. Every plugin rule is listed; effective configuration.
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  // prefix comes from createConfig({ angular: { prefix } }); the angular layer sets the options
  '@angular-eslint/directive-selector': 'error',
  '@angular-eslint/component-selector': 'error',
  // Angular 20+ style guide drops type suffixes from class names
  '@angular-eslint/component-class-suffix': 'off',
  '@angular-eslint/component-max-inline-declarations': ['error', { template: 50 }],
  '@angular-eslint/computed-must-return': ['error'],
  // styleUrl / styles as a single string (Angular 17+), not arrays
  '@angular-eslint/consistent-component-styles': 'error',
  '@angular-eslint/contextual-decorator': ['error'],
  '@angular-eslint/contextual-lifecycle': ['error'],
  '@angular-eslint/directive-class-suffix': 'off',
  '@angular-eslint/no-async-lifecycle-method': ['error'],
  '@angular-eslint/no-attribute-decorator': ['error'],
  '@angular-eslint/no-duplicates-in-metadata-arrays': ['error'],
  '@angular-eslint/no-empty-lifecycle-method': ['error'],
  '@angular-eslint/no-forward-ref': ['error'],
  '@angular-eslint/no-implicit-take-until-destroyed': 'error',
  '@angular-eslint/no-input-prefix': ['error'],
  '@angular-eslint/no-input-rename': ['error'],
  '@angular-eslint/no-inputs-metadata-property': ['error'],
  '@angular-eslint/no-lifecycle-call': ['error'],
  '@angular-eslint/no-output-native': ['error'],
  '@angular-eslint/no-output-on-prefix': ['error'],
  '@angular-eslint/no-output-rename': ['error'],
  '@angular-eslint/no-outputs-metadata-property': ['error'],
  // impure pipes run every change detection; disable inline with a reason when one is needed
  '@angular-eslint/no-pipe-impure': 'error',
  '@angular-eslint/no-queries-metadata-property': ['error'],
  '@angular-eslint/pipe-prefix': ['error'],
  '@angular-eslint/prefer-host-metadata-property': ['error'],
  '@angular-eslint/prefer-on-push-component-change-detection': ['error'],
  '@angular-eslint/prefer-output-readonly': ['error'],
  '@angular-eslint/prefer-signal-model': ['error'],
  '@angular-eslint/prefer-standalone': ['error'],
  '@angular-eslint/relative-url-prefix': ['error'],
  '@angular-eslint/require-localize-metadata': ['error'],
  '@angular-eslint/runtime-localize': ['error'],
  '@angular-eslint/sort-lifecycle-methods': ['error'],
  '@angular-eslint/use-component-selector': ['error'],
  '@angular-eslint/use-component-view-encapsulation': ['error'],
  // component-scoped services are provided through `providers` and have no providedIn
  '@angular-eslint/use-injectable-provided-in': 'off',
  '@angular-eslint/use-lifecycle-interface': ['error'],
  '@angular-eslint/use-pipe-transform-interface': ['error'],
  '@angular-eslint/no-developer-preview': ['error'],
  // experimental APIs are adopted deliberately (e.g. Signal Forms); developer preview is banned
  '@angular-eslint/no-experimental': 'off',
  '@angular-eslint/no-uncalled-signals': ['error'],
  // @Injectable stays the documented default across Angular versions in use
  '@angular-eslint/prefer-service-decorator': 'off',
  '@angular-eslint/prefer-inject': ['error'],
  '@angular-eslint/inject-at-top': ['error'],
  '@angular-eslint/prefer-output-emitter-ref': ['error'],
  '@angular-eslint/prefer-signals': ['error'],
  '@angular-eslint/require-lifecycle-on-prototype': ['error'],
  '@angular-eslint/sort-keys-in-type-decorator': ['error'],
  // previously crashed on Signal Forms destructuring; verified fixed by test/lint.test.mjs
  '@angular-eslint/reactive-context-must-read-signal': 'error',
});
