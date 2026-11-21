# Choosing and adding dependencies: reasons and sources

Why the rules in [choosing and adding dependencies](dependencies.md) are as they are. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

## Sources

- **The evaluation questions** follow the OpenSSF Best Practices Working Group's [Concise Guide for Evaluating Open Source Software](https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software). Its first rule is to consider necessity, and its advice is to try a dependency in an isolated environment before adopting it. That's why the procedure has a trial in a sandbox, not committed.
- **The procedure** is adapted from the owner's market-research repository (`docs/engineering/dependencies.md`), trimmed for npm.

## Owner approval

Only the owner approves a new dependency, because each one adds something to install, update, ship to the browser and trust. A passing check or a reviewing agent can't weigh that trade. The rule was set in [#32](https://github.com/DetweilerRyan/split/pull/32) and applied on [#35](https://github.com/DetweilerRyan/split/issues/35) (`oxlint`, `oxfmt`) and [#38](https://github.com/DetweilerRyan/split/issues/38) (`vitest-browser-react`, `@vitest/browser-playwright`, `playwright`). It also covered `@vitejs/plugin-react`, approved in the session on 2026-11-21.

## Exact versions, at least two weeks old

- **Exact pins.** The packages added since #35 are pinned exactly, as the approved proposals on #35 and #38 said. The procedure first said to keep the range style of the older entries (`^`). It was corrected to match practice in [#39](https://github.com/DetweilerRyan/split/pull/39).
- **Why exact:**
  - **A pre-1.0 package** such as `oxfmt` may change its output in a minor release, so an exact pin makes each update a deliberate change with its own diff.
  - **Packages that must match each other** need exact pins too. `@vitest/browser-playwright` declares `vitest` as an exact peer, so the two have to be updated together.
- **Why two weeks old:** a release that has been out a while has had time for a broken or compromised version to be found and pulled before it reaches this repository. The rule was followed for every package added in #35 and #38. For example, `playwright` 1.65.0 was chosen over newer releases on 2026-11-21.
- **Older entries** with `^` ranges were left as they are. Changing them is a separate decision.
