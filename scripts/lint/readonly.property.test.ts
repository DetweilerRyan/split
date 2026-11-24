import fc from 'fast-check';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';
import { types } from './readonly.ts';

// Random programs from a small grammar that knows what it writes: how many mutable types the rule
// must report. Types nest, so each level is checked on its own; they're wrapped in `Readonly<…>`,
// which makes only its argument's top level readonly; and they're written in each place a type
// can go, including a local variable's annotation, where the rule allows them. Look-alikes, such
// as `ReadonlyArray`, a qualified `ns.Map` and strings and comments that read like types, must
// never be reported. The code is only parsed, never run.

// RuleTester reports through the test runner it's given. Run its cases in place, so a failing
// case throws inside the property and fast-check can shrink it.
function inPlace(_text: string, fn: () => void) {
  fn();
}
RuleTester.describe = inPlace;
RuleTester.it = inPlace;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

/**
 * A type expression: its code, how many problems the rule must report in it, and how many of
 * those are at its top level where `Readonly<…>` would make them readonly.
 */
type Ty = { readonly code: string; readonly count: number; readonly wrappable: number };

/** A type with no problems of its own around `inner`. */
function around(code: string, inner: Ty): Ty {
  return { code, count: inner.count, wrappable: 0 };
}

/** A type that is mutable at its top level, and that `Readonly<…>` makes readonly, or not. */
function mutable(code: string, inners: readonly Ty[], wrappable: boolean): Ty {
  const count = inners.reduce((sum, inner) => sum + inner.count, 0) + 1;
  return { code, count, wrappable: wrappable ? 1 : 0 };
}

/** A type that is readonly at its top level, with whatever its parts hold. */
function readonly(code: string, inners: readonly Ty[]): Ty {
  return { code, count: inners.reduce((sum, inner) => sum + inner.count, 0), wrappable: 0 };
}

const leaf = fc.constantFrom<Ty>(
  { code: 'string', count: 0, wrappable: 0 },
  { code: 'number', count: 0, wrappable: 0 },
  { code: 'Items[number]', count: 0, wrappable: 0 },
  { code: 'keyof Items', count: 0, wrappable: 0 },
);

/** One type built around `e` and `f`, in one of the forms the rule decides. */
function formOf(form: number, e: Ty, f: Ty): Ty {
  switch (form) {
    case 0:
      return mutable(`(${e.code})[]`, [e], true);
    case 1:
      return readonly(`readonly (${e.code})[]`, [e]);
    case 2:
      return mutable(`[${e.code}, ${f.code}]`, [e, f], true);
    case 3:
      return readonly(`readonly [first: ${e.code}, ...rest: readonly (${f.code})[]]`, [e, f]);
    case 4:
      return mutable(`Array<${e.code}>`, [e], true);
    case 5:
      return mutable(`Map<string, ${e.code}>`, [e], false);
    case 6:
      return mutable(`Set<${e.code}>`, [e], false);
    case 7:
      return mutable(`Record<string, ${e.code}>`, [e], true);
    case 8:
      return mutable(`{ a: ${e.code}; readonly b: ${f.code}; m(): void }`, [e, f], true);
    case 9:
      return readonly(`{ readonly a?: ${e.code}; m(x: ${f.code}): void }`, [e, f]);
    case 10:
      return mutable(`{ [key: string]: ${e.code} }`, [e], true);
    case 11:
      return readonly(`{ readonly [key: string]: ${e.code} }`, [e]);
    case 12:
      return mutable(`{ [K in Keys]: ${e.code} }`, [e], true);
    case 13:
      return mutable(`{ -readonly [K in Keys]: ${e.code} }`, [e], true);
    case 14:
      return readonly(`{ readonly [K in Keys]: ${e.code} }`, [e]);
    case 15:
      return {
        code: `(${e.code}) | (${f.code})`,
        count: e.count + f.count,
        wrappable: e.wrappable + f.wrappable,
      };
    // Function types, whose parameters are identifiers and patterns inside the type.
    case 16:
      return readonly(`(x: ${e.code}) => ${f.code}`, [e, f]);
    case 17:
      return readonly(`(...rest: readonly (${e.code})[]) => void`, [e]);
    case 18:
      return readonly(`({ a }: ${e.code}, [b]: ${f.code}) => void`, [e, f]);
    // Look-alikes: readonly kinds, and names that only look like the mutable ones.
    case 19:
      return around(`ReadonlyArray<${e.code}>`, e);
    case 20:
      return around(`ReadonlyMap<string, ${e.code}>`, e);
    case 21:
      return around(`ReadonlySet<${e.code}>`, e);
    case 22:
      return around(`ns.Map<string, ${e.code}>`, e);
    case 23:
      return around(`WeakMap<object, ${e.code}>`, e);
    case 24:
      // `keyof` is a type operator too, but only `readonly` makes the array readonly.
      return { code: `keyof (${e.code})[]`, count: e.count + 1, wrappable: 0 };
    default:
      return around(`MyArray<${e.code}>`, e);
  }
}

/**
 * `t` in one of the wrappers. `Readonly<…>` makes its argument's top level readonly, through a
 * union or an intersection, but not through another generic such as `Promise`.
 */
function wrapped(wrapper: number, t: Ty): Ty {
  const unwrapped = t.count - t.wrappable;
  switch (wrapper) {
    case 0:
      return t;
    case 1:
      return { code: `Readonly<${t.code}>`, count: unwrapped, wrappable: 0 };
    case 2:
      return { code: `Readonly<(${t.code}) | null>`, count: unwrapped, wrappable: 0 };
    case 3:
      return { code: `Readonly<Items & (${t.code})>`, count: unwrapped, wrappable: 0 };
    default:
      return around(`Readonly<Promise<${t.code}>>`, t);
  }
}

/** A wrapper: none half the time, so the forms are seen bare as often as wrapped. */
const wrapper = fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 4 }));

/** A type up to `depth` levels deep. */
function typeAt(depth: number): fc.Arbitrary<Ty> {
  if (depth === 0) return leaf;
  const inner = typeAt(depth - 1);
  const built = fc
    .tuple(fc.integer({ min: 0, max: 25 }), inner, inner, wrapper)
    .map(([form, e, f, w]) => wrapped(w, formOf(form, e, f)));
  // Mostly built types, so each program holds many forms and wrappers.
  return fc.oneof({ arbitrary: leaf, weight: 1 }, { arbitrary: built, weight: 3 });
}
const type = typeAt(3);

/** A statement, and how many problems the rule must report in it. */
type Code = { readonly code: string; readonly count: number };

/** `t` written in one of the places a type can go, as a statement. */
function placed(place: number, t: Ty): Code {
  switch (place) {
    case 0:
      return { code: `type TID = ${t.code};`, count: t.count };
    case 1:
      return { code: `interface IID { a: ${t.code}; readonly b: number }`, count: t.count + 1 };
    case 2:
      return { code: `function fID(p: ${t.code}): ${t.code} {}`, count: t.count * 2 };
    case 3:
      return { code: `let vID: ${t.code};`, count: t.count };
    case 4:
      return { code: `function gID<P extends ${t.code}>() {}`, count: t.count };
    case 5:
      return { code: `function gID() {\n  type LID = ${t.code};\n}`, count: t.count };
    case 6:
      return { code: `function gID() {\n  return h<${t.code}>();\n}`, count: t.count };
    case 7:
      return { code: `function gID() {\n  const k = (p: ${t.code}) => p;\n}`, count: t.count };
    // A local function's return type is no variable's annotation, though a declarator holds it.
    case 8:
      return { code: `function gID() {\n  const k = (): ${t.code} => h();\n}`, count: t.count };
    // A variable declared inside a function may be a working value, whatever its type.
    case 9:
      return { code: `function gID() {\n  const lID: ${t.code} = h();\n}`, count: 0 };
    case 10:
      return { code: `const gID = () => {\n  let lID: ${t.code};\n};`, count: 0 };
    case 11:
      return { code: `const gID = function () {\n  const lID: ${t.code} = h();\n};`, count: 0 };
    case 12:
      // A function type's parameters are identifiers, patterns and rest elements in the type.
      return {
        code: `function gID() {\n  const lID: (x: ${t.code}, { a }: ${t.code}, [b]: ${t.code}, ...c: ${t.code}) => void = h();\n}`,
        count: 0,
      };
    default:
      return { code: `function gID() {\n  const [lID]: [${t.code}] = h();\n}`, count: 0 };
  }
}

/** Code that only looks like a mutable type. */
const lookAlike = fc.constantFrom<Code>(
  { code: "const sID = 'string[] and Map<string, number>';", count: 0 },
  { code: '// type CID = { a: string[] };', count: 0 },
  { code: 'const mID = new Map<string, number>();', count: 0 },
  { code: 'const xsID = Array.from([1]);', count: 0 },
  { code: 'interface MID { m(): void; (x: number): string }', count: 0 },
);

const statement = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 13 }), type).map(([place, t]) => placed(place, t)),
  lookAlike,
);

/** The statements one after another, each with its own names. */
function join(parts: readonly Code[]): Code {
  return {
    code: parts.map((part, i) => part.code.replaceAll('ID', `_${i}`)).join('\n'),
    count: parts.reduce((sum, part) => sum + part.count, 0),
  };
}
const program = fc.array(statement, { minLength: 1, maxLength: 4 }).map(join);

describe('the readonly rule, on generated programs', () => {
  it('reports each mutable type, level by level, outside a local variable’s annotation', () => {
    fc.assert(
      fc.property(program, ({ code, count }) => {
        if (count === 0) tester.run('types', types, { valid: [code], invalid: [] });
        else tester.run('types', types, { valid: [], invalid: [{ code, errors: count }] });
      }),
      // Each run parses a few lines, so 500 cost little, and reach the rarer form and wrapper pairs.
      { numRuns: 500 },
    );
  });
});
