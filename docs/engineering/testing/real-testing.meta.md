# Real testing: reasons

The reasons for [Real testing](real-testing.md)'s rules.

## The `real` project

- **`<module>.real.test.ts` names tests that run real programs or touch the file system.** Asked for by the owner in review on [#39](https://github.com/DetweilerRyan/split/pull/39#discussion_r4649529184), who suggested `.real.test.ts` and asked for precedent.
  - **The distinction:** Google's _Software Engineering at Google_ separates a test's size, "the resources that are required to run a test case", from its scope, "the specific code paths we are verifying" ([test size and scope](testing-conventions.meta.md#swe-test-sizes)). A small test "must run in a single process" and isn't "allowed to access the network or disk". A medium test "can span multiple processes" but reaches no system other than `localhost`.
  - **Where `prepare-sandbox` falls:** its test is narrow in scope, one script, but medium in size: it runs subprocesses and writes files.
  - **Why not `.integration.test.ts`:** it's what a Vitest maintainer suggests for separating such tests, with projects named `unit` and `integration` and files `**/*.unit.test.ts` and `**/*.integration.test.ts` ([Vitest discussion #4675](testing-conventions.meta.md#vitest-4675)). But "integration" names scope, so it would mislabel a narrow test.
  - **Precedent:** `.real.` names the size property, and matches the `_real.py` tests in the owner's market-research repository, which use real binaries and loopback without the internet.
  - **Not taken:** Google's own `.medium.test.ts`, a term readers would have to look up.

## Split from testing conventions

- **Split from testing conventions** on #159, as the owner asked in review: "real-teasting.md should be split from this doc" ([comment](https://github.com/DetweilerRyan/split/pull/159#discussion_r4712132812)). It holds the `real` project's definition and this sidecar's naming entry, which was in testing conventions' sidecar.
- **Its example assertion is the repository's own pattern,** reading back what a program wrote, written for this document rather than copied from a test.
- **The offline rule stayed in testing conventions,** in "Tests stay offline", worded for every `.real.test.ts`, because the tooling's real tests run in `tooling-real` and need it too; this document points to it.
- **The `real` project runs no test today.** It used to run `oxlintrc.real.test.ts` as well as `tooling-real` did, until [#166](https://github.com/DetweilerRyan/split/issues/166) added it to `vitest.config.ts`'s `ignored`, as tooling testing asks for a root tooling config's test. `npm test` passes `--passWithNoTests` for the project, so it stays ready for the app's first real test.
