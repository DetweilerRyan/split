# Unit testing: reasons and sources

Why the rules in [unit testing](unit-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file.

- **No layout assertions in jsdom.** jsdom does no layout, so `toBeVisible` there checks only attributes and inline styles.
- **Its own document,** asked for by the owner on #159, on 2026-11-26: "split out a unit-testing.md doc" ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7183766909)). Only the rule above is about the `unit` project alone. The rules every test follows stay in testing conventions, and the project table stays there too, since it says which document each kind of test follows.
- **"Replacing external dependencies" moved here too,** on the owner's answer on #159 ("3. yes", [recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195098152)), to the question whether more should. Component and hook tests follow it as well, so their document points here for it.

## Mocking

- **Fake only what can't run, at the edge.** Kent: "Mocking severs the real-world connection between what you're testing and what you're mocking", and the payoff is "usually practicality". In UI tests, "I never make actual network calls." On speed: "trading confidence for a minute or two faster test suite is a bad trade" ([The Merits of Mocking](testing-conventions.meta.md#merits-of-mocking)).
- **Never mock React's hooks.** Kent: "You throw away a LOT of confidence in doing so" ([How to test custom React hooks](testing-conventions.meta.md#custom-hooks)).
- **`vi.mock` for directly imported third-party modules.** A repository rule, kept because `yjsProvider.ts` imports Liveblocks, `y-webrtc` and `y-indexeddb` directly. Passing them in would change its public interface for tests alone. A strict no-mocks rule, as market-research has, was not taken because it would contradict that existing test.
