import base from './index.mjs';

/**
 * Prettier only infers the Angular parser for `*.component.html`; suffixless templates
 * (Angular 20+ style) need the override.
 * @type {import('prettier').Config}
 */
const config = {
  ...base,
  overrides: [{ files: '*.html', options: { parser: 'angular' } }],
};

export default config;
