# `property/*`: reasons

Why the [`property/*`](property.md) rules work the way they do, and what they don't do. Read this only when changing or questioning a rule. Using them needs nothing from this file.

## Design

- **Syntax only.** The rules see the code written in a file, not types or what a helper does, which keeps the plugin a JS plugin with no type information, fast and with no dependencies. A check that needs types, such as an un-awaited `fc.assert` on an async property, is left to a type-aware linter's `typescript/no-floating-promises`, which already catches it.
- **fast-check is found through its import.** A default or namespace import binds it under one name, so the rules match calls on that name, and code that names something else `fc` is left alone. Named imports would need a second way to match each call, for a form none of the tests it was written for use.
- **`asserted` follows a variable.** A property is often built into a `const` and run later, so a property held in a variable counts as run when any reference to the variable is the first argument of `fc.assert` or `fc.check`. Anything else, such as passing it to another function, counts as not run, since the rule can't see what that function does.
- **`no-leftovers` covers what a soak or a replay would leave behind.** A `seed` or `path` makes every run the same, and a seed in the test also overrides a replay's from outside. A time limit or an unlimited `numRuns` makes a normal run take the soak's whole budget. A finite `numRuns` stays allowed, since it's a property's normal count.
- **`no-filter` matches `.filter` only on a chain that starts with fast-check,** such as `fc.integer().filter(…)` or `fc.tuple(…).map(…).filter(…)`. Without types, a rule can't tell an arbitrary's `filter` from an array's, so banning every `.filter` would report the arrays a property test filters. Starting from fast-check is the case it can be sure of.
- **`predicate` asks a predicate to call or throw something, not to call `expect`.** Predicates often assert through a helper, such as a lint rule's `RuleTester`, which a syntax rule can't see into. A predicate that calls nothing and throws nothing can't check anything, so that is what it reports. A predicate reported for returning a value isn't also reported as empty, since fast-check checks a returned boolean.
- **An expression body counts as returning, unless it starts with `expect`.** `(n) => n > 0` returns the boolean fast-check checks, which the guide asks to write as an `expect`. `(n) => expect(n).toBe(n)` returns `undefined`, so it's an assertion written short.
- **`no-try` reports a `try` with a `catch`, at any depth in the predicate.** A `catch` can swallow the failure an assertion throws, so the property passes. A `try` with only `finally` can't, so it's allowed.
- **`no-random` covers the whole file,** not only predicates, since a random value in an arbitrary's `map` is as unreplayable as one in a predicate. `fc.sample` and `Math.random` are what Bun's `fast-check-no-unseeded-random` rule reports too.
- **`example-origin` reads the comments before each entry,** block or line, and asks that one starts with `Found by`, so a kept input says where it came from.

## Options not taken

- **Banning every `.filter` in property tests,** with a disable comment on each array's, which would report arrays more often than arbitraries.
- **Requiring a call to `expect` in each predicate,** which reported every predicate that asserts through a helper.
- **Options to name helpers that assert,** or to exempt names, which a per-line disable with a reason covers, beside the code it exempts.

## Tests

- [`property.test.ts`](property.test.ts) gives each rule the cases it must report and the look-alikes it must leave alone.
- [`property.property.test.ts`](property.property.test.ts) generates whole property-test files from a grammar that knows which rule must report each piece, where:
  - fast-check bound under each name the rules follow, or not imported;
  - each way a property is run, or not;
  - the parameters a soak or replay leaves behind;
  - filtered arbitraries and look-alikes;
  - each predicate form.

  Breaking four of the rules' decisions by hand made it fail, each time with a minimal counterexample: a property in a variable counted as run, every `.filter` reported, a nested `return` counted as the predicate's, and the time-limit plugin missed.

- [`property.real.test.ts`](property.real.test.ts) runs the real oxlint binary with the real config, so a break in oxlint's JS plugin API, or in the override, shows there.

## Running on oxlint

- **JS plugins are alpha in oxlint,** and not covered by semver, so an oxlint update can change the plugin API.
- **The file is TypeScript that Node runs by stripping types,** so it uses only syntax that erases. Its types come from `oxlint/plugins-dev`, which exports the rule type only as what its `RuleTester` runs.
