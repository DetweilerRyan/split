# oxCrap

oxCrap finds the functions most likely to break when someone changes them: the ones that are both complex and poorly tested. It scores every function by **CRAP** and fails when one is over the limits, unless a comment above it records why it's allowed to be.

It reads source files and a coverage report, and nothing else. It never runs your tests, never runs git, and never writes to your code.

## What CRAP measures

CRAP stands for Change Risk Anti-Patterns. Alberto Savoia and Bob Evans introduced it in 2007 for the Java tool crap4j. It combines two numbers for each function:

```text
CRAP = complexity² × (1 − coverage)³ + complexity
```

- **Complexity** is cyclomatic complexity: 1 for a function with no branches, plus 1 for each way its path can split, such as an `if`, a loop or a `&&`. It roughly counts the tests needed to run every path once.
- **Coverage** is the share of the function's statements that the tests ran, from 0 to 1.

Untested complexity costs the most. The squares and cubes make a complex function with no tests score far higher than either number alone would suggest. Tests bring the score down fast, and full coverage brings it down to the complexity itself:

| Complexity | Coverage | CRAP |
| ---------: | -------: | ---: |
|          5 |       0% |   30 |
|          5 |     100% |    5 |
|         12 |       0% |  156 |
|         12 |      50% |   30 |
|         12 |     100% |   12 |

So there are two ways to bring a score down:

- **Add tests,** which changes no behaviour.
- **Split the function into simpler ones.** Only this works when a fully tested function is still too complex, which is why there's a limit on complexity as well as on CRAP.

CRAP rewards coverage, so it is only as honest as the tests behind it. A test that runs code without checking what it does raises coverage all the same. Read the score as a pointer to where to look, not as proof that the code is safe.

## How oxCrap scores

- **Complexity** is counted by oxCrap itself, by parsing each file with [`oxc-parser`](https://www.npmjs.com/package/oxc-parser). The rules are in [`complexity.ts`](complexity.ts). They're close to ESLint's `complexity` rule but not the same, so don't compare its numbers with another tool's.
  - **Nested functions:** a function inside another is scored on its own, and its branches don't count toward the outer one.
- **Coverage** comes from an istanbul JSON coverage report, the `coverage-final.json` that Vitest, Jest and nyc can all write. Each statement counts toward the innermost function holding it. Files are matched to the report by their real paths, so a symlink in the way doesn't matter.
- **The limits** come from the [config](#configuration): a function fails when its CRAP score or its complexity is over its limit.
- **Which files** come from the config too. By default, every JavaScript and TypeScript file is scored, except tests (`*.test.*`, `*.spec.*`), `node_modules`, folders whose names start with a dot, and whatever the `.gitignore` beside the config lists.

## Usage

```sh
node scripts/oxcrap/oxcrap.ts [-c <config>] [--coverage <report>] [--help-url <url>] [<path>...]
```

| Argument                  | Meaning                                                                                                                                                                                                                                    |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-c`, `--config <config>` | The config file to read. Without it, oxCrap reads `.oxcraprc.json` or `.oxcraprc.jsonc` from the current directory if there is one, and uses the defaults if not.                                                                          |
| `--coverage <report>`     | The istanbul JSON coverage report, such as `coverage/coverage-final.json`, from a test run of the code as it is now. Overrides the config's `coverage`; one of the two is needed.                                                          |
| `--help-url <url>`        | Where to get help when there are findings, as commitlint's `helpUrl` is: a URL, shown as it is, or a path from the current directory, which must exist. Printed as `Get help: <url>` under the findings. Overrides the config's `helpUrl`. |
| `<path>...`               | Folders or files to score, from the current directory, in place of the config's `files`. A folder means every JavaScript and TypeScript file in it.                                                                                        |

Run your tests with coverage first, then oxCrap. With Vitest, for example:

```sh
npx vitest run --coverage.enabled --coverage.reporter=json
node scripts/oxcrap/oxcrap.ts --coverage coverage/coverage-final.json src
```

**It refuses a report older than any file it finds,** tests included, so a stale report can't make a function look covered. Run the tests again, and the report is fresh.

**It exits with 0** when there are no findings, and **with 1** when there are findings or it can't run: a missing or invalid config, a missing help file, a missing or stale report, a report that covers none of the files being scored, a missing path, no files to score, or a file that doesn't parse.

## Configuration

oxCrap's config follows oxlint's and oxfmt's:

- **The file:** `.oxcraprc.json` (or `.oxcraprc.jsonc`) in the folder you run it from, or the file `-c` names.
- **The format:** JSON, with comments and trailing commas allowed.
- **The schema:** a `$schema` key pointing at [`configuration_schema.json`](configuration_schema.json) lets editors check the file and complete its options.

```jsonc
{
  "$schema": "./scripts/oxcrap/configuration_schema.json",
  "files": ["src/**/*.{ts,tsx}"],
  "ignorePatterns": ["node_modules/", ".*/", "*.test.*", "*.spec.*"],
  "limits": { "crap": 30, "complexity": 10 },
  "coverage": "coverage/coverage-final.json",
  // Printed as "Get help: docs/crap.md" under any findings.
  "helpUrl": "docs/crap.md",
}
```

| Option           | Meaning                                                                                                                         | Default                                            |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------- |
| `files`          | Globs of the files to score.                                                                                                    | `["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`         |
| `ignorePatterns` | Patterns left out of scoring, in gitignore style. A folder that matches isn't searched. Setting this replaces the default list. | `["node_modules/", ".*/", "*.test.*", "*.spec.*"]` |
| `limits`         | The highest `crap` score and `complexity` a function may have. Either can be left out.                                          | `{ "crap": 30, "complexity": 10 }`                 |
| `coverage`       | The coverage report's path.                                                                                                     | none, so `--coverage` is needed                    |
| `helpUrl`        | Where to get help when there are findings: a URL, or a path from the config's folder, which must exist.                         | none                                               |

- **Paths and globs in a config are read from the config's folder,** and a config covers only that folder, as oxlint's does. oxCrap refuses a `files` glob that reaches outside it, with `..` anywhere in it. Paths on the command line are read from the current directory.
- **`files` are globs,** as Node's [`fs.globSync`](https://nodejs.org/api/fs.html#fsglobsyncpattern-options) takes them: `**` for any number of folders, `*` for any characters but `/`, `?` for one character, and `{a,b}` for either alternative. A folder given on the command line can't have glob characters in its name; list it in `files` instead.
- **`ignorePatterns` are gitignore-style,** as oxlint's are, matched by the [`ignore`](https://www.npmjs.com/package/ignore) package:
  - `name/` matches a folder of that name at any depth, and `*.test.*` a file at any depth;
  - a pattern with a `/` before its end is anchored to the config's folder;
  - `!` brings back a file an earlier pattern left out, though not one the `.gitignore` lists.
- **The `.gitignore` in the config's folder is read too,** as oxlint reads one (or in the current folder, without a config). What it lists isn't scored, and doesn't count against the coverage report, so generated files written after the tests ran can't make the report look stale. `.gitignore` files in subfolders aren't read.
- **The command line overrides the config,** option by option; paths given on the command line replace `files`.
- **The config is checked against [`configuration_schema.json`](configuration_schema.json),** the schema editors use. An option oxCrap doesn't know, or a value of the wrong kind, is an error naming the option, and every problem is reported at once, so a typo can't quietly fall back to a default. So is a config whose `files` match nothing.

### Output

With no findings, it prints `No CRAP findings.` Otherwise it lists each finding with its file and line, and says what to do about it:

```text
CRAP findings:
- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.
- src/rate.ts:1 rate: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.

Get help: docs/crap.md
```

A function inside another is named with the functions around it, such as `RoomView > changeDisplayCurrency`. An unnamed one is named by what it's assigned to, the call it's passed to (`items.forEach callback`), or its JSX attribute (`onClick`).

## Allowing a function over the limits

Sometimes a function is better left over the limits. Say so with a comment that starts with `@crap-allow` directly above the function, giving its current numbers and the reason:

```ts
// @crap-allow CRAP 210, complexity 14. One branch per form field.
export function RestaurantModal() {
```

For a reason longer than a line, use a block comment. Inside JSX, use `{/* … */}` on the line above the handler:

```ts
/* @crap-allow CRAP 210, complexity 14. One branch per form field; splitting it would scatter
   the form's validation across files. */
export function RestaurantModal() {
```

- **The numbers must be the function's current CRAP score and complexity,** exactly as a finding prints them. oxCrap checks every comment against its function, and fails on one whose numbers don't match, whether the function got worse or better, and even when its code didn't change. The comment is a ratchet: any change to the function's risk shows up as an edit to it.
- **Update the comment by hand when the numbers change,** and check the reason still holds.
- **Give a reason after the numbers.** A comment with no reason fails.
- **Put the function on the line below the comment, on a line of its own.** Other comments, such as a lint directive or a doc comment, can sit between them. A comment that isn't directly above a function fails, and so does one above a line where two functions start.
- **Delete the comment when the function is within the limits again.** A comment on a function within the limits fails.

A comment that mentions `@crap-allow` without starting with it is ignored, so prose can talk about one.

## Requirements

- **Node.js 22.18 or later, or 23.6 or later,** which run TypeScript files directly by stripping their types. Its tests pass on Node 22.18 and 26.
- **Four packages:**
  - [`oxc-parser`](https://www.npmjs.com/package/oxc-parser) parses the code;
  - [`jsonc-parser`](https://www.npmjs.com/package/jsonc-parser) reads the config;
  - [`ajv`](https://ajv.js.org/) checks the config against its schema;
  - [`ignore`](https://www.npmjs.com/package/ignore) matches `ignorePatterns`.

oxCrap imports nothing from outside this folder, and lint fails if it does, so it can be lifted out into a project of its own.

## In this repository

- **`npm test` writes the coverage report,** and **`npm run oxcrap`** runs oxCrap with the repository's [`.oxcraprc.json`](../../.oxcraprc.json), as a [definition-of-done check](../../AGENTS.md#definition-of-done). CI runs both, and so does the Claude Code [Stop hook](../stop-hook.md).
- **[The CRAP score procedure](../../docs/engineering/crap.md)** says how to respond to a finding here.
- **[`oxcrap.meta.md`](oxcrap.meta.md)** holds the reasons behind oxCrap's design and the options not taken.
- **oxCrap's own tests** are tooling tests, run by `npm run test:tooling`. Its modules have unit tests beside them. Its contract, what it reads, prints and exits with, is tested end to end by the Gherkin features in [`features/`](features/), as [testing conventions](../../docs/engineering/testing-conventions.md#feature-contracts-for-deep-modules) describes.
