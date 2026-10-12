# @devenvy/code-guidelines

Shared lint, format, TypeScript, editor and CI baseline for DevEnvy JavaScript, TypeScript and
Angular repositories. The ECMAScript sibling of
[code-guidelines-dotnet](https://github.com/devenvy/code-guidelines-dotnet).

- **ESLint** — one `createConfig()` call: core, typescript-eslint (type-aware), import ordering,
  angular-eslint (TypeScript + templates) and Vitest, with every rule explicitly decided.
- **Prettier** — formatting for everything; ESLint never fights it.
- **tsconfig bases** — strict compiler settings for Node, browser, Angular and plain JavaScript.
- **CLI** — `init` sets a repo up, `check` fails CI on drift, `sync` updates managed files.

## Quick start

```sh
# Node / TypeScript
pnpm add -D @devenvy/code-guidelines eslint typescript prettier knip @types/node
pnpm exec code-guidelines init --env node --vitest

# Angular
pnpm add -D @devenvy/code-guidelines eslint typescript prettier knip angular-eslint
pnpm exec code-guidelines init --angular --prefix app --vitest

# Plain JavaScript (browser)
pnpm add -D @devenvy/code-guidelines eslint typescript prettier knip
pnpm exec code-guidelines init --env browser --no-typescript
```

npm works the same way (`npm i -D …`, `npx code-guidelines …`).

`init` writes:

| File                                                 | What                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.mjs`                                  | `createConfig({...})` with your choices (created if absent)                                                                                                    |
| `tsconfig.json`                                      | extends `@devenvy/code-guidelines/tsconfig/<base>.json`; an existing one is migrated and options the base already sets are removed                             |
| `package.json`                                       | `"prettier"` key, scripts (`lint`, `format`, `format:check`, `typecheck`, `knip`, `guidelines:check`, `test:ci`) and a `codeGuidelines` record of your choices |
| `.nvmrc`                                             | `24` (created if absent)                                                                                                                                       |
| `.editorconfig`, `.gitattributes`, `.prettierignore` | a managed block; your own content outside it is kept                                                                                                           |
| `.vscode/extensions.json`, `.vscode/settings.json`   | recommended extensions and format/fix-on-save keys merged in; your other settings are kept                                                                     |

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
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },
);
```

### Options

| Option                 | Default  |                                                                                                                                                                                                   |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rootDir`              | required | Directory of the root tsconfig, usually `import.meta.dirname`                                                                                                                                     |
| `env`                  | required | `'browser'` or `'node'` globals for source files. Root tool configs (`*.config.*`) always get Node globals                                                                                        |
| `typescript`           | `true`   | Type-aware typescript-eslint for `.ts/.mts/.cts`                                                                                                                                                  |
| `untypedFiles`         | `[]`     | TS files outside every tsconfig (e.g. `['scripts/**']`), linted without type information. Root `*.config.ts` files are always untyped                                                             |
| `vitest`               | `false`  | `true` or `{ files }`. Default files: `**/*.{spec,test}.{ts,mts,cts,js,mjs,cjs}`                                                                                                                  |
| `angular`              | `false`  | `{ prefix, controlComponents? }`. `prefix` is a string or array for component/directive selectors. `controlComponents` lists components that render their own form control, for label association |
| `importOrder.internal` | `[]`     | Extra regex sources treated as internal imports, e.g. `['^@app/']`. `^@devenvy/`, `^@/` and `^~/` are built in                                                                                    |
| `ignores`              | `[]`     | Extra global ignores. `dist`, `coverage`, `.angular`, `out-tsc`, `node_modules` and `*.min.js` are always ignored                                                                                 |

Every block is named `devenvy/<layer>/<part>`; use `npx eslint --inspect-config` to see exactly
what applies to a file.

### Overriding rules

Append a config object. Prefer scoping it to the files that need it:

```js
export default createConfig(
  { rootDir: import.meta.dirname, env: 'node' },
  { files: ['src/legacy/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
```

### What is enforced

The rule tables in [`src/eslint/rules`](src/eslint/rules) are the effective configuration:
every rule each plugin ships is listed with its severity, and surprising `off`s carry a reason.
Highlights:

- Promise safety (`no-floating-promises`, `no-misused-promises`, `await-thenable`), the
  `no-unsafe-*` family, `no-explicit-any`, `no-unnecessary-condition`, `no-deprecated`.
- `no-magic-numbers` (ignoring -1, 0, 1, array indexes, defaults, enums and readonly class
  properties); relaxed in tests and root tool configs.
- Angular: OnPush, signals (`prefer-signals`, `prefer-output-emitter-ref`), `inject()` at the top,
  control flow, template accessibility. No filename-suffix assumptions: Angular 20+ suffixless files
  (`user-profile.ts`) are linted the same as `*.component.ts`.
- Imports ordered builtin → external → internal → relative → type, alphabetized; no import cycles
  (`import-x/no-cycle`, using the TypeScript resolver).

Only these layers turn table rules off, and tests assert it: `no-undef` for TS files, untyped files,
test-file relaxations, and `eslint-config-prettier` (with `curly` re-enabled).

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
| `js.json`      | `allowJs`, `checkJs`, `noEmit` for type-checking plain JavaScript (use JSDoc types)                                                                                                                                                          |

TypeScript is `~6.0`: typescript-eslint and the Angular compiler do not support TypeScript 7 yet.

## CLI

```sh
code-guidelines check            # read-only; exit 1 with a diff on any drift
code-guidelines sync --dry-run   # show what sync would change
code-guidelines sync             # rewrite managed blocks and keys from the installed version
```

`check` also verifies that `eslint.config.*` uses `createConfig`, that `package.json#prettier`
points at this package, that `tsconfig.json` extends a packaged base, that no stray Prettier or
second ESLint config exists, that the scripts CI runs exist, and that the repo follows the
[CI and releases](#ci-and-releases) convention. A repo outside that convention sets
`"codeGuidelines": { "workflows": false }`.

To change a choice later, edit `codeGuidelines` in `package.json` (it selects managed content, such
as the Angular VS Code extension) and `eslint.config.mjs` (it selects lint behaviour), then run
`code-guidelines sync`.

### Alongside code-guidelines-dotnet

In a full-stack repo both packages manage `.editorconfig`. This package only owns its marked block,
placed first so later sections (such as `[*.cs]`) take precedence, and writes `root = true` only when
no `root` line exists.

## CI and releases

Each repo owns its workflows (no shared/reusable workflows). The DevEnvy convention, with
[storm-watch](https://github.com/devenvy/storm-watch) as the reference setup, is checked by
`code-guidelines check`:

- **`ci.yml`** (pull requests and a weekly run), one job each:
  - `pr-title`: the PR title is a conventional commit.
  - `lint`: `guidelines:check`, `lint`, `format:check`, `typecheck`, `knip` (unused files,
    exports and dependencies), [actionlint](https://github.com/rhysd/actionlint) and
    [zizmor](https://docs.zizmor.sh) (GitHub Actions security).
  - `test`: `test:ci` with coverage thresholds and a PR summary.
  - `build`, plus repo-specific jobs (e.g. a container smoke test, or package checks).
  - `audit`: production dependency audit, informational on pull requests.
  - `dependency-review`: fails a PR that adds a vulnerable dependency or a license outside the
    allow-list.
  - `dependabot-auto-merge`, and `result`, which needs every other job and is the single
    required status check.
- **`release.yml`** (push to `main`): release-please keeps a release PR current and enables
  auto-merge on it; when it merges, the same run builds and publishes (npm package, release assets,
  container image) with build provenance attestations and an SPDX SBOM (`pnpm sbom`).
- **`scorecard.yml`**: [OpenSSF Scorecard](https://scorecard.dev) on pushes to `main` and weekly.
  Its own workflow because publishing results restricts what else the workflow may contain.
- **`.github/dependabot.yml`** with a 7-day cooldown, and release-please's
  `release-please-config.json` / `.release-please-manifest.json`.
- PR titles are conventional commits (`feat:`, `fix:`, `feat!:`, `chore:` …): squash merges use the
  title as the commit message, and release-please reads those.
- Bot actions (release PRs, auto-merge) run as the devenvy-bot GitHub App — org variable
  `DEVENVY_BOT_CLIENT_ID`, org secret `DEVENVY_BOT_PRIVATE_KEY`, both also as Dependabot secrets —
  so they trigger other workflows, which `GITHUB_TOKEN` actions do not. Each token requests only
  the permissions its step needs.

Coverage needs Vitest's `json-summary` and `json` reporters; set thresholds in the test config so
the test run itself fails when coverage drops.

## Repository settings

[`scripts/repo-settings`](scripts/repo-settings) checks or applies the GitHub baseline — squash-only
merges with PR titles, branch cleanup, secret scanning with push protection, Dependabot alerts and
security updates, CodeQL default setup with the extended suite, read-only workflow tokens, HTTPS for
Pages, and a `main` ruleset requiring the `result` check:

```sh
node scripts/repo-settings/repo-settings.mjs check devenvy/storm-watch
node scripts/repo-settings/repo-settings.mjs apply devenvy/storm-watch
```

## License

MIT
