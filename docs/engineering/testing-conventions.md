# Testing conventions

How tests are built in this repository: what they check, where they live, how component and hook tests are written, and what tests may touch. The command that runs them is in [`AGENTS.md`'s definition of done](../../AGENTS.md#definition-of-done).

Most of the advice on what to test and how comes from Kent C. Dodds. Each rule below links to its source in the [Sources](#sources) list, so it can be checked rather than taken on trust.

## What a test checks

- **Test what a user can see and do, not implementation details.** Implementation details are "things which users of your code will not typically use, see, or even know about" ([Dodds, 2020](#testing-implementation-details)). A component has two kinds of user: the person using the app, and the developer rendering the component. So a component test works only with "the props that are passed, and the rendered output". It doesn't reach into state, internal functions, how many times something rendered, or CSS classes. Vitest gives the same advice for browser tests ([Vitest](#vitest-component-testing)).
- **Make tests resemble how the software is used.** "The more your tests resemble the way your software is used, the more confidence they can give you" ([Dodds, 2021](#testing-trophy)). Spend most of the effort on tests that exercise several units together: "Write tests. Not too many. Mostly integration." (Guillermo Rauch's advice, endorsed in the same post).
- **Make assertions specific.** Assert the exact thing a user would see: the named button, the full message. "Make assertions specific" and "Tests should resemble users" are two of [Epic Web's principles](#epic-web-principles).

  ```ts
  // ✅ Specific: the message the user reads
  await expect.element(screen.getByText('Add the first person to this receipt.')).toBeVisible();

  // ❌ Vague: some element with a class is on the page
  expect(screen.container.querySelector('.text-slate-500')).not.toBeNull();
  ```

- **Name each test after the one behaviour it pins down,** and take its expected values from the requirement, not by running the code and pasting its output.

## Where tests live

Tests use [Vitest](https://vitest.dev/), split into two [projects](https://vitest.dev/guide/projects) in [`vitest.config.ts`](../../vitest.config.ts). `npm test` runs both.

| Project   | Files                                                   | Runs in                                                                 | For                                                                  |
| :-------- | :------------------------------------------------------ | :---------------------------------------------------------------------- | :------------------------------------------------------------------- |
| `browser` | `<module>.browser.test.ts`, `<module>.browser.test.tsx` | headless Chromium, through Playwright                                   | React components and hooks                                           |
| `unit`    | every other `<module>.test.ts` and `<module>.test.tsx`  | jsdom, or Node where the file starts with `// @vitest-environment node` | logic with no React: math, seed codecs, stores, server code, scripts |

- **Each test file is a sidecar.** It sits beside the one module it covers and is named after it: `src/utils/math.ts` → `src/utils/math.test.ts`, `src/components/IdentityModal.tsx` → `src/components/IdentityModal.browser.test.tsx`. When tests for a second module creep into a file, move them to that module's sidecar.
- **A component or hook test goes in the browser project.** Component tests run in a real browser, as Kent now recommends over a simulated DOM ([Dodds, 2026](#user-event-1319); [Epic Web workshop](#epic-web-workshop)), and as Vitest recommends for component testing ([Vitest](#vitest-component-testing)). That way layout, focus and events behave as they do for users.
- **Tests run through the React Compiler,** as the app build does (`reactCompiler: true` in [`next.config.ts`](../../next.config.ts)), because memoization can change what a test sees. `vitest.config.ts` adds the compiler to `@vitejs/plugin-react`'s Babel plugins, and `vitest.config.browser.test.ts` fails if a component stops being compiled.
- **No layout or CSS assertions in the `unit` project.** jsdom does no layout, so `toBeVisible` there only checks attributes and styles, not what a user would see.
- **The browser is provisioned by setup.** [`scripts/prepare-sandbox.sh`](../../scripts/prepare-sandbox.sh) installs the headless Chromium build that the pinned `playwright` version names. In a sandbox or the dev container it runs at start. On another machine, run `npx playwright install --only-shell chromium` once.

## Writing component and hook tests

Component tests use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API ([`vitest/browser`](https://vitest.dev/guide/browser/)). `src/components/IdentityModal.browser.test.tsx` is the model to copy.

- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`), so that visibility reflects the real styles. Cleanup is automatic.
- **Find elements the way a user would.** Use `getByRole` with an accessible name first. After that, in order, use label, placeholder, text, display value, alt text and title. Test IDs come last ([Testing Library's query priority](#query-priority)). Kent: query by role "most of the time", and by "the _actual_ text" rather than test IDs ([Dodds, 2020](#common-mistakes)). A query that can't find an element by role often means the component isn't accessible, and that's worth fixing in the component.
- **Interact with `userEvent` from `vitest/browser`.** It drives the real browser. Don't add `@testing-library/user-event`. Kent's 2020 advice to prefer it over `fireEvent` ([Dodds, 2020](#common-mistakes)) is superseded for browser tests by his 2026 recommendation of Vitest's built-in `userEvent` ([Dodds, 2026](#user-event-1319)).
- **Assert with `expect.element(locator)`,** which retries until the assertion passes or times out. It does the job of Testing Library's `find*` queries and `waitFor`, so don't wrap assertions in a wait of your own. Keep side effects such as clicks outside any retried assertion ([Dodds, 2020](#common-mistakes)).
- **Assert absence with `expect.element(locator).not.toBeInTheDocument()`.** Locators are lazy, so there's no separate `query*` variant to reach for.
- **Don't wrap calls in React's `act`.** `vitest-browser-react` handles it for rendering, and `userEvent` waits for the browser. Kent: "don't wrap things in `act` unnecessarily" ([Dodds, 2020](#common-mistakes)). The exception is the `act` that `renderHook` returns, for calling a hook's own functions.
- **Test a hook through the component that uses it in most cases.** Kent: "In most situations, this is how I would recommend testing this kind of a hook" ([Dodds, 2020](#custom-hooks)). Use `renderHook` from `vitest-browser-react` when the hook is complex or shared, where a hand-written test component would have to reimplement rerendering and unmounting ([Dodds, 2020](#custom-hooks)). `src/hooks/useActiveIdentity.browser.test.ts` tests that way. The post predates `renderHook` living in `vitest-browser-react`, but its reasoning carries over.
- **A component's callbacks are part of what it shows its developer user,** so checking that `onSelect` was called with the chosen id is not an implementation detail. Checking which internal function ran is.

## Tests stay offline

- **A test never makes a request to the internet,** not even to a public endpoint: no Liveblocks, no WebRTC signaling server, no exchange-rate service, no npm registry. The suite must pass with no network access. Browser tests too: the browser is downloaded at setup, never by a test.
- **Local programs and temporary files are fine** when they are what's being tested. For example, `scripts/prepare-sandbox.test.ts` runs `scripts/prepare-sandbox.sh` in a temporary directory, with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`. Clean up what the test creates.
- **Don't depend on state outside the test,** such as files in the home folder or a real IndexedDB from an earlier run. Clear `localStorage` before a test that reads it.

## Replacing external dependencies

Every mock costs confidence. "Mocking severs the real-world connection between what you're testing and what you're mocking", and its usual payoff is practicality ([Dodds, 2018](#merits-of-mocking)). So mock only what can't run in a test, and say why.

- **Fake at the boundary, not inside it.** Replace the network or storage layer, and let the app's own logic (Yjs documents, claim math, seed validation) run for real. Kent mocks network calls in UI tests ("I never make actual network calls"), and says speed alone is not a reason to mock: "trading confidence for a minute or two faster test suite is a bad trade" ([Dodds, 2018](#merits-of-mocking)).
- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, a test can hand it a plain fake object with no mocking at all. `useActiveIdentity` takes only the provider's `setIdentity` for this reason. Design new code this way where it costs little: a module that is easy to fake is also easy to use.
- **`vi.fn()` is fine for a fake's methods,** and for a component's callback props, when the test needs to check how they were called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/store/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Never mock React's own hooks: "You throw away a LOT of confidence in doing so" ([Dodds, 2020](#custom-hooks)). Don't `vi.mock` the repository's own modules either; test them for real.

## Fixing a bug

Start with a test that reproduces the bug, run it against the unfixed code, and confirm it fails for the reason you expect. Then fix the code and watch the same test pass. If the test passes before the fix, it doesn't reproduce the bug yet.

Changing what an existing test expects is a decision a reviewer checks, not a way to get to green. [Pull requests](pull-requests.md#what-the-description-carries) says how each change is listed and reviewed.

## Sources

Each was opened and checked against what this document says on 2026-11-20 or 2026-11-21.

- <a id="testing-implementation-details"></a>Kent C. Dodds, [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details), 2020-08-17.
- <a id="testing-trophy"></a>Kent C. Dodds, [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications), 2021-06-03.
- <a id="common-mistakes"></a>Kent C. Dodds, [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library), 2020-05-04. Written for Testing Library in jsdom; this document notes where Vitest's browser API differs.
- <a id="custom-hooks"></a>Kent C. Dodds, [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks), 2020-03-22.
- <a id="merits-of-mocking"></a>Kent C. Dodds, [The Merits of Mocking](https://kentcdodds.com/blog/the-merits-of-mocking), 2018-11-05.
- <a id="user-event-1319"></a>Kent C. Dodds, [Migration recommendation: prefer Vitest browser mode or Playwright for new work](https://github.com/testing-library/user-event/issues/1319), testing-library/user-event#1319, opened 2026-08-03.
- <a id="epic-web-workshop"></a>Epic Web, [React Component Testing with Vitest](https://www.epicweb.dev/workshops/react-component-testing-with-vitest), taught by Artem Zakharenko, including its "Sunsetting JSDOM" section.
- <a id="epic-web-principles"></a>Epic Web, [Principles](https://www.epicweb.dev/principles): "Tests should resemble users" and "Make assertions specific".
- <a id="query-priority"></a>Testing Library, [About Queries: Priority](https://testing-library.com/docs/queries/about/#priority).
- <a id="vitest-component-testing"></a>Vitest, [Component Testing](https://vitest.dev/guide/browser/component-testing), v5.1.1: Browser Mode is "the recommended approach for component testing".
