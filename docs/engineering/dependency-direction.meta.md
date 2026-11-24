# Dependency direction: reasons and sources

Why [dependency direction](dependency-direction.md) works the way it does, where its rules came from, and what was rejected. Read this only when changing or questioning a rule there.

## Decisions

### oxCrap imports nothing from outside its folder

- **The owner asked for the rule** "that oxcrap must not import anything from outside it's own folder", and chose to add it to #64 ([choice](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085786799)).
- **Why:** so oxCrap can be lifted out into a project of its own ([its README](../../scripts/oxcrap/README.md)).
- **Node built-ins and npm packages stay allowed.** They aren't repository files. oxCrap needs `node:fs` and its four packages, such as `oxc-parser`.

### The `src/` layers

- **Asked for on [#94](https://github.com/DetweilerRyan/split/issues/94),** to keep the import direction one way between the layers in [code layout](code-layout.md). Why the layers are as they are, with the owner's words, is in [its sidecar](code-layout.meta.md).
- **`domain-imports-domain-and-utils` and `utils-imports-utils` are the names #94 gave.** The services and sync rules follow the same pattern.
- **`utils-imports-utils`** keeps domain logic from creeping back into `src/utils/` through a helper that imports it (#94).
- **`src/sync/` isn't allowed `src/services/`,** since it imported nothing from there when the rule was added ([code layout's sidecar](code-layout.meta.md#srcstore-was-split-not-moved-and-renamed-srcsync)).
- **The UI folders have no rule:** they may import every layer.
- **Each test throwaway project holds one file per ruled folder,** because `--lint-config-rules` fails a rule whose pattern matches nothing. A test per folder checks that a missing folder fails.

### Package bans per layer are oxlint's

- **rev-dep can't say which npm packages a folder uses** (see the known gap below), so #94 asked for an oxlint `no-restricted-imports` override for `src/domain/`. The owner's "nothing UI or sync" for `src/services/` ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)) got a second one.
- **String matching is right here,** unlike for oxCrap's folder rule: a package specifier names the package, so there's no `../` for it to misjudge.
- **A `regex` per layer, not a gitignore-style `group`.** Tried on oxlint 1.91.0 on 2026-11-24:
  - **A group's `y-*` also matched the relative path `./y-axis`,** which would ban a file named that way.
  - **`y-*` and `@liveblocks/*` missed subpaths** such as `y-protocols/awareness` and `@liveblocks/client/internal`, so each needed a second `/**` pattern.
  - **The regex `^(…)(/.*)?$`** matches each package and its subpaths, and nothing relative.
- **What the override was checked against,** with throwaway files on 2026-11-24: an import, a subpath, a type-only import, `export … from`, `export * from` and a dynamic `import()` of a banned package each fail; `zod`, `reactive-thing`, `next-intl`, and relative imports of `../money/` and `../../utils/` pass. In `src/services/`, browser-storage packages pass.
- **Not taken:** a `no-restricted-globals` ban on `localStorage` and `indexedDB` in `src/domain/`. #94 asked for package bans only.

### rev-dep checks the rules

- **The rule first ran as an oxlint override** in `.oxlintrc.json`, from #64: `import/no-relative-parent-imports` and a `no-restricted-imports` pattern for `@/**`.
  - **It matched import strings, not where an import landed,** so it banned `../` even within oxCrap's folder.
  - **That got in the way of oxCrap's features:** the owner wanted `steps/` and `screenplay/` folders, as in `e2e/`, and steps would import `../screenplay/`.
- **The owner turned down patching around that,** and asked for a purpose-built tool ([feedback](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7104488494)): "i think there's probably a purpose built dependency direction tool that will be easy to configure and quick to run."
  - **Turned down:** widening the oxlint override to allow `../` only to a certain depth.
  - **Turned down:** a `package.json` in `scripts/oxcrap/` with subpath imports. The owner liked a package file there, "but not for this reason".
- **Three tools were tried on 2026-11-23,** in a scratch folder outside the repository, against the same three violations: an import of `src/`, an import of another script, and the `@/` alias.

  |                           | rev-dep 3.3.0                                          | dependency-cruiser 18.9.0                                                    | fallow 3.47.0                                           |
  | :------------------------ | :----------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------ |
  | Caught all three          | Yes, each import listed                                | Yes, but an aliased and a relative import of the same file are reported once | Not tried: its README documents no boundary rule syntax |
  | Rule needed               | One allowlist entry                                    | Two: the boundary, and one against unresolvable imports                      |                                                         |
  | Time                      | 2 ms on the scratch project, 5 ms on this repository   | 0.39 s on the scratch project                                                |                                                         |
  | Installs                  | One Go binary per platform, no JavaScript dependencies | About 18 dependencies                                                        | One Rust binary                                         |
  | npm downloads, last month | 571 thousand                                           | 36 million                                                                   | 10.5 million                                            |

- **The owner approved rev-dep:** "approved, add rev-dep on #66 with the steps layout" ([#66](https://github.com/DetweilerRyan/split/pull/66)).
  - **Dependency checks:** it's pinned exactly at 3.3.0, published 2026-10-14. It has no install scripts: its binaries are optional platform packages from the npm registry, so the kit's network policy needs no new host.
  - **Releases:** 77 since 2020.

### How it runs

- **`--list-all-issues`:** without it, rev-dep lists at most five issues per check, so a test that counts them can pass with some unlisted.
- **`--lint-config-rules orphan-file-globs,orphan-module-globs,overlapping-globs`** fails on a pattern that matches nothing. Without it, moving `scripts/oxcrap/` would leave a rule that checks no files and passes.
  - **Its fourth rule, trailing commas, is left out.** oxfmt adds trailing commas to `.jsonc` files, and rev-dep flags them as redundant, so the two tools would disagree on every format.
  - **`--list-all-issues` and `--lint-config-rules` are in `npm run lint`,** so the check the procedure describes is the one CI runs.
- **`unresolvedImportsDetection`, with `reportNonLiteralImports`:** an independent review found imports that escaped the boundary rule because rev-dep couldn't resolve them: an absolute path, a `file://` URL, an import through a symlinked folder, and `import(variable)`. They now fail.
  - **It covers the whole repository,** which had no unresolved imports when it was turned on.
  - **rev-dep resolves an npm package only when `package.json` declares it,** so an undeclared package fails too.
- **[`rev-dep.config.real.test.ts`](../../rev-dep.config.real.test.ts) runs the real rev-dep with the real config.** It replaced `oxlintrc.real.test.ts`, the oxlint override's test. The review checked it fails when the rule is removed, widened or narrowed.

## Known gaps

- **Asset imports, such as JSON.** rev-dep 3.3.0 treats assets as resolvable and doesn't check where they land, and no setting changes that.
  - **This is a regression:** the oxlint override caught `import p from '../../package.json' with { type: 'json' }`.
  - **Today it doesn't matter in practice:** oxCrap's only JSON import is its own `./configuration_schema.json`.
  - **It holds for every asset import form, re-tested on 3.3.0:** JSON with and without `with { type: 'json' }`, `require`, a dynamic `import()`, and CSS. `rev-dep debug get-tree-for-cwd` resolves them to the right file but labels them `AssetModule`, and the boundary check skips them. Its README doesn't say so. No one had reported it upstream.
  - **The owner accepted the gap:** "i accept the gap. don't report the issue" ([decision](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7105283194)). Two alternatives had been offered: a narrow oxlint pattern for `../**/*.json`, which brings back string matching, or asking rev-dep upstream for asset boundaries.
- **`import.meta.resolve()`, `/// <reference path>`, and a symlink to a single file,** found by the same review. None is a normal import.
- **An npm package that's declared but isn't meant to be used.** rev-dep checks that a package resolves, not which packages a folder may use. The oxlint overrides cover this for `src/domain/` and `src/services/` only, and only for the packages they name.
- **No binary for Windows on ARM,** so `npm run lint` can't run there.

## Options not taken

- **The oxlint override,** used first. It matched strings, banned `../` within the folder, and couldn't tell where an import landed.
- **[dependency-cruiser](https://github.com/sverweij/dependency-cruiser):** the most used. It resolves imports too, but needed two rules, took 0.39 s against rev-dep's 2 ms on the same scratch project, and brings about 18 dependencies.
- **TypeScript's `rootDir`,** in a `tsconfig.json` of oxCrap's own: checked for #64. It caught the same imports, but needs a second typecheck command, and reports per imported file rather than per import.
- **[eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries):** it needs ESLint, which this repository doesn't use.
- **oxlint-plugin-boundaries:** third-party and young, and it matches files by path rather than resolving imports.
- **A `package.json` in `scripts/oxcrap/` with subpath imports** (`#screenplay/*`): turned down for this purpose.
- **A separate pull request for the rule,** off `main` with #64 stacked on it: `scripts/oxcrap/` existed only on #64's branch, so the rule would have enforced nothing until #64 merged.

## What would reopen this

- **A rule that must cover JSON or other assets,** or rev-dep starting to check them: revisit the gap above.
- **A layer that must ban a package rev-dep could check,** if rev-dep gains per-folder package rules: the oxlint overrides could move into `.rev-dep.config.jsonc`.
- **rev-dep stalling,** or a platform it has no binary for becoming one the repository needs: dependency-cruiser is the fallback.
