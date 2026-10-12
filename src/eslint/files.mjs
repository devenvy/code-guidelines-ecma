export const JS_FILES = ['**/*.{js,mjs,cjs}'];
export const TS_FILES = ['**/*.{ts,mts,cts}'];
export const HTML_FILES = ['**/*.html'];
/** Host pages (index.html, index.prod.html) are plain HTML, not Angular templates. */
export const INDEX_HTML_FILES = ['**/index.html', '**/index.*.html'];
/** Tool configuration files at the repo root (vitest.config.ts, prettier.config.mjs, ...). */
export const ROOT_CONFIG_FILES = ['*.config.{js,mjs,cjs,ts,mts,cts}'];
export const DEFAULT_TEST_FILES = ['**/*.{spec,test}.{ts,mts,cts,js,mjs,cjs}'];
export const DEFAULT_IGNORES = [
  '**/dist/**',
  '**/coverage/**',
  '**/.angular/**',
  '**/out-tsc/**',
  '**/node_modules/**',
  '**/*.min.js',
];
