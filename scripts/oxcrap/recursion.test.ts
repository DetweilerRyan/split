import { describe, expect, it } from 'vitest';
import { COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';

/** Each scored function's complexity, so 1 more than its branches means it's recursive. */
const complexities = (code: string, counting?: Counting) =>
  Object.fromEntries(
    parse('example.ts', code, counting).functions.map((fn) => [fn.name, fn.complexity]),
  );

describe('recursion', () => {
  it.each([
    ['a function calling itself', 'function f(n) { return f(n - 1); }', { f: 2 }],
    ['an arrow assigned to a const', 'const f = (n) => f(n - 1);', { f: 2 }],
    ['a named function expression', 'const g = function f(n) { return f(n - 1); };', { f: 2 }],
    ['a method through this', 'class A { m(n) { return this.m(n - 1); } }', { m: 2 }],
    ['a class field arrow through this', 'class A { m = (n) => this.m(n - 1); }', { m: 2 }],
    [
      'two functions calling each other',
      'function a(n) { return b(n); }\nfunction b(n) { return a(n); }',
      { a: 2, b: 2 },
    ],
    [
      'a callback calling the function it’s written in',
      'function walk(n) { n.kids.forEach((k) => walk(k)); }',
      { walk: 2 },
    ],
  ])('counts %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    [
      'a bare call that matches a method’s name',
      'class A { m() { return 1; } }\nfunction x() { return m(); }',
      { m: 1, x: 1 },
    ],
    [
      'this calling a module-level function',
      'function x() {}\nclass A { y() { return this.x(); } }',
      { x: 1, y: 1 },
    ],
    [
      'an object method calling a free name',
      'const o = { load() { return load(); } };',
      { load: 1 },
    ],
    ['a parameter of the same name', 'function f(f) { return f(); }', { f: 1 }],
    ['a local of the same name', 'function f() { const f = () => 1; return f(); }', { f: 1 }],
    ['a nested helper of its own', 'function f() { const g = () => 1; return g(); }', { f: 1 }],
    [
      'another object’s method of the same name',
      'class T { size() { return other.size(); } }',
      { size: 1 },
    ],
    [
      'this inside a nested function, which has its own this',
      'class A { m() { return function () { return this.m(); }; } }',
      { m: 1 },
    ],
    [
      'a call that only leads into a cycle',
      'function a() { return a(); }\nfunction c() { return a(); }',
      { a: 2, c: 1 },
    ],
  ])('doesn’t count %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  // Each expected complexity is 1 more than the code's branches when the call is recursion.
  it.each([
    ['a var arrow', 'var f = (n) => f(n - 1);', { f: 2 }],
    ['a parenthesized arrow', 'const f = ((n) => f(n - 1));', { '(anonymous)': 2 }],
    [
      'a class field’s parenthesized arrow',
      'class A { m = ((n) => this.m(n - 1)); }',
      {
        '(anonymous)': 2,
      },
    ],
    ['an exported function', 'export function f() { return f(); }', { f: 2 }],
    ['a default-exported function', 'export default function f() { return f(); }', { f: 2 }],
    ['an exported arrow', 'export const f = () => f();', { f: 2 }],
    ['a call past a block’s const', 'function f() { { const f = 1; } return f(); }', { f: 2 }],
    [
      'a call past a nested function’s var',
      'function f() { function g() { var f = 1; } return f(); }',
      { f: 2 },
    ],
    [
      'a call in a class the function returns, past a parameter of another name',
      'function f() { return class { constructor(private g) { f(); } }; }',
      { f: 2 },
    ],
    [
      'this past a static block’s const of the same name',
      'class A { static { const m = () => 1; } m() { return this.m(); } }',
      { m: 2 },
    ],
  ])('counts %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    ['a rest parameter', 'function f(...f) { return f(); }', { f: 1 }],
    ['an array pattern’s element', 'function f([, f]) { return f(); }', { f: 1 }],
    ['an object pattern’s value', 'function f({ a: f }) { return f(); }', { f: 1 }],
    ['an object pattern’s rest', 'function f({ ...f }) { return f(); }', { f: 1 }],
    ['a let destructuring', 'function f() { let [f] = []; return f(); }', { f: 1 }],
    [
      'a TypeScript parameter property',
      'function f() { return class { constructor(private f) { f(); } }; }',
      { f: 1 },
    ],
    ['a var hoisted out of a block', 'function f() { { var f = 1; } return f(); }', { f: 1 }],
    ['a for-of loop’s var', 'function f(xs) { for (var f of xs); return f(); }', { f: 2 }],
    ['a for-of loop’s const', 'function f(xs) { for (const f of xs) f(); }', { f: 2 }],
    [
      'a const in a switch case',
      'function f(x) { switch (x) { case 1: const f = 1; return f(); } }',
      { f: 2 },
    ],
    ['a catch parameter', 'function f() { try {} catch (f) { f(); } }', { f: 2 }],
    [
      'a destructured catch parameter',
      'function f() { try {} catch ({ f }) { f(); } }',
      {
        f: 2,
      },
    ],
    ['a class declared in a block', 'function f() { { class f {} return f(); } }', { f: 1 }],
  ])('doesn’t count a call to a name hidden by %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    ['a call outside any function', 'f();\nfunction f() { return 1; }', { f: 1 }],
    ['a call to an import', "import { a } from 'x';\nfunction f() { return a(); }", { f: 1 }],
    ['this calling a computed method', "class A { ['m']() { return this.m(); } }", { "'m'": 1 }],
  ])('doesn’t count %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it('counts a callback calling back only when nested functions count towards the outer one', () => {
    const code = 'function walk(n) { n.kids.forEach((k) => walk(k)); }';
    expect(complexities(code, { ...COUNT_SEPARATELY, recursion: true })).toEqual({
      walk: 1,
      'walk > n.kids.forEach callback': 1,
    });
  });

  it('finds cycles in a large file quickly', () => {
    const code = Array.from(
      { length: 2000 },
      (_, i) => `function f${i}() { return f${(i + 1) % 2000}(); }`,
    ).join('\n');
    const started = performance.now();
    const scored = complexities(code);
    expect(Object.values(scored).every((c) => c === 2)).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
