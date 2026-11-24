import fc from 'fast-check';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';
import { types } from './readonly.ts';

// Random programs from a small grammar that knows what it writes: which problem the rule must
// report for each mutable type, on which line, in source order. Types nest, so each level is
// checked on its own; they're wrapped in `Readonly<…>`, which makes only its argument's top level
// readonly; and they're written in each place a type can go, including a local variable's
// annotation, where the rule allows them. Look-alikes, such as `ReadonlyArray`, a qualified
// `ns.Map` and strings and comments that read like types, must never be reported. The code is
// only parsed, never run.

// RuleTester reports through the test runner it's given. Run its cases in place, so a failing
// case throws inside the property and fast-check can shrink it.
function inPlace(_text: string, fn: () => void) {
  fn();
}
RuleTester.describe = inPlace;
RuleTester.it = inPlace;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

/**
 * A problem the rule must report in a type: its message, and whether it's at the type's top level
 * where `Readonly<…>` would make it readonly.
 */
type Problem = { readonly id: string; readonly top: boolean };

/**
 * A type expression: its code, and the problems in it in source order. Each reported node starts
 * with a token of its own, before the types inside it, so the order is the code's.
 */
type Ty = { readonly code: string; readonly problems: readonly Problem[] };

/** The problems in `inners`, none of them at the top level any more. */
function inside(inners: readonly Ty[]): readonly Problem[] {
  return inners.flatMap((inner) => inner.problems.map(({ id }) => ({ id, top: false })));
}

/** A type with no problem of its own around `inners`. */
function around(code: string, inners: readonly Ty[]): Ty {
  return { code, problems: inside(inners) };
}

/** A type that is mutable at its top level, which `Readonly<…>` makes readonly, or doesn't. */
function mutable(code: string, id: string, inners: readonly Ty[], wrappable: boolean): Ty {
  return { code, problems: [{ id, top: wrappable }, ...inside(inners)] };
}

const leaf = fc.constantFrom<Ty>(
  { code: 'string', problems: [] },
  { code: 'number', problems: [] },
  { code: 'Items[number]', problems: [] },
  { code: 'keyof Items', problems: [] },
);

/** One type built around `e` and `f`, in one of the forms the rule decides. */
function formOf(form: number, e: Ty, f: Ty): Ty {
  switch (form) {
    case 0:
      return mutable(`(${e.code})[]`, 'list', [e], true);
    case 1:
      return around(`readonly (${e.code})[]`, [e]);
    case 2:
      return mutable(`[${e.code}, ${f.code}]`, 'list', [e, f], true);
    case 3:
      return around(`readonly [first: ${e.code}, ...rest: readonly (${f.code})[]]`, [e, f]);
    case 4:
      return mutable(`Array<${e.code}>`, 'array', [e], true);
    case 5:
      return mutable(`Map<string, ${e.code}>`, 'map', [e], false);
    case 6:
      return mutable(`Set<${e.code}>`, 'set', [e], false);
    case 7:
      return mutable(`Record<string, ${e.code}>`, 'record', [e], true);
    case 8:
      return mutable(
        `{ a: ${e.code}; readonly b: ${f.code}; m(): void }`,
        'property',
        [e, f],
        true,
      );
    case 9:
      return around(`{ readonly a?: ${e.code}; m(x: ${f.code}): void }`, [e, f]);
    case 10:
      return mutable(`{ [key: string]: ${e.code} }`, 'index', [e], true);
    case 11:
      return around(`{ readonly [key: string]: ${e.code} }`, [e]);
    case 12:
      return mutable(`{ [K in Keys]: ${e.code} }`, 'mapped', [e], true);
    case 13:
      return mutable(`{ -readonly [K in Keys]: ${e.code} }`, 'mapped', [e], true);
    case 14:
      return around(`{ readonly [K in Keys]: ${e.code} }`, [e]);
    case 15:
      // A union keeps its members' top levels, which `Readonly<…>` reaches through it.
      return { code: `(${e.code}) | (${f.code})`, problems: [...e.problems, ...f.problems] };
    // Function types, whose parameters are identifiers and patterns inside the type.
    case 16:
      return around(`(x: ${e.code}) => ${f.code}`, [e, f]);
    case 17:
      return around(`(...rest: readonly (${e.code})[]) => void`, [e]);
    case 18:
      return around(`({ a }: ${e.code}, [b]: ${f.code}) => void`, [e, f]);
    // Look-alikes: readonly kinds, and names that only look like the mutable ones.
    case 19:
      return around(`ReadonlyArray<${e.code}>`, [e]);
    case 20:
      return around(`ReadonlyMap<string, ${e.code}>`, [e]);
    case 21:
      return around(`ReadonlySet<${e.code}>`, [e]);
    case 22:
      return around(`ns.Map<string, ${e.code}>`, [e]);
    case 23:
      return around(`WeakMap<object, ${e.code}>`, [e]);
    case 24:
      // `keyof` is a type operator too, but only `readonly` makes the array readonly.
      return mutable(`keyof (${e.code})[]`, 'list', [e], false);
    default:
      return around(`MyArray<${e.code}>`, [e]);
  }
}

/** `t`'s problems below its top level, as `Readonly<…>` leaves them. */
function belowTop(t: Ty): readonly Problem[] {
  return t.problems.filter((problem) => !problem.top);
}

/**
 * `t` in one of the wrappers. `Readonly<…>` makes its argument's top level readonly, through a
 * union or an intersection, but not through another generic such as `Promise`.
 */
function wrapped(wrapper: number, t: Ty): Ty {
  switch (wrapper) {
    case 0:
      return t;
    case 1:
      return { code: `Readonly<${t.code}>`, problems: belowTop(t) };
    case 2:
      return { code: `Readonly<(${t.code}) | null>`, problems: belowTop(t) };
    case 3:
      return { code: `Readonly<Items & (${t.code})>`, problems: belowTop(t) };
    default:
      return around(`Readonly<Promise<${t.code}>>`, [t]);
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

/** A problem the rule must report in a statement, with its line in the statement, from 0. */
type Report = { readonly messageId: string; readonly line: number };

/** A statement, and the problems the rule must report in it, in order. */
type Code = { readonly code: string; readonly reports: readonly Report[] };

/** `t`'s problems, as reports on `line` of a statement, once for each time `t` is written there. */
function on(line: number, t: Ty, times = 1): readonly Report[] {
  const once = t.problems.map(({ id }) => ({ messageId: id, line }));
  return Array.from({ length: times }, () => once).flat();
}

/** `t` written in one of the places a type can go, as a statement. */
function placed(place: number, t: Ty): Code {
  switch (place) {
    case 0:
      return { code: `type TID = ${t.code};`, reports: on(0, t) };
    case 1:
      return {
        code: `interface IID { a: ${t.code}; readonly b: number }`,
        reports: [{ messageId: 'property', line: 0 }, ...on(0, t)],
      };
    case 2:
      return { code: `function fID(p: ${t.code}): ${t.code} {}`, reports: on(0, t, 2) };
    case 3:
      return { code: `let vID: ${t.code};`, reports: on(0, t) };
    case 4:
      return { code: `function gID<P extends ${t.code}>() {}`, reports: on(0, t) };
    case 5:
      return { code: `function gID() {\n  type LID = ${t.code};\n}`, reports: on(1, t) };
    case 6:
      return { code: `function gID() {\n  return h<${t.code}>();\n}`, reports: on(1, t) };
    case 7:
      return { code: `function gID() {\n  const k = (p: ${t.code}) => p;\n}`, reports: on(1, t) };
    // A local function's return type is no variable's annotation, though a declarator holds it.
    case 8:
      return { code: `function gID() {\n  const k = (): ${t.code} => h();\n}`, reports: on(1, t) };
    // A variable declared inside a function may be a working value, whatever its type.
    case 9:
      return { code: `function gID() {\n  const lID: ${t.code} = h();\n}`, reports: [] };
    case 10:
      return { code: `const gID = () => {\n  let lID: ${t.code};\n};`, reports: [] };
    case 11:
      return { code: `const gID = function () {\n  const lID: ${t.code} = h();\n};`, reports: [] };
    case 12:
      // A function type's parameters are identifiers, patterns and rest elements in the type.
      return {
        code: `function gID() {\n  const lID: (x: ${t.code}, { a }: ${t.code}, [b]: ${t.code}, ...c: ${t.code}) => void = h();\n}`,
        reports: [],
      };
    case 13:
      return { code: `function gID() {\n  const [lID]: [${t.code}] = h();\n}`, reports: [] };
    // A class's fields, parameters and return types are checked; a field needs no `readonly`.
    case 14:
      return {
        code: `class CID { f: ${t.code}; readonly g: ${t.code}; m(p: ${t.code}): void {} }`,
        reports: on(0, t, 3),
      };
    // A cast or `satisfies` writes a type, at the top level or in a function, but annotates no variable.
    case 15:
      return { code: `const cID = h() as ${t.code};`, reports: on(0, t) };
    case 16:
      return {
        code: `function gID() {\n  const lID = h() satisfies ${t.code};\n}`,
        reports: on(1, t),
      };
    // `declare` writes types with no code, and is checked the same.
    case 17:
      return { code: `declare const dID: ${t.code};`, reports: on(0, t) };
    case 18:
      return { code: `declare function dID(p: ${t.code}): void;`, reports: on(0, t) };
    case 19:
      return {
        code: `declare module 'mID' {\n  interface IID { a: ${t.code} }\n}`,
        reports: [{ messageId: 'property', line: 1 }, ...on(1, t)],
      };
    // An overload's signature is checked; its body's local variables are working values.
    default:
      return {
        code: `function oID(p: ${t.code}): void;\nfunction oID(p: unknown) {\n  const lID: ${t.code} = h();\n}`,
        reports: on(0, t),
      };
  }
}

/** Code that only looks like a mutable type. */
const lookAlike = fc.constantFrom<Code>(
  { code: "const sID = 'string[] and Map<string, number>';", reports: [] },
  { code: '// type CID = { a: string[] };', reports: [] },
  { code: 'const mID = new Map<string, number>();', reports: [] },
  { code: 'const xsID = Array.from([1]);', reports: [] },
  { code: 'interface MID { m(): void; (x: number): string }', reports: [] },
);

const statement = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 20 }), type).map(([place, t]) => placed(place, t)),
  lookAlike,
);

/** The statements one after another, each with its own names and its reports on its own lines. */
function join(parts: readonly Code[]): Code {
  function start(i: number) {
    return parts.slice(0, i).reduce((lines, part) => lines + part.code.split('\n').length, 1);
  }
  return {
    code: parts.map((part, i) => part.code.replaceAll('ID', `_${i}`)).join('\n'),
    reports: parts.flatMap((part, i) =>
      part.reports.map(({ messageId, line }) => ({ messageId, line: start(i) + line })),
    ),
  };
}
const program = fc.array(statement, { minLength: 1, maxLength: 4 }).map(join);

describe('the readonly rule, on generated programs', () => {
  it('reports each mutable type, level by level, outside a local variable’s annotation', () => {
    fc.assert(
      fc.property(program, ({ code, reports }) => {
        if (reports.length === 0) tester.run('types', types, { valid: [code], invalid: [] });
        else tester.run('types', types, { valid: [], invalid: [{ code, errors: [...reports] }] });
      }),
      // Each run parses a few lines, so 500 cost little, and reach the rarer form and wrapper pairs.
      { numRuns: 500 },
    );
  });
});
