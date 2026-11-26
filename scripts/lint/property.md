# `property/*`

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) JS plugin with seven rules for [fast-check](https://fast-check.dev/) property tests. They catch the mistakes that make a property pass without testing anything, or fail in a way that can't be replayed. It checks syntax only, so it needs no type information.

The plugin is one file, [`property.ts`](property.ts), with no runtime dependencies. Its only import is a type from `oxlint/plugins-dev`.

## Using it

Load the file as a JS plugin, and turn its rules on for property tests:

```jsonc
{
  "jsPlugins": ["./path/to/property.ts"],
  "overrides": [
    {
      "files": ["**/*.property.test.ts"],
      "rules": {
        "property/asserted": "error",
        "property/no-leftovers": "error",
        "property/no-filter": "error",
        "property/predicate": "error",
        "property/no-try": "error",
        "property/no-random": "error",
        "property/example-origin": "error",
      },
    },
  ],
}
```

- **Requirements:** an oxlint with JS plugins, which are alpha and outside semver, and a Node.js that runs TypeScript by stripping types. The rules are tested on oxlint 1.93.0. The file uses only syntax that erases: no enums, namespaces or parameter properties.
- **fast-check's name:** the rules follow fast-check through a default or namespace import, under any name: `import fc from 'fast-check'` or `import * as fc from 'fast-check'`. They don't follow named imports, such as `import { property } from 'fast-check'`.
- **Options:** none.
- **Disabling a rule** where it doesn't fit: on the line it reports, with a reason.

  ```ts
  // oxlint-disable-next-line property/no-filter -- fc.anything has no option to leave strings out.
  fc.anything().filter((value) => typeof value !== 'string');
  ```

## The rules

| Rule                      | Reports                                                                                                                                                                                                                                      | Write instead                                                                                   |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `property/asserted`       | `fc.property(…)` or `fc.asyncProperty(…)` that isn't passed to `fc.assert` or `fc.check`, in place or through a variable                                                                                                                     | Pass it to `fc.assert(…)`                                                                       |
| `property/no-leftovers`   | `seed`, `path`, `interruptAfterTimeLimit`, `markInterruptAsFailure`, a `numRuns` of `Infinity` or `Number.POSITIVE_INFINITY`, or `fc.interruptAfterTimeLimit` in `plugins`, in the parameters written in a call to `fc.assert` or `fc.check` | Soak and replay from outside the test, such as with environment variables                       |
| `property/no-filter`      | `fc.pre(…)`, and `.filter(…)` on a chain that starts with fast-check, such as `fc.integer().filter(…)`                                                                                                                                       | Build the constraint into the arbitrary: `fc.integer({ min: 1 })`, `fc.uniqueArray`, `fc.oneof` |
| `property/predicate`      | A predicate that returns a value, or one that calls nothing and throws nothing                                                                                                                                                               | Assert with `expect` inside the predicate, and return nothing                                   |
| `property/no-try`         | A `try` with a `catch`, anywhere inside a predicate                                                                                                                                                                                          | `expect(() => …).toThrow()`                                                                     |
| `property/no-random`      | `Math.random()`, and `fc.sample(…)`, anywhere in the file                                                                                                                                                                                    | An arbitrary passed to the property                                                             |
| `property/example-origin` | An entry in `examples` with no comment before it starting `Found by`                                                                                                                                                                         | `// Found by a soak run on #12.`, or by CI or a local run                                       |

Each message says what to write instead, and ends by pointing to the guide on writing property tests set in `WHY` at the top of `property.ts`.

### What counts as a predicate

A property's predicate is the function passed as the last argument of `fc.property(…)` or `fc.asyncProperty(…)`. `property/predicate` and `property/no-try` look only inside it. A `return` in a function nested inside the predicate, such as a `map` callback, belongs to that function and isn't reported.

- **An expression body** counts as returning its value, unless it's a chain that starts with `expect`, such as `(n) => expect(n).toBe(n)`.
- **A call to a helper** counts as checking something, since a syntax rule can't see inside it.

### What it doesn't check

- **Parameters passed by name,** such as `fc.assert(p, settings)`. Only an object literal written in the call is read.
- **A `.filter` on an arbitrary held in a variable,** such as `name.filter(…)`, whose chain doesn't start with fast-check.
- **Whether a helper a predicate calls asserts anything.**
- **An `fc.assert` on an async property that isn't awaited.** A type-aware linter's `typescript/no-floating-promises` reports it.

## Changing it

Why the rules work as they do is in [property.meta.md](property.meta.md). Read it only when changing or questioning a rule.
