# Testing conventions

How tests are built in this repository: where they live, what they may touch, and how external dependencies are replaced. The command that runs them is in [`AGENTS.md`'s definition of done](../../AGENTS.md#definition-of-done).

## Where tests live

- Tests use [Vitest](https://vitest.dev/). Each test file is a sidecar: it sits beside the one module it covers and is named after it, `<module>.test.ts` (`.test.tsx` for a component). For example, `src/utils/math.ts` → `src/utils/math.test.ts`, and `scripts/prepare-sandbox.sh` → `scripts/prepare-sandbox.test.ts`.
- A file covers one module. When tests for a second module creep into it, move them to that module's sidecar.
- The default environment is `jsdom` ([`vitest.config.ts`](../../vitest.config.ts)). A test that needs Node APIs, such as a subprocess or the file system, opts out with a `// @vitest-environment node` comment on its first line.
- Name each test after the one behaviour it pins down, and take its expected values from the requirement, not by running the code and pasting its output.

## Tests stay offline

- **A test never makes a request to the internet,** not even to a public endpoint: no Liveblocks, no WebRTC signaling server, no exchange-rate service, no npm registry. The suite must pass with no network access.
- **Local programs and temporary files are fine** when they are what's being tested, as `scripts/prepare-sandbox.test.ts` runs `scripts/prepare-sandbox.sh` with `git` and a fake `npm` in a temporary directory. Clean up what the test creates.
- **Don't depend on state outside the test,** such as files in the home folder or a real IndexedDB from an earlier run.

## Replacing external dependencies

- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, a test can hand it a plain fake object with no mocking at all. Design new code this way where it costs little: a module that is easy to fake is also easy to use.
- **`vi.fn()` is fine for a fake's methods** when the test needs to check how it was called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/store/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Don't `vi.mock` the repository's own modules; test them for real.
- **Fake at the boundary, not inside it.** Replace the network or storage layer, and let the app's own logic (Yjs documents, claim math, seed validation) run for real.

## Fixing a bug

Start with a test that reproduces the bug, run it against the unfixed code, and confirm it fails for the reason you expect. Then fix the code and watch the same test pass. If the test passes before the fix, it doesn't reproduce the bug yet.
