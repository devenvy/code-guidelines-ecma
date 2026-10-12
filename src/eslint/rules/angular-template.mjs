/*
 * @angular-eslint/template rules. Every plugin rule is listed; effective configuration.
 */
export default /** @type {import('eslint').Linter.RulesRecord} */ ({
  '@angular-eslint/template/alt-text': 'error',
  '@angular-eslint/template/attributes-order': 'error',
  '@angular-eslint/template/banana-in-box': 'error',
  '@angular-eslint/template/button-has-type': 'error',
  '@angular-eslint/template/click-events-have-key-events': 'error',
  '@angular-eslint/template/conditional-complexity': 'error',
  // conditional-complexity covers template logic; this counts every @for/@if
  '@angular-eslint/template/cyclomatic-complexity': 'off',
  '@angular-eslint/template/elements-content': 'error',
  '@angular-eslint/template/eqeqeq': 'error',
  // apps are not localized; a localized repo enables it in its own config
  '@angular-eslint/template/i18n': 'off',
  '@angular-eslint/template/interactive-supports-focus': 'error',
  // controlComponents comes from createConfig({ angular: { controlComponents } })
  '@angular-eslint/template/label-has-associated-control': 'error',
  '@angular-eslint/template/mouse-events-have-key-events': 'error',
  '@angular-eslint/template/no-any': 'error',
  '@angular-eslint/template/no-autofocus': 'error',
  // signals are read by calling them
  '@angular-eslint/template/no-call-expression': 'off',
  '@angular-eslint/template/no-distracting-elements': 'error',
  '@angular-eslint/template/no-duplicate-attributes': [
    'error',
    { allowStylePrecedenceDuplicates: true },
  ],
  '@angular-eslint/template/no-empty-control-flow': 'error',
  // static style="..." is banned; dynamic [style.x] bindings are how Angular sizes/positions things
  '@angular-eslint/template/no-inline-styles': ['error', { allowBindToStyle: true }],
  '@angular-eslint/template/no-outerhtml': 'error',
  '@angular-eslint/template/no-interpolation-in-attributes': 'error',
  '@angular-eslint/template/no-negated-async': 'error',
  // matches @typescript-eslint/no-non-null-assertion (off)
  '@angular-eslint/template/no-non-null-assertion': 'off',
  '@angular-eslint/template/no-positive-tabindex': 'error',
  '@angular-eslint/template/prefer-control-flow': 'error',
  // NgOptimizedImage does not support data/blob URLs and is awkward in libraries
  '@angular-eslint/template/prefer-ngsrc': 'off',
  '@angular-eslint/template/prefer-self-closing-tags': 'error',
  '@angular-eslint/template/role-has-required-aria': 'error',
  '@angular-eslint/template/table-scope': 'error',
  '@angular-eslint/template/use-track-by-function': 'error',
  '@angular-eslint/template/valid-aria': 'error',
  '@angular-eslint/template/no-nested-tags': ['error'],
  '@angular-eslint/template/prefer-at-empty': ['error'],
  '@angular-eslint/template/prefer-at-else': 'error',
  '@angular-eslint/template/prefer-built-in-pipes': 'error',
  '@angular-eslint/template/prefer-class-binding': 'error',
  '@angular-eslint/template/prefer-contextual-for-variables': ['error'],
  '@angular-eslint/template/prefer-static-string-properties': ['error'],
  // matches core prefer-template
  '@angular-eslint/template/prefer-template-literal': 'error',
  '@angular-eslint/template/require-switch-default': 'error',
  '@angular-eslint/template/prefer-style-binding': 'error',
});
