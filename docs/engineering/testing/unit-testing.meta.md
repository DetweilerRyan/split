# Unit testing: reasons and sources

Why the rules in [unit testing](unit-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file.

- **No layout assertions in jsdom.** jsdom does no layout, so `toBeVisible` there checks only attributes and inline styles.
- **Its own document,** asked for by the owner on #159, on 2026-11-26: "split out a unit-testing.md doc" ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7183766909)). Only the rule above is about the `unit` project alone. The rules every test follows stay in testing conventions, and the project table stays there too, since it says which document each kind of test follows.
- **"Replacing external dependencies" moved here, then back to testing conventions,** on #159. The owner first answered "yes" to moving more here ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195098152)), then said a kind's document shouldn't point to another's, and that a rule two kinds share moves to testing conventions ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195510825)). Component and hook tests replace dependencies too, so it went back.
