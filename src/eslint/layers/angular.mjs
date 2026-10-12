import { HTML_FILES, INDEX_HTML_FILES, TS_FILES } from '../files.mjs';
import angularTemplateRules from '../rules/angular-template.mjs';
import angularRules from '../rules/angular.mjs';

const MISSING_ANGULAR_ESLINT =
  'createConfig: angular: {...} requires "angular-eslint". Install it: npm i -D angular-eslint';

/**
 * @param {(specifier: string) => Promise<any>} importModule
 * @returns {Promise<any>}
 */
async function importAngularEslint(importModule) {
  try {
    return (await importModule('angular-eslint')).default;
  } catch (error) {
    const { code, message } = /** @type {NodeJS.ErrnoException} */ (error);
    // only when angular-eslint itself is missing, not one of its own dependencies
    if (code === 'ERR_MODULE_NOT_FOUND' && /'angular-eslint'/.test(message)) {
      throw new Error(MISSING_ANGULAR_ESLINT, { cause: error });
    }
    throw error;
  }
}

/**
 * angular-eslint for TypeScript and templates (inline and external). No filename-suffix globs:
 * Angular 20+ files are suffixless.
 * @param {import('../options.mjs').NormalizedOptions} options
 * @param {{ importModule?: (specifier: string) => Promise<any> }} [deps] test seam for dynamic import
 * @returns {Promise<import('eslint').Linter.Config[]>}
 */
export async function angular(options, deps = {}) {
  if (!options.angular) {
    return [];
  }
  const ng = await importAngularEslint(deps.importModule ?? ((specifier) => import(specifier)));
  const { prefix, controlComponents } = options.angular;
  return [
    {
      name: 'devenvy/angular/typescript',
      files: TS_FILES,
      plugins: { '@angular-eslint': ng.tsPlugin },
      processor: ng.processInlineTemplates,
      rules: {
        ...angularRules,
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
        ...angularTemplateRules,
        '@angular-eslint/template/label-has-associated-control': ['error', { controlComponents }],
      },
    },
  ];
}
