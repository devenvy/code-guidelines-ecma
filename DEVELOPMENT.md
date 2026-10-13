# Development

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `packageManager`).

```sh
pnpm install
pnpm run typecheck   # generates types/ then checks src and test/types
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

| Path                      |                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/eslint/rules/*.mjs`  | Rule tables — the effective configuration                                                                                               |
| `src/eslint/layers/*.mjs` | Flat-config blocks per layer, composed by `createConfig`; optional peers load through `src/eslint/peer.mjs` only when their layer is on |
| `src/prettier/`           | Prettier configs                                                                                                                        |
| `src/cli/`                | `init` / `check` / `sync`                                                                                                               |
| `templates/`              | Managed-block contents                                                                                                                  |
| `tsconfig/`               | Published tsconfig bases                                                                                                                |
| `test/fixtures/`          | Plain JS, Node/TS and Angular projects linted by the tests                                                                              |

## Tests

- **complete-rules** — undecided rules are turned on, deprecated ones are not, and table entries
  for rules a plugin no longer ships are dropped.
- **effective-config** — snapshots the severity of every tabled rule for representative files.
- **lint** — runs ESLint on the fixtures and asserts the exact tabled rules reported per file.
- **cli / cli-lib** — init, check (including weakened ESLint and tsconfig settings) and sync
  against temp projects.
- **pack** — packs the tarball, installs it with npm into fresh consumer projects and runs the full
  consumer workflow, including `ngc` failing on a template type error. Also asserts that a plain
  JavaScript consumer installs no TypeScript, Angular or Vitest packages, and a Node consumer no
  Angular packages.

## Upgrading plugins

Dependabot opens one weekly npm PR including majors, and devenvy-bot enables auto-merge on it.
Plugin updates need nothing from you: a new rule is on as `error` (see `src/eslint/rules/complete.mjs`),
and a removed one drops out of its table. Consumer apps get new rules the same way when their own
Dependabot updates a plugin, so an app's PR fails if a new rule flags its code. The PR here waits
only if a new rule flags the fixtures (the pack test lints them with `--max-warnings 0`).

To turn a rule off, or set its options, add it to its table in a PR and cut a release.
`pnpm run rules:report` lists what the tables do not decide (new, removed and deprecated rules,
and enabled rules `eslint-config-prettier` turns off anyway), for tidying when convenient.

## Releasing

Releases are cut by hand, whenever there is something worth shipping. Publish a GitHub release
whose tag is the new version, on `main`:

```sh
gh release create v2.1.0 --target main --generate-notes
```

(or Releases → Draft a new release → new tag → Generate release notes → Publish). `release.yml`
checks that the tag is a version on `main`, runs CI on it, sets `package.json`'s version from the
tag (it stays `0.0.0` in the repository), publishes to npm with trusted publishing (OIDC,
provenance, no token), and attaches the tarball and an SPDX SBOM to the release. A prerelease tag
(`v2.1.0-rc.1`, marked as a pre-release) publishes under the npm `next` dist-tag.

Choosing the version: a new `error` rule that fails a fixture or a consumer, a removed option, or a
stricter `code-guidelines check` is a major; new rules, options and bases are a minor; fixes and
dependency updates are a patch.

If publishing fails because of the workflow itself, fix it on `main`, then run the Release
workflow by hand (Actions tab) with the release's tag.

devenvy-bot (a GitHub App) enables auto-merge on Dependabot PRs, so their merges trigger workflows.
It needs the org variable `DEVENVY_BOT_CLIENT_ID` and the org secret `DEVENVY_BOT_PRIVATE_KEY`, both
also as org Dependabot secrets. The npm trusted publisher (npmjs.com → `@devenvy/code-guidelines` →
Settings) is bound to this repository and `release.yml`.
