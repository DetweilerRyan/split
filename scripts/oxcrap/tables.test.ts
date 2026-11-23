import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { type AstNode, COUNT_ALL, COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';
import { type Exports, type Imported, tablesIn } from './tables.ts';

/** Each scored function's complexity. */
function complexities(code: string, counting: Counting = COUNT_ALL, imported?: Imported) {
  return Object.fromEntries(
    parse('example.ts', code, counting, imported).functions.map((fn) => [fn.name, fn.complexity]),
  );
}

/** The complexity of the file's last function, the one each case exports; its tables' arrows come first. */
function last(code: string, counting: Counting = COUNT_ALL, imported?: Imported) {
  return parse('example.ts', code, counting, imported).functions.at(-1)?.complexity;
}

/** A module's tables, as tablesIn finds them. */
function tables(code: string) {
  return tablesIn(parseSync('example.ts', code).program as unknown as AstNode);
}

const DISPATCH = `const RULES = new Map([['a', () => 1], ['b', () => 2], ['c', () => 3]]);`;

describe('which tables count', () => {
  it.each([
    [
      'a Set of strings',
      "const S = new Set(['a', 'b']);",
      { kind: 'set', entries: 2, dispatch: false },
    ],
    [
      'a typed Set',
      "const S = new Set<string>(['a', 'b', 'c']);",
      { kind: 'set', entries: 3, dispatch: false },
    ],
    [
      'a Map of values',
      "const M = new Map([['a', 1], ['b', 2]]);",
      { kind: 'map', entries: 2, dispatch: false },
    ],
    ['a Map of arrows', DISPATCH, { kind: 'map', entries: 3, dispatch: true }],
    [
      'an object of strings',
      "const O = { a: 'x', b: 'y' };",
      { kind: 'object', entries: 2, dispatch: false },
    ],
    [
      'an object of methods',
      'const O = { a() {}, b() {} };',
      { kind: 'object', entries: 2, dispatch: true },
    ],
    [
      'an object naming functions',
      'function f() {}\nconst g = () => 1;\nconst O = { f, g };',
      { kind: 'object', entries: 2, dispatch: true },
    ],
    [
      'an object holding a function deeper',
      'const O = { us: { format: () => 1 }, gb: { format: null } };',
      { kind: 'object', entries: 2, dispatch: true },
    ],
    [
      'an array of functions',
      'const A = [() => 1, function () {}];',
      { kind: 'array', entries: 2, dispatch: true },
    ],
    [
      'an array as const',
      "const A = ['a', 'b'] as const;",
      { kind: 'array', entries: 2, dispatch: false },
    ],
    [
      'a frozen object',
      "const O = Object.freeze({ a: 'x' });",
      { kind: 'object', entries: 1, dispatch: false },
    ],
    [
      'an object naming only a declared function',
      'function f() {}\nconst O = { f, n: 1 };',
      { kind: 'object', entries: 2, dispatch: true },
    ],
    [
      'an object naming only a const arrow',
      'const g = () => 1;\nconst O = { g, n: 1 };',
      { kind: 'object', entries: 2, dispatch: true },
    ],
    [
      'an object naming a value',
      'const v = 1;\nconst O = { v };',
      { kind: 'object', entries: 1, dispatch: false },
    ],
    [
      'an object holding a method deeper',
      'const O = { us: { format() {} } };',
      { kind: 'object', entries: 1, dispatch: true },
    ],
    [
      'an object holding an array of functions',
      'const O = { us: [null, () => 1] };',
      { kind: 'object', entries: 1, dispatch: true },
    ],
    [
      'a Set in satisfies',
      "const S = new Set(['a']) satisfies Set<string>;",
      { kind: 'set', entries: 1, dispatch: false },
    ],
    [
      'an object in parentheses with a non-null assertion',
      "const O = ({ a: 'x' })!;",
      { kind: 'object', entries: 1, dispatch: false },
    ],
    [
      'an exported Set',
      "export const S = new Set(['a']);",
      { kind: 'set', entries: 1, dispatch: false },
    ],
  ])('%s', (_, code, table) => {
    expect([...tables(code).own.values()]).toEqual([table]);
  });

  it.each([
    ['a let', "let S = new Set(['a']);"],
    ['a spread', "const S = new Set([...names, 'b']);"],
    ['a Set built from a call', 'const S = new Set(names());'],
    ['an object with a spread', 'const O = { ...base, a: 1 };'],
    ['a Map whose entries aren’t pairs', 'const M = new Map([pairs]);'],
    ['a table inside a function', "function f() { const S = new Set(['a']); return S; }"],
    ['a var', "var S = new Set(['a']);"],
    ['a destructured const', 'const { S } = tables;'],
    ['a WeakSet', 'const S = new WeakSet([a]);'],
    ['a Map entry of three', "const M = new Map([['a', 1, 2]]);"],
    ['a call that isn’t Object.freeze', "const O = Object.keys({ a: 'x' });"],
    ['freeze on another object', "const O = Immutable.freeze({ a: 'x' });"],
    ['a Set of no array', 'const S = new Set();'],
  ])('not %s', (_, code) => {
    expect(tables(code).own.size).toBe(0);
  });

  it('ignores top-level statements that add nothing to a table', () => {
    const found = tables(
      "const S = new Set(['a']);\nS.delete('a');\nS.size;\nlet x;\nx = 1;\ngo();\nif (x) S.add('b');\nS.add;",
    ).own;
    expect(found.get('S')).toEqual({ kind: 'set', entries: 1, dispatch: false });
  });

  it('counts what the top level adds, and not what a function adds', () => {
    const found = tables(
      "const M = new Map([['a', 1]]);\nM.set('b', () => 2);\nconst S = new Set(['a']);\nS.add('b');\nconst O = { a: 1 };\nO.b = 2;",
    ).own;
    expect(Object.fromEntries(found)).toEqual({
      M: { kind: 'map', entries: 2, dispatch: true },
      S: { kind: 'set', entries: 2, dispatch: false },
      O: { kind: 'object', entries: 2, dispatch: false },
    });
  });

  it.each([
    ['adds to a Set', 'S.add(x)'],
    ['deletes from a Set', 'S.delete(x)'],
    ['sets a key', 'S[x] = 1'],
    ['sets a key through a cast', '(S as any)[x] = 1'],
    ['bumps a key', 'S[x]++'],
    ['deletes a key', 'delete S[x]'],
    ['pushes', 'S.push(x)'],
  ])('makes a table state, not a table, when a function %s', (_, change) => {
    const code = `const S = new Set(['a', 'b', 'c']);\nfunction change(x: any) { ${change}; }\nexport function is(x: string) { return S.has(x); }`;
    expect(tables(code).own.size).toBe(0);
    expect(last(code)).toBe(1);
  });

  it('leaves a table static when a function only reads it, or changes another', () => {
    const code =
      "const S = new Set(['a', 'b', 'c']);\nfunction other(o: any) { o.add(1); S.forEach(log); }\nexport function is(x: string) { return S.has(x); }";
    expect(last(code)).toBe(3);
  });

  it('follows only named imports and its own exports', () => {
    const found = tables(
      "import * as all from './a.ts';\nimport type { T } from './t.ts';\nexport { S } from './s.ts';\nexport function f() {}\nexport const n = 1;",
    );
    expect(found.imports).toEqual([{ local: 'T', imported: 'T', from: './t.ts' }]);
    expect(found.exported.tables.size).toBe(0);
    expect([...found.exported.functions]).toEqual(['f']);
  });

  it('follows imports from . and .., and not from packages', () => {
    const found = tables(
      "import { A } from '..';\nimport { B } from '.';\nimport { C } from '.config';",
    );
    expect(found.imports.map((i) => i.local)).toEqual(['A', 'B']);
  });

  it('lists the functions a module exports, however it exports them', () => {
    const found = tables(
      'function a() {}\nconst b = () => 1;\nconst c = 1;\nexport { a, b as bee, c };\nexport const d = function () {};\nexport function e() {}',
    );
    expect([...found.exported.functions].sort()).toEqual(['a', 'bee', 'd', 'e']);
  });

  it('lists what a module exports and imports', () => {
    const found = tables(
      "import { A, B as C } from './a.ts';\nimport D from './d.ts';\nimport { E } from 'package';\nconst S = new Set(['x']);\nexport { S as T };\nexport const U = ['y'];",
    );
    expect(found.imports).toEqual([
      { local: 'A', imported: 'A', from: './a.ts' },
      { local: 'C', imported: 'B', from: './a.ts' },
    ]);
    expect([...found.exported.tables.keys()]).toEqual(['T', 'U']);
  });
});

describe('reading a table', () => {
  it.each([
    [
      'a dispatch through get',
      `${DISPATCH}\nexport function run(k: string) { return RULES.get(k)!(); }`,
      4,
    ],
    [
      'a dispatch through an index',
      'const O = { a: () => 1, b: () => 2 };\nexport function run(k: string) { return O[k](); }',
      3,
    ],
    [
      'membership of a Set',
      "const S = new Set(['a', 'b', 'c']);\nexport function is(x: string) { return S.has(x); }",
      3,
    ],
    [
      'membership of an array',
      "const A = ['a', 'b', 'c', 'd'];\nexport function is(x: string) { return A.includes(x); }",
      4,
    ],
    [
      'membership of a Map',
      "const M = new Map([['a', 1], ['b', 2]]);\nexport function is(x: string) { return M.has(x); }",
      2,
    ],
    [
      'membership of an object’s keys',
      'const O = { a: 1, b: 2, c: 3 };\nexport function is(x: string) { return x in O; }',
      3,
    ],
    [
      'a dispatch through an array index',
      'const A = [() => 1, () => 2];\nexport function run(i: number) { return A[i](); }',
      3,
    ],
    [
      'a call through a template key with a substitution',
      'export function run(o: any, k: string) { return o[`go${k}`](); }',
      2,
    ],
    [
      'a call through a computed member',
      'export function run(o: any, k: string) { return o[k](); }',
      2,
    ],
    ['a call through this', 'export class A { run(k: string) { return (this as any)[k](); } }', 2],
  ])('%s counts', (_, code, expected) => {
    expect(last(code)).toBe(expected);
  });

  it.each([
    [
      'a table of values',
      "const CODES = { US: 'USD', GB: 'GBP', JP: 'JPY' };\nexport function code(r: string) { return CODES[r]; }",
    ],
    [
      'a Map of values through get',
      "const M = new Map([['a', 1], ['b', 2]]);\nexport function get(k: string) { return M.get(k); }",
    ],
    [
      'a dispatch with a static key',
      `${DISPATCH}\nexport function run() { return RULES.get('a')!(); }`,
    ],
    ['a static index', "const O = { a: () => 1 };\nexport function run() { return O['a'](); }"],
    ['a static computed call', 'export function run(o: any) { return o[`go`](); }'],
    [
      'a Set that isn’t static',
      "let S = new Set(['a', 'b']);\nexport function is(x: string) { return S.has(x); }",
    ],
    [
      '.has on an array',
      "const A = ['a', 'b'];\nexport function is(x: string) { return (A as any).has(x); }",
    ],
    [
      '.includes on a Set',
      "const S = new Set(['a', 'b']);\nexport function is(x: string) { return (S as any).includes(x); }",
    ],
    [
      'in on a Set',
      "const S = new Set(['a', 'b']);\nexport function is(x: string) { return x in S; }",
    ],
    [
      'an index into a dispatch Map',
      "const M = new Map([['a', () => 1], ['b', () => 2]]);\nexport function run(k: string) { return (M as any)[k]; }",
    ],
    [
      'a table read through another object',
      "const S = new Set(['a', 'b']);\nexport function is(o: any, x: string) { return o.S.has(x); }",
    ],
    [
      'a method a table doesn’t have',
      "const A = ['a', 'b'];\nexport function at(i: number) { return A.at(i); }",
    ],
  ])('%s adds nothing', (_, code) => {
    expect(last(code)).toBe(1);
  });

  it('counts a dispatch read once, not again for calling it', () => {
    const code =
      'const O = { a: () => 1, b: () => 2, c: () => 3 };\nexport function run(k: string) { return O[k]?.(); }';
    // 3 for the read, 1 for the `?.`, and nothing for the call.
    expect(last(code)).toBe(1 + 3 + 1);
  });

  it('counts a table a relative import names, as its own module would', () => {
    function imported(from: string): Exports | undefined {
      if (from !== './types.ts') return undefined;
      return {
        tables: new Map([['KINDS', { kind: 'set', entries: 4, dispatch: false }]]),
        functions: new Set(),
      };
    }
    const code =
      "import { KINDS as K } from './types.ts';\nexport function is(x: string) { return K.has(x); }";
    expect(complexities(code, COUNT_ALL, imported)).toEqual({ is: 4 });
    expect(complexities(code)).toEqual({ is: 1 });
    expect(complexities(code, COUNT_ALL, () => undefined)).toEqual({ is: 1 });
  });

  it('counts a table of functions another module exports as a dispatch table', () => {
    function imported(from: string): Exports | undefined {
      return from === './handlers.ts'
        ? { tables: new Map(), functions: new Set(['one', 'two', 'three']) }
        : undefined;
    }
    const code =
      "import { one, two, three as third, value } from './handlers.ts';\nconst T = { a: one, b: two, c: third, d: value };\nexport function run(k: string) { const handle = T[k]; return handle(); }";
    expect(last(code, COUNT_ALL, imported)).toBe(1 + 4);
    expect(last(code)).toBe(1);
  });

  it('counts a read through a cast on the table', () => {
    const code =
      'const O = { a: () => 1, b: () => 2, c: () => 3 };\nexport function run(k: string) { const h = (O as Record<string, () => number>)[k]; return h(); }';
    expect(last(code)).toBe(1 + 3);
  });

  it('follows switchCases and logicalOperators, and lookupTables turns it off', () => {
    const code = `${DISPATCH}\nconst S = new Set(['a', 'b', 'c']);\nexport function run(k: string) { return S.has(k) && RULES.get(k)!(); }`;
    // 1, the `&&`, 2 for membership of 3, and 3 for the dispatch.
    expect(last(code)).toBe(1 + 1 + 2 + 3);
    expect(last(code, { ...COUNT_ALL, switchCases: 'once', logicalOperators: 'sequence' })).toBe(
      1 + 1 + 1 + 1,
    );
    expect(last(code, { ...COUNT_ALL, lookupTables: false })).toBe(1 + 1);
    expect(last(code, COUNT_SEPARATELY)).toBe(1 + 1);
  });
});
