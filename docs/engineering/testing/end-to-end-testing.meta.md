# End-to-end testing: reasons and sources

Why the rules in [end-to-end testing](end-to-end-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file. The sources it cites are listed in [testing conventions' sidecar](testing-conventions.meta.md#sources).

Researched on 2026-11-21 and settled on [#55](https://github.com/DetweilerRyan/split/issues/55); the owner's decisions are in [this comment](https://github.com/DetweilerRyan/split/issues/55#issuecomment-7071299115).

- **Gherkin run by Playwright Test through playwright-bdd.** Approved by the owner in the session on 2026-11-21, with `@playwright/test` 1.65.0 and `playwright-bdd` 9.2.1.
  - **How it works:** playwright-bdd turns each feature into an ordinary Playwright test file, so traces, sharding, fixtures and the HTML report all still work ([playwright-bdd](testing-conventions.meta.md#playwright-bdd)).
  - **Not taken:** `@cucumber/cucumber` driving Playwright as a library. Cucumber would then run the tests, and Playwright's own reports and traces need plugins.
- **A Screenplay layer of our own,** chosen by the owner as "option A".
  - **Why:** a receipt is split by several people at once, which is a story about actors. The pattern also lets an actor hold an ability for an interface other than the browser ([Screenplay](testing-conventions.meta.md#screenplay)).
  - **Not taken: Serenity/JS** 3.49.0, the main TypeScript Screenplay library. Its Playwright packages pin `playwright-core ~1.64.0` while the repository is on 1.65.0, and its Gherkin support runs through Cucumber ([Serenity/JS](testing-conventions.meta.md#serenity-js)).
  - **Not taken: page objects,** which most comparisons find simpler but less reusable once journeys span several users or interfaces.
  - **Reopen when:** the layer grows enough that maintaining it costs more than adopting a library that follows Playwright's releases.
- **An MCP client is an actor's ability.** No published BDD or Screenplay tests of an MCP server turned up in the research. What exists either uses MCP to write Gherkin, or tests servers with the SDK's in-memory transport ([MCP SDK testing](testing-conventions.meta.md#mcp-sdk-testing)). Treating the client as an ability follows Screenplay's own advice for APIs. `@modelcontextprotocol/client` 2.4.0 was approved by the owner on 2026-11-22 and stays behind `e2e/screenplay/mcp.ts`.
- **A separate `npm run test:e2e`,** decided by the owner on 2026-11-22. It is not part of `npm test`, so the fast Vitest run stays fast.
- **A local signaling server,** decided by the owner on 2026-11-22.
  - **Why:** room sync uses public WebRTC signaling servers, which would break [Tests stay offline](testing-conventions.md#tests-stay-offline). `NEXT_PUBLIC_WEBRTC_SIGNALING_URLS` points the app at `y-webrtc`'s own server instead, and actors' browsers refuse every request to another host.
  - **Not covered:** Liveblocks mode.
- **The app is built for every run.** Next.js inlines `NEXT_PUBLIC_` variables at build time, so a server already running might point at the public signaling servers. `reuseExistingServer` is off for that reason.
- **Features live in `e2e/features/`, not a top-level `features/`.** Decided by the owner in the session on 2026-11-22.
  - **Why:** everything for the suite stays under one folder named for the kind of test, as in Next.js's own `with-playwright` example (`testDir: path.join(__dirname, "e2e")`). A top-level `features/` can read as feature-sliced app code beside `app/` and `src/`.
  - **Not taken:** `features/`, Cucumber's default and the owner's `gol` repository's layout. With it, cucumber-js and Cucumber's VS Code extension need no paths configured. Here only the two `cucumber.*` settings in `.devcontainer/devcontainer.json` differ.
- **Actors browse on a phone.** `AGENTS.md` asks for a mobile-first interface, so the tests use what most people at the table will.
- **Actors claim with their name's button on the item,** not by choosing an identity first. The header's identity button is named after whoever is active, so no stable name finds it.
  - **Reopen when:** that button gets a fixed accessible name.
- **The first refusal scenario uses a duplicated item id,** not the tax line #55 suggested. The schema rejects duplicated ids, but leaving out tax lines is only an instruction in the field description, so no code refuses them.
- **Runs against Vercel previews are deferred** to [#56](https://github.com/DetweilerRyan/split/issues/56).

## Linting and formatting features

Researched on 2026-11-22. The owner approved `@cucumber/gherkin-utils` 12.0.2 and `gplint` 2.6.1 in the session that day, to add to [PR #57](https://github.com/DetweilerRyan/split/pull/57).

- **Precedents:** the owner's `gol` and `gol2` repositories.
  - **`gol`** formats features with Prettier's `prettier-plugin-gherkin` and gates them with `gherkin-lint-plus`. Its config turns on every structure rule, plus `no-restricted-patterns` as a check that scenarios stay at domain altitude. It also has a report-only checker for duplicated step wording.
  - **`gol2`** lints Markdown beside oxfmt. Its rule is that only one tool formats, and the linter's style rules are pinned to what the formatter writes, because "the two tools rewrite each other's output".
- **Formatter: `@cucumber/gherkin-utils`,** Cucumber's own, the same project as the parser.
  - **Why:** oxfmt doesn't read `.feature` files. Cucumber's editor language server depends on the same library, so editors that use it should format the same way.
  - **In the editor:** the dev container installs Cucumber's VS Code extension, `CucumberOpen.cucumber-official`, approved by the owner on 2026-11-22. It formats `.feature` files and links steps to `e2e/steps`. Version 1.12.1 was checked that day: updated 2026-11-07, about 473,000 installs, source in `cucumber/vscode`.
  - **Not checked:** which `@cucumber/gherkin-utils` version the extension bundles, because its code is minified, so its formatting isn't confirmed to match `npm run format`. `npm run format:check` decides.
  - **Its CLI has no check mode,** so `scripts/format-features.ts` pipes each file through it and compares the output.
  - **Not taken:** `prettier-plugin-gherkin`, `gol`'s choice. It would add Prettier as a second formatter beside oxfmt, and `gol`'s own move to oxfmt still kept Prettier for this reason.
- **Linter: `gplint`,** with `gol`'s rules and a list of banned implementation words. Why gplint, where each rule comes from, and the research behind the word list are in [`.gplintrc.meta.md`](../../../.gplintrc.meta.md).
- **Not taken: a checker for duplicated step wording** like `gol`'s. Two features don't have enough steps to drift.
  - **Reopen when:** features grow enough that similar steps are written twice.

## Unused step definitions fail lint

- **The rule:** every step definition is used by some feature, and steps don't call other steps. `scripts/check-unused-steps.ts` enforces the first half, and the second half keeps it free of its usual false positive.
- **Where the reasons are:** the decision, the research behind it, and how the script works are in [`scripts/check-unused-steps.meta.md`](../../../scripts/check-unused-steps.meta.md).
