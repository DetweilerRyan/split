# Engineering index: reasons

Why the [engineering index](README.md)'s code-style rules are as they are. Read this only when changing or questioning them. Following the rules needs nothing from this file.

## Functions, not classes or `this`

- **The owner's reason,** on [#81](https://github.com/DetweilerRyan/split/pull/81#discussion_r4671675741), 2026-11-23: "i'm not a big fan of using stateful OOP when largely pure functional approaches result in simpler and less dynamic and therefore less error prone runtime execution." oxCrap's walks became functions on that pull request; [`oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md) records what that cost.
- **The owner's decision,** on [#83](https://github.com/DetweilerRyan/split/issues/83#issuecomment-7122175097), 2026-11-24: "a small local oxlint JS plugin, with no new dependency, that bans classes, except `Error` subclasses, and `this`", and "Convert all but ReceiptStore". oxCrap's `Run` and both screenplay `Actor`s became functions in the same change.
- **Why a local plugin:** none of oxlint's built-in rules bans every class or every `this`: `max-classes-per-file` allows one per file, `oxc/no-this-in-exported-function` covers exported functions only, and oxlint has no `no-restricted-syntax`; and [`eslint-plugin-functional`](https://github.com/eslint-functional/eslint-plugin-functional) would be a new dependency, which the owner ruled out. The plugin is two rules of a few lines each, written against oxlint's [JS plugin API](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html), which is alpha and the repository's first use of it. If a release of oxlint stops loading it, `scripts/lint/functional.real.test.ts` fails.
- **What counts as an `Error` subclass:** a class whose `extends` is a name ending in `Error`, either alone (`Error`, `RangeError`) or as the last part of a dotted path (`errors.ConfigError`). Anything else, such as `errors[name]` or `mixin(Error)`, is reported, since the rule can't tell what it names.
- **`this` is banned inside an `Error` subclass too.** The owner's words ban classes "except `Error` subclasses, and `this`", which reads as `this` everywhere. It's the stricter reading, and the more reversible one: relaxing it later changes no code, while tightening it would. An `Error` subclass can set its fields without `this`, with `super(message)` and class fields such as `override name = 'NotFound'`. No class in the repository extends `Error` yet.
- **`ReceiptStore` keeps its class** because it wraps Yjs's own stateful types, a `Y.Doc` and its `Y.Map`s, for React's `useSyncExternalStore`, as the owner decided on #83.
- **Its `this` is disabled for the class body, not line by line.** The class reads `this` 63 times. A comment on each would bury the code, and the reason would be the same each time. oxlint honours `oxlint-disable` and `oxlint-enable` for a JS plugin's rule, which `functional.real.test.ts` checks, so the class body is the narrowest span that covers them. `functional/no-classes` flags one line, so it's disabled on that line alone.
- **No module boundary for `scripts/lint/`.** The plugin imports nothing, and oxlint loads it by path from [`.oxlintrc.json`](../../.oxlintrc.json), so [dependency direction](dependency-direction.md) has nothing to check yet.
- **What it costs:** on 2026-11-24, `oxlint --deny-warnings` over the repository took about 380 ms without the plugin and about 515 ms with it, the median of five runs each; all of `npm run lint` went from about 2.4 s to 2.6 s.

## What would reopen this

- **A second class the owner wants to keep,** or a wish to allow `this` inside an `Error` subclass.
- **oxlint's JS plugin API changing** in a way that breaks the plugin, or a built-in rule appearing that does the same job, which would replace it.
