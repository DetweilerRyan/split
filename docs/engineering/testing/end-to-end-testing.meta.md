# End-to-end testing: reasons and sources

Why the rules in [end-to-end testing](end-to-end-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file. The sources it cites are listed in [testing conventions' sidecar](testing-conventions.meta.md#sources).

Researched on 2026-11-21 and settled on [#55](https://github.com/DetweilerRyan/split/issues/55); the owner's decisions are in [this comment](https://github.com/DetweilerRyan/split/issues/55#issuecomment-7071299115).

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

Why features are written in Gherkin with a Screenplay, linted and formatted, and why unused steps fail lint, moved with the rules to [feature testing conventions' sidecar](feature-testing-conventions.meta.md).
