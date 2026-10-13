/** Every rule the tables decide; tests about decisions ignore rules that are on only because they are new. */
import angularTemplateRules from '../src/eslint/rules/angular-template.mjs';
import angularRules from '../src/eslint/rules/angular.mjs';
import importRules from '../src/eslint/rules/imports.mjs';
import javascriptRules from '../src/eslint/rules/javascript.mjs';
import typescriptRules from '../src/eslint/rules/typescript.mjs';
import vitestRules from '../src/eslint/rules/vitest.mjs';

export const TABLED_RULES = new Set(
  [
    javascriptRules,
    typescriptRules,
    importRules,
    angularRules,
    angularTemplateRules,
    vitestRules,
  ].flatMap((table) => Object.keys(table)),
);
