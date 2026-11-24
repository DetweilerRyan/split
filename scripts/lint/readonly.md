# `readonly/types`

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) JS plugin rule that requires the types you write to be readonly: arrays, tuples, maps, sets, records, object properties, index signatures and mapped types. It checks each level of a type on its own, from the syntax alone, so it needs no type information.

The plugin is one file, [`readonly.ts`](readonly.ts), with no runtime dependencies. Its only import is a type from `oxlint/plugins-dev`.

## Using it

Load the file as a JS plugin, and turn the rule on:

```jsonc
{
  "jsPlugins": ["./path/to/readonly.ts"],
  "rules": { "readonly/types": "error" },
}
```

- **Requirements:** an oxlint with JS plugins, which are alpha and outside semver, and a Node.js that runs TypeScript by stripping types. The rule is tested on oxlint 1.91.0. The file uses only syntax that erases: no enums, namespaces or parameter properties.
- **Options:** none.
- **Disabling it** where a type must stay mutable: on the line it reports, with a reason.

  ```ts
  // oxlint-disable-next-line readonly/types -- the walk adds to this list in place.
  type Calls = Call[];
  ```

## What it reports

| Written                                                              | Message id | Write instead                                                      |
| :------------------------------------------------------------------- | :--------- | :----------------------------------------------------------------- |
| `T[]`, `[A, B]`                                                      | `list`     | `readonly T[]`, `readonly [A, B]`                                  |
| `Array<T>`                                                           | `array`    | `ReadonlyArray<T>` or `readonly T[]`                               |
| `Map<K, V>`                                                          | `map`      | `ReadonlyMap<K, V>`                                                |
| `Set<T>`                                                             | `set`      | `ReadonlySet<T>`                                                   |
| `Record<K, V>`                                                       | `record`   | `Readonly<Record<K, V>>`                                           |
| A property without `readonly`, in an object type or interface        | `property` | `readonly a: T`, or the object type in `Readonly<…>`               |
| An index signature without `readonly`                                | `index`    | `readonly [key: string]: T`, or the object type in `Readonly<…>`   |
| A mapped type without `readonly` or `+readonly`, or with `-readonly` | `mapped`   | `{ readonly [K in Keys]: T }`, or the mapped type in `Readonly<…>` |

Each message says what to write instead, and ends with the reason set in `WHY` at the top of `readonly.ts`.

It reports a type wherever it's written: a type alias, an interface, a parameter, a return type, a type argument, a cast, a type parameter's constraint, a module-level variable, a class field's type, and a `declare global` block.

### Level by level

Each nested type is checked on its own. Marking the outer level readonly doesn't make the inner ones readonly.

```ts
type A = readonly string[][]; // reported: the inner string[]
type B = ReadonlyArray<string[]>; // reported: the inner string[]
type C = Readonly<{ a: { b: number } }>; // reported: b
```

`Readonly<…>` counts for the type directly inside it, and through a union or an intersection there, as TypeScript applies it:

```ts
type D = Readonly<{ a: number; [key: string]: number }>; // passes
type E = Readonly<string[]>; // passes
type F = Readonly<{ a: number } | { b: string }>; // passes
```

It doesn't count through any other generic, and it never makes a `Map` or `Set` readonly, which TypeScript's `Readonly<…>` doesn't either:

```ts
type G = Readonly<Promise<{ a: number }>>; // reported: a
type H = Partial<{ a: number }>; // reported: a
type I = Readonly<Map<string, number>>; // reported: use ReadonlyMap
```

An interface's members always need their own `readonly`, since an interface can't be wrapped in `Readonly<…>`.

### A local working value

The type annotation of a variable declared with `const`, `let` or `var` inside a function may be mutable, nested types included, so a function can build a value in place before returning it:

```ts
function names(items: readonly Item[]): readonly string[] {
  const out: string[] = []; // passes
  for (const item of items) out.push(item.name);
  return out;
}
```

Inside a function, these are still checked: a type alias or interface, a type argument, a cast, and a nested function's own parameter and return types.

```ts
function f() {
  const g = (xs: string[]) => xs; // reported: the parameter's type
  return [] as string[]; // reported: the cast
}
```

## What it doesn't report

- **Method signatures, and call and construct signatures,** which have no `readonly` form.
- **`WeakMap` and `WeakSet`,** which have no readonly counterparts.
- **Qualified names,** such as `ns.Map` or `Records.Record`, which may name other types, and look-alike names, such as `MyArray` or `ArrayLike`.
- **What an imported type holds.** The rule sees the types written in the file it checks, so a type from another module or a library is as readonly as its own declaration.
- **A type that's inferred,** not written, such as `const cache = new Map<string, number>()` at module level.
- **A class field's own `readonly` modifier.** Only the type written on the field is checked.
- **Changes to a value at run time,** such as `push` on an array whose readonly type was cast away. The rule checks types, not code that mutates.

## Tests

- [`readonly.test.ts`](readonly.test.ts): passing and failing cases for each kind of type, through oxlint's `RuleTester`.
- [`readonly.property.test.ts`](readonly.property.test.ts): generated types, each wrapped, nested and placed in the ways above, with the problems they must produce.
- [`readonly.real.test.ts`](readonly.real.test.ts): the rule loaded by the real oxlint binary, so a change to oxlint's plugin API fails there.

## Changing this document

Why the rule works the way it does, and the options it doesn't take, are in [`readonly.meta.md`](readonly.meta.md). Read it only when changing or questioning the rule.
