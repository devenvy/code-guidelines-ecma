# @devenvy/code-guidelines

Shared lint, format, TypeScript, editor and git baseline for DevEnvy JavaScript, TypeScript and
Angular repositories. The ECMAScript sibling of
[code-guidelines-dotnet](https://github.com/devenvy/code-guidelines-dotnet).

- **ESLint** — one `createConfig()` call: core, typescript-eslint (type-aware), import ordering,
  angular-eslint (TypeScript + templates) and Vitest, with every rule explicitly decided.
- **Prettier** — formatting for everything; ESLint never fights it.
- **tsconfig bases** — strict compiler settings for Node, browser, Angular and plain JavaScript.
- **CLI** — `init` sets a repo up, `check` fails CI on drift or a weakened config, `sync` updates
  managed files.

## Quick start

```sh
# Plain JavaScript (browser)
pnpm add -D --allow-build '!unrs-resolver' @devenvy/code-guidelines eslint prettier knip
pnpm exec code-guidelines init --env browser --no-typescript

# Node / TypeScript
pnpm add -D --allow-build '!unrs-resolver' @devenvy/code-guidelines eslint prettier knip typescript typescript-eslint @types/node
pnpm exec code-guidelines init --env node

# Angular
pnpm add -D --allow-build '!unrs-resolver' @devenvy/code-guidelines eslint prettier knip typescript typescript-eslint angular-eslint
pnpm exec code-guidelines init --angular --prefix app
```

npm works the same way (`npm i -D …`, `npx code-guidelines …`).

`--allow-build '!unrs-resolver'` records pnpm's decision not to run the install script of
`unrs-resolver` (the import plugin's resolver; its prebuilt binary installs without it). pnpm fails
installs while a build script is undecided, so `init` also sets `allowBuilds: unrs-resolver: false`
in `pnpm-workspace.yaml` (the workspace root's, for a workspace package) unless it is already
`true` or `false`, and `check` requires a decision. A project that uses pnpm's `permissions`
setting decides it there instead, and `init` and `check` leave the file alone.

A project installs only the tools for the features it uses. Everything beyond ESLint, Prettier
and knip is an optional peer that is loaded only when its feature is on:

| Feature               | Install                           |
| --------------------- | --------------------------------- |
| every project         | `eslint`, `prettier`, `knip`      |
| TypeScript (default)  | `typescript`, `typescript-eslint` |
| Angular (`--angular`) | `angular-eslint`                  |
| Vitest (`--vitest`)   | `@vitest/eslint-plugin`           |

`init` prints the install command for any of these that are missing, and turning a feature on
without its package fails with the command to run. A plain JavaScript project never needs
TypeScript, with one exception: `@vitest/eslint-plugin` is built on typescript-eslint's utilities,
so enabling Vitest brings `typescript` in as a dependency of that plugin (nothing to configure).

`init` writes:

| File                                                               | What                                                                                                                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.mjs`                                                | `createConfig({...})` with your choices (created if absent)                                                                                                                                   |
| `tsconfig.json`                                                    | TypeScript projects: extends `@devenvy/code-guidelines/tsconfig/<base>.json`; an existing one is migrated and options the base already sets are removed                                       |
| `package.json`                                                     | `"prettier"` key, scripts (`lint`, `format`, `format:check`, `typecheck` for TypeScript, `knip`, `guidelines:check`, `test:ci` with `--vitest`) and a `codeGuidelines` record of your choices |
| `.nvmrc`                                                           | `24` (created if absent)                                                                                                                                                                      |
| `.editorconfig`, `.gitattributes`, `.gitignore`, `.prettierignore` | a managed block; your own content outside it is kept                                                                                                                                          |
| `.vscode/extensions.json`, `.vscode/settings.json`                 | recommended extensions and format/fix-on-save keys merged in; your other settings are kept                                                                                                    |
| `pnpm-workspace.yaml`                                              | pnpm projects: `allowBuilds` decision for `unrs-resolver` if missing; your other settings are kept                                                                                            |

Existing `eslint.config.*`, `.eslintrc*`, `.prettierrc*` or `prettier.config.*` files stop `init`
before it writes anything. Re-run with `--force` to replace them.

## ESLint

```js
// eslint.config.mjs
import { createConfig } from '@devenvy/code-guidelines/eslint';

export default createConfig(
  {
    rootDir: import.meta.dirname,
    env: 'browser',
    vitest: true,
    angular: { prefix: 'app' },
  },
  // any extra flat configs are appended last
  { files: ['scripts/**'], rules: { 'no-warning-comments': 'error' } },
);
```

### Options

| Option                 | Default  |                                                                                                                                                                                                   |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rootDir`              | required | Directory of the root tsconfig, usually `import.meta.dirname`                                                                                                                                     |
| `env`                  | required | `'browser'` or `'node'` globals for source files. Root tool configs (`*.config.*`) always get Node globals                                                                                        |
| `typescript`           | `true`   | Type-aware typescript-eslint for `.ts/.mts/.cts`. `false` for plain JavaScript (no TypeScript packages needed)                                                                                    |
| `untypedFiles`         | `[]`     | TS files outside every tsconfig (e.g. `['scripts/**']`), linted without type information. Root `*.config.ts` files are always untyped                                                             |
| `vitest`               | `false`  | `true` or `{ files }`. Default files: `**/*.{spec,test}.{ts,mts,cts,js,mjs,cjs}`                                                                                                                  |
| `angular`              | `false`  | `{ prefix, controlComponents? }`. `prefix` is a string or array for component/directive selectors. `controlComponents` lists components that render their own form control, for label association |
| `importOrder.internal` | `[]`     | Extra regex sources treated as internal imports, e.g. `['^@app/']`. `^@devenvy/`, `^@/` and `^~/` are built in                                                                                    |
| `ignores`              | `[]`     | Extra global ignores. `dist`, `coverage`, `.angular`, `out-tsc`, `node_modules` and `*.min.js` are always ignored                                                                                 |

Every block is named `devenvy/<layer>/<part>`; use `npx eslint --inspect-config` to see exactly
what applies to a file.

### Adding and relaxing rules

Appended configs may turn on rules the shared config leaves off, or raise a severity.
`code-guidelines check` fails on anything weaker than the shared config (see [CLI](#cli)), so a
rule is relaxed only where it is visible in review:

- one line: `// eslint-disable-next-line <rule> -- <reason>` (unused disables are errors);
- generated or vendored files: the `ignores` option;
- TypeScript files outside every tsconfig: the `untypedFiles` option.

### What is enforced

The rule tables in [`src/eslint/rules`](src/eslint/rules) are the effective configuration:
every rule each plugin ships is listed with its severity, and surprising `off`s carry a reason. A
rule a newer plugin version adds stays off in your project until a release of this package decides
it. Highlights:

- Promise safety (`no-floating-promises`, `no-misused-promises`, `await-thenable`), the
  `no-unsafe-*` family, `no-explicit-any`, `no-unnecessary-condition`, `no-deprecated`.
- `no-magic-numbers` (ignoring -1, 0, 1, array indexes, defaults, enums and readonly class
  properties); relaxed in tests and root tool configs.
- Angular: OnPush, signals (`prefer-signals`, `prefer-output-emitter-ref`), `inject()` at the top,
  control flow, template accessibility. No filename-suffix assumptions: Angular 20+ suffixless files
  (`user-profile.ts`) are linted the same as `*.component.ts`.
- Imports ordered builtin → external → internal → relative → type, alphabetized; no import cycles
  (`import-x/no-cycle`, using the TypeScript resolver).

Only these layers turn rules off: `no-undef` for TS files, untyped files, test-file relaxations,
and `eslint-config-prettier` (with `curly` re-enabled).

## Prettier

```json
{ "prettier": "@devenvy/code-guidelines/prettier" }
```

Angular projects use `@devenvy/code-guidelines/prettier/angular`, which formats every `*.html` with
the Angular parser (Prettier only infers it for `*.component.html`).

Options: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`, `endOfLine: "lf"`;
everything else is Prettier's default.

## TypeScript

```jsonc
// tsconfig.json
{ "extends": "@devenvy/code-guidelines/tsconfig/node.json", "include": ["src"] }
```

| Base           | Adds                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.json`    | `strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`, `isolatedModules`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `target: ES2022` |
| `node.json`    | `module`/`moduleResolution: nodenext`, ES2023, `types: ["node"]`                                                                                                                                                                             |
| `browser.json` | `module: preserve`, `moduleResolution: bundler`, DOM libs                                                                                                                                                                                    |
| `angular.json` | browser + `experimentalDecorators`, `importHelpers`, and `angularCompilerOptions` `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`                                                                               |
| `js.json`      | `allowJs`, `checkJs`, `noEmit` for type-checking plain JavaScript with JSDoc types. Not set up by `init`: opt in by installing `typescript` and extending it                                                                                 |

TypeScript is `~6.0`: typescript-eslint and the Angular compiler do not support TypeScript 7 yet.

## CLI

```sh
code-guidelines check            # read-only; exit 1 with a diff on any drift
code-guidelines sync --dry-run   # show what sync would change
code-guidelines sync             # rewrite managed blocks and keys from the installed version
```

Besides the managed blocks and keys, `check` compares what is actually enforced with this package:

- **ESLint**: for every `.js`/`.mjs`/`.cjs`/`.ts`/`.mts`/`.cts`/`.html` file, the project's resolved
  config (`eslint.config.*`, as ESLint loads it) against `createConfig` with the project's own
  options. A file the shared config lints must not be ignored, every rule it turns on must stay
  on at the same or a higher severity with the same options, and its parser, processor and linter
  options must not be replaced. The options must match the `codeGuidelines` choices.
- **TypeScript**: every `tsconfig*.json` must extend a packaged base (directly or through other
  tsconfigs, relative or from a package), and none may turn off a check the base turns on
  (`strict` and each flag it implies, `noUncheckedIndexedAccess`, …, and Angular's
  `strictTemplates` family).
- **Prettier**: `package.json#prettier` points at this package and no other Prettier config exists.

What it does not cover: `eslint-disable` comments (each is visible where it is used, and unused
ones fail lint), and whether CI actually runs these scripts.

To change a choice later, edit `codeGuidelines` in `package.json` (it selects managed content, such
as the Angular VS Code extension) and `eslint.config.mjs` (it selects lint behaviour), then run
`code-guidelines sync`.

### Alongside code-guidelines-dotnet

In a full-stack repo both packages manage `.editorconfig`. This package only owns its marked block,
placed first so later sections (such as `[*.cs]`) take precedence, and writes `root = true` only when
no `root` line exists.

## CI and releases

Each repo owns its workflows (no shared/reusable workflows). The DevEnvy CI convention, with
[storm-watch](https://github.com/devenvy/storm-watch) as the reference setup, is described here and
not checked: workflows differ per repo, and a static check cannot tell a job that works from one
that does nothing.

- **`ci.yml`** (pull requests and a weekly run), one job each:
  - `lint`: `guidelines:check`, `lint`, `format:check`, `typecheck` (TypeScript projects),
    `knip` (unused files, exports and dependencies), [actionlint](https://github.com/rhysd/actionlint) and
    [zizmor](https://docs.zizmor.sh) (GitHub Actions security).
  - `test`: `test:ci` with coverage thresholds and a PR summary.
  - `build`, plus repo-specific jobs (e.g. a container smoke test, or package checks).
  - `audit`: production dependency audit, informational on pull requests.
  - `dependency-review`: fails a PR that adds a vulnerable dependency or a license outside the
    allow-list.
  - `dependabot-auto-merge`, and `result`, which needs every other job and is the single
    required status check.
- **`scorecard.yml`**: [OpenSSF Scorecard](https://scorecard.dev) on pushes to `main` and weekly.
  Its own workflow because publishing results restricts what else the workflow may contain.
- **`codeql.yml`**: CodeQL on the code and the workflows (`actions`, `javascript-typescript`) with the
  `security-and-quality` queries, on pull requests, `main` and weekly. A workflow rather than GitHub's
  default setup, so the queries and languages are in the repository; the `main` ruleset requires its
  results. (Turn the default setup off: GitHub rejects a workflow's results while it is on.)
- **`SECURITY.md`**: supported versions and a link to private vulnerability reporting (enabled in the
  repository settings).
- **`.github/dependabot.yml`** with a 7-day cooldown.
- Bot actions (Dependabot auto-merge) run as the devenvy-bot GitHub App — org variable
  `DEVENVY_BOT_CLIENT_ID`, org secret `DEVENVY_BOT_PRIVATE_KEY`, both also as Dependabot secrets —
  so the merges trigger workflows on `main`, which `GITHUB_TOKEN` merges do not. Each token
  requests only the permissions its step needs.

How a repo publishes is its own choice. The two styles in use, both running CI
first and attesting what they publish (build provenance, SPDX SBOM via `pnpm sbom`):

- **Latest from `main`** (apps, e.g. storm-watch): every push to `main` deploys the site and pushes
  the container image as `latest` and `sha-<commit>`. Merges in quick succession queue up, so only
  the newest `main` deploys after the one in progress. Versioned releases are optional.
- **Releases cut by hand** (npm packages, e.g. this one): publishing a GitHub release —
  `gh release create v1.2.0 --target main --generate-notes`, or the Releases page — publishes that
  version (the npm package with its version set from the tag, an image as `X.Y.Z` and `X.Y`,
  release assets).

Coverage needs Vitest's `json-summary` and `json` reporters; set thresholds in the test config so
the test run itself fails when coverage drops.

## Changes

What changed in each version is in the
[release notes](https://github.com/devenvy/code-guidelines-ecma/releases).

## License

MIT
