# Development

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `packageManager`).

```sh
pnpm install
pnpm run typecheck   # generates types/ then checks src, scripts and test/types
pnpm run lint
pnpm run format:check
pnpm run knip            # unused files, exports and dependencies
pnpm run guidelines:check
pnpm run check:package   # publint + are-the-types-wrong on the packed tarball
pnpm test                # includes the pack smoke test; SKIP_PACK_TEST=1 skips it
```

The repo consumes itself: the devDependency `"@devenvy/code-guidelines": "link:."` makes ESLint,
Prettier and TypeScript resolve the package name exactly as consumers do (pnpm only).

## Layout

| Path                      |                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/eslint/rules/*.mjs`  | Rule tables — the effective configuration                                                                            |
| `src/eslint/layers/*.mjs` | Flat-config blocks per layer, composed by `createConfig`                                                             |
| `src/prettier/`           | Prettier configs                                                                                                     |
| `src/cli/`                | `init` / `check` / `sync`                                                                                            |
| `templates/`              | Managed-block contents                                                                                               |
| `tsconfig/`               | Published tsconfig bases                                                                                             |
| `test/fixtures/`          | Plain JS, Node/TS and Angular projects linted by the tests; `workflows/` is the smallest repo layout `check` accepts |
| `scripts/repo-settings/`  | GitHub settings baseline (not published)                                                                             |

## Tests

- **rule-inventory** — every rule each plugin ships is decided; no deprecated rules; nothing the
  tables enable is turned off by `eslint-config-prettier` (except the re-enabled `curly`).
- **lint** — runs ESLint on the fixtures and asserts the exact rules reported per file.
- **cli / cli-lib** — init, check (including the CI convention) and sync against temp projects.
- **pack** — packs the tarball, installs it with npm into fresh consumer projects and runs the full
  consumer workflow, including `ngc` failing on a template type error.

## Pull request titles

PRs are squash-merged with the PR title as the commit message, and release-please reads those, so
titles are [conventional commits](https://www.conventionalcommits.org/) (checked in CI):

| Title                                                                | Release                              |
| -------------------------------------------------------------------- | ------------------------------------ |
| `fix: …`, `fix(deps): …`                                             | patch                                |
| `feat: …`                                                            | minor                                |
| `feat!: …` or a `BREAKING CHANGE:` footer in the PR description      | major                                |
| `chore:`, `ci:`, `docs:`, `test:`, `refactor:`, `chore(deps-dev): …` | none (shipped with the next release) |

A new `error` rule that fails a fixture or a first consumer is breaking (`feat!:`); other new rules
and options are `feat:`; false-positive fixes are `fix:`.

## Upgrading plugins

Dependabot opens one weekly npm PR including majors, and devenvy-bot enables auto-merge on it. When a
plugin adds or removes rules, the rule-inventory test fails and lists them, and the PR waits: check
out its branch, decide each new rule in its table (with a reason if off), update the effective-config
snapshots (`pnpm test -u`), check the fixtures still behave, and push to the same branch. It then
merges itself once CI passes. Decide rules on the Dependabot branch: a separate PR cannot pass,
because the tables must match the installed plugin exactly.

## Releasing

Releases are automatic. Every push to `main` runs release-please, which keeps a "chore: release
x.y.z" PR up to date (version in `package.json`, `CHANGELOG.md`) and enables auto-merge on it. When
its CI passes it merges, and that `release.yml` run re-runs CI on the release commit and publishes
to npm with trusted publishing (OIDC, provenance, no token).

To release something now, merge the pending release PR yourself (or run the Release workflow from
the Actions tab). Prereleases: put `Release-As: 1.3.0-rc.1` in a PR description; they publish under
the npm `next` dist-tag.

devenvy-bot (a GitHub App) does the release-please and auto-merge work so its pull requests, merges
and tags trigger CI and other workflows. It needs the org variable `DEVENVY_BOT_CLIENT_ID` and the
org secret `DEVENVY_BOT_PRIVATE_KEY`, both also as org Dependabot secrets.

### First release (one time)

npm can only attach a trusted publisher to an existing package, so `1.0.0` is published by hand from
`main` (`package.json` is already at 1.0.0):

```sh
pnpm install --frozen-lockfile
npm login                      # account with 2FA, member of the devenvy npm org
npm publish --access public
```

Then on npmjs.com → `@devenvy/code-guidelines` → Settings → Trusted publishing: GitHub Actions,
repository `devenvy/code-guidelines-ecma`, workflow `release.yml`. Finally create the release
release-please builds on:

```sh
gh release create v1.0.0 --title v1.0.0 --notes "Initial release."
```
