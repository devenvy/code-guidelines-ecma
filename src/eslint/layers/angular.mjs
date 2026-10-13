import { HTML_FILES, INDEX_HTML_FILES, TS_FILES } from '../files.mjs';
import { importPeer } from '../peer.mjs';
import angularTemplateRules from '../rules/angular-template.mjs';
import angularRules from '../rules/angular.mjs';
import { installedPluginRules } from '../rules/installed.mjs';

const MISSING_ANGULAR_ESLINT =
  'createConfig: angular: {...} requires "angular-eslint". Install it: npm i -D angular-eslint';

/**
 * angular-eslint for TypeScript and templates (inline and external). No filename-suffix globs:
 * Angular 20+ files are suffixless.
 * @param {import('../options.mjs').NormalizedOptions} options
 * @param {{ importModule?: import('../peer.mjs').ImportModule }} [deps] test seam for dynamic import
 * @returns {Promise<import('eslint').Linter.Config[]>}
 */
export async function angular(options, deps = {}) {
  if (!options.angular) {
    return [];
  }
  const ng = await importPeer('angular-eslint', MISSING_ANGULAR_ESLINT, deps.importModule);
  const { prefix, controlComponents } = options.angular;
  return [
    {
      name: 'devenvy/angular/typescript',
      files: TS_FILES,
      plugins: { '@angular-eslint': ng.tsPlugin },
      processor: ng.processInlineTemplates,
      rules: {
        ...installedPluginRules(angularRules, ng.tsPlugin.rules, '@angular-eslint/'),
        '@angular-eslint/component-selector': [
          'error',
          { type: 'element', prefix, style: 'kebab-case' },
        ],
        '@angular-eslint/directive-selector': [
          'error',
          { type: 'attribute', prefix, style: 'camelCase' },
        ],
      },
    },
    {
      name: 'devenvy/angular/templates',
      files: HTML_FILES,
      ignores: INDEX_HTML_FILES,
      plugins: { '@angular-eslint/template': ng.templatePlugin },
      languageOptions: { parser: ng.templateParser },
      rules: {
        ...installedPluginRules(
          angularTemplateRules,
          ng.templatePlugin.rules,
          '@angular-eslint/template/',
        ),
        '@angular-eslint/template/label-has-associated-control': ['error', { controlComponents }],
      },
    },
  ];
}
