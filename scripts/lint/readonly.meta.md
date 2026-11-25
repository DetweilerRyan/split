# `readonly/types`: reasons

Why the [`readonly/types`](readonly.md) rule works the way it does, and what it doesn't do. Read this only when changing or questioning the rule. Using it needs nothing from this file.

## Design

- **It checks syntax, level by level.** The rule sees the types written in a file, not what an imported type holds, and checks each level of a type on its own. That keeps it a JS plugin with no type information, fast and with no dependencies. A deep check, through imported types, needs a type-aware linter, such as oxlint's `typescript/prefer-readonly-parameter-types` with a type-aware backend. That rule checks only parameters, so the two divide the work: it covers what a parameter's imported types hold, and this rule every type a file writes out, at each level written.
- **A mapped type needs `readonly` or `+readonly`, or `Readonly<…>` around it,** as an index signature does, since both describe a property for every key. `-readonly` is reported, so a type that strips readonly says why in a disable comment.
- **`Readonly<…>` counts through a union or an intersection,** because TypeScript distributes it over them. **It doesn't count through another generic,** such as `Readonly<Promise<{ a: string }>>`, whose argument TypeScript doesn't make readonly. **It never makes a `Map` or `Set` readonly,** since TypeScript's `Readonly<…>` maps properties, not a collection's methods.
- **The local-variable exemption covers the whole annotation** of a `const`, `let` or `var` declared inside a function, nested types and destructuring patterns included. Building a value in place, then returning it as a readonly type, is the common way to fill a list, and the mutable type doesn't escape the function. A type alias, a type argument, a cast, and a local function's parameters and return type are still checked, since each describes a value other code receives.
- **An interface's members need their own `readonly`,** because `Readonly<…>` can wrap an object type literal but not an interface declaration.

## What it skips, and why

- **Method, call and construct signatures,** which can't be marked `readonly`.
- **`WeakMap` and `WeakSet`,** which have no readonly form to suggest.
- **Qualified names, such as `ns.Map`,** which may be a different type of the same name. Only the global names `Array`, `Map`, `Set` and `Record` are reported.
- **A class field's `readonly` modifier.** It concerns reassigning the field, not changing the value it holds, and only the type written on the field says that.
- **An inferred type,** such as a module-level `const cache = new Map<string, number>()`. The rule reads only the types written out; an inferred one needs a type-aware check.

## Options not taken

- **Options to exempt names or paths.** A per-line disable with a reason keeps each exemption beside the type it covers.
- **Requiring `as const` on literal constants,** or reporting in-place mutation such as `push`. Each is a separate concern from the types written, and a separate rule.

## Running on oxlint

- **JS plugins are alpha in oxlint 1.91,** and not covered by semver, so an oxlint update can change the plugin API. [`readonly.real.test.ts`](readonly.real.test.ts) runs the real oxlint binary, so a break shows there.
- **The file is TypeScript that Node runs by stripping types,** so it uses only syntax that erases. Its types come from `oxlint/plugins-dev`, which exports the rule type only as what its `RuleTester` runs.
