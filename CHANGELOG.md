# Changelog

Releases after 2.0.0 are described in
[GitHub Releases](https://github.com/devenvy/code-guidelines-ecma/releases).

## [2.0.0](https://github.com/devenvy/code-guidelines-ecma/compare/v1.0.0...v2.0.0) (2026-10-12)


### ⚠ BREAKING CHANGES

* TypeScript projects must install typescript-eslint, and projects using vitest: true must install @vitest/eslint-plugin. pnpm projects must decide unrs-resolver in pnpm-workspace.yaml allowBuilds (code-guidelines sync adds it), or check fails. The layer functions typescript() and vitest() are now async.

### Features

* install only what each project type uses ([#1](https://github.com/devenvy/code-guidelines-ecma/issues/1)) ([6707ede](https://github.com/devenvy/code-guidelines-ecma/commit/6707ede3d4b0ab1fc76c76289a907e45d44cb081))
