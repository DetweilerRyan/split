# Dependency direction

Some code in this repository may import only from certain places. [rev-dep](https://github.com/jayu/rev-dep) checks those rules, from [`.rev-dep.config.jsonc`](../../.rev-dep.config.jsonc). It resolves each import, through `../`, `.ts` extensions and tsconfig aliases such as `@/`, and checks the file it lands on.

## The rules

| Rule                                         | Files               | May import                                                                                                   |
| :------------------------------------------- | :------------------ | :----------------------------------------------------------------------------------------------------------- |
| `oxcrap-self-contained`                      | `scripts/oxcrap/**` | `scripts/oxcrap/**`, Node built-ins, and npm packages declared in `package.json`                             |
| `domain-imports-domain-and-utils`            | `src/domain/**`     | `src/domain/**`, `src/utils/**`, and npm packages except those `.oxlintrc.json` keeps out                    |
| `utils-imports-utils`                        | `src/utils/**`      | `src/utils/**` and npm packages                                                                              |
| `services-imports-services-domain-and-utils` | `src/services/**`   | `src/services/**`, `src/domain/**`, `src/utils/**`, and npm packages except those `.oxlintrc.json` keeps out |
| `sync-imports-sync-domain-and-utils`         | `src/sync/**`       | `src/sync/**`, `src/domain/**`, `src/utils/**`, and npm packages                                             |

The `src/` rules are the layers in [Code layout](code-layout.md). For `src/domain/` and `src/services/`, an override in [`.oxlintrc.json`](../../.oxlintrc.json) keeps out the npm packages those layers may not use, which rev-dep can't check. The `src/domain/` override also refuses JSX, since JSX imports React without an import statement. oxlint reports a breach as `eslint(no-restricted-imports)` or `react(jsx-filename-extension)`. The same override refuses the browser's globals, timers, the clock and randomness, for [_core and shell_](code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it); each error says what to do instead.

Every import in the repository must also resolve. An import rev-dep can't resolve fails, because no rule could check it. That includes an absolute path, a `file://` URL, an import through a symlinked folder, `import(variable)`, and an npm package `package.json` doesn't declare.

## Running it

`npm run lint` runs it, as a [definition-of-done check](../../AGENTS.md#definition-of-done). To run only this check:

```bash
npx rev-dep config run --list-all-issues --lint-config-rules orphan-file-globs,orphan-module-globs,overlapping-globs
```

- **`--list-all-issues`** lists every issue, not only the first five.
- **`--lint-config-rules`** fails the run when a rule's pattern matches no files or overlaps another. It names only the pattern rules, not rev-dep's trailing-comma rule.

## When it fails

- **`Module Boundary Issues` with `(NOT ALLOWED)`:** a file imports from outside what its rule allows. Change the import: move the code it needs inside the folder, or pass it in as a parameter. Changing what the rule allows changes the rule, so follow [Adding or changing a rule](#adding-or-changing-a-rule).
- **`eslint(no-restricted-imports)` in `src/domain/` or `src/services/`:** the file imports a package its layer keeps out. Move the code that needs the package to a layer that may use it, as [Code layout](code-layout.md) says.
- **`react(jsx-filename-extension)` in `src/domain/`:** the file holds JSX, which is UI. Move it beside the component that renders it.
- **`Unresolved Imports`:** fix the import so it resolves. Use a relative path or a declared package, not an absolute path or a computed `import()`.
- **`Config lint` errors:** a rule's pattern matches no files, usually after a folder moved. Update the pattern in `.rev-dep.config.jsonc`.

## What it doesn't check

- **A JSON or other asset import.** rev-dep doesn't check where an asset import lands, so `import p from '../../package.json' with { type: 'json' }` passes a rule it breaks.
- **A file read with `new URL('../…', import.meta.url)`,** `import.meta.resolve()` or a `/// <reference path>`, none of which is an import it follows.
- **A symlink to a single file,** which counts as inside the folder it sits in.
- **Which npm packages a folder uses,** as long as `package.json` declares them. Only the `.oxlintrc.json` override above checks that, for `src/domain/` and `src/services/`.

## Adding or changing a rule

1. **Add or change a `moduleBoundaries` entry** in `.rev-dep.config.jsonc`: a `name`, the files it covers as `pattern`, and what they may import as `allow`, with `deny` for exceptions.
2. **Test it in [`rev-dep.config.real.test.ts`](../../rev-dep.config.real.test.ts).** Add one import the rule must refuse for each way out: a parent folder, type-only, re-export, dynamic `import()`, an alias, and a path that goes back up through a folder. Then add one import it must allow. That file runs the real rev-dep with the real config on throwaway files.
3. **Add the rule to the table above,** and its reasons to the sidecar.
4. **Run `npm run lint`** on the repository, so the rule's pattern matches real files.

To change which packages `src/domain/` or `src/services/` keeps out, edit that folder's `regex` in `.oxlintrc.json`'s `overrides`. Add each package to the lists in [`oxlintrc.real.test.ts`](../../oxlintrc.real.test.ts), which runs the real oxlint with the real config on throwaway files, and a look-alike name it must still allow when the pattern could catch one.

## Changing this document

The reasons for these rules, the tools compared, and the options not taken are in [dependency-direction.meta.md](dependency-direction.meta.md). Read it only when changing or questioning a rule here.
