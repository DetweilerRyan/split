import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { type AstNode, COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';
import { recursive, shadowedUses } from './recursion.ts';

/** Each scored function's complexity, so 1 more than its branches means it's recursive. */
function complexities(code: string, counting?: Counting) {
  return Object.fromEntries(
    parse('example.ts', code, counting).functions.map((fn) => [fn.name, fn.complexity]),
  );
}

describe('recursion', () => {
  it.each([
    ['a function calling itself', 'function f(n) { return f(n - 1); }', { f: 2 }],
    ['an arrow assigned to a const', 'const f = (n) => f(n - 1);', { f: 2 }],
    ['a named function expression', 'const g = function f(n) { return f(n - 1); };', { f: 2 }],
    ['a method through this', 'class A { m(n) { return this.m(n - 1); } }', { m: 2 }],
    ['a class field arrow through this', 'class A { m = (n) => this.m(n - 1); }', { m: 2 }],
    [
      'an arrow in a method, keeping its this',
      'class A { m(xs) { return xs.map(() => this.m([])); } }',
      { m: 2 },
    ],
    [
      'a class field function expression through this',
      'class A { m = function (n) { return this.m(n - 1); }; }',
      { m: 2 },
    ],
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
    // 1, and 1 for the default value.
    ['a parameter with a default value', 'function f(f = 1) { return f(); }', { f: 2 }],
    ['a for loop’s let', 'function f() { for (let f = 0; ; ) f(); }', { f: 2 }],
    ['a for-in loop’s const', 'function f(o) { for (const f in o) f(); }', { f: 2 }],
    ['a name destructured from a function', 'const { f } = () => f();', { '{ f }': 1 }],
  ])('doesn’t count a call to a name hidden by %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    ['a call outside any function', 'f();\nfunction f() { return 1; }', { f: 1 }],
    ['a call to an import', "import { a } from 'x';\nfunction f() { return a(); }", { f: 1 }],
    ['this calling a computed method', "class A { ['m']() { return this.m(); } }", { "'m'": 1 }],
    [
      'this calling the name a computed method’s key holds',
      "const m = 'x';\nclass A { [m]() { return this.m(); } }",
      { m: 1 },
    ],
    // 1, and 1 for the call through a computed member.
    ['this calling through a computed member', 'class A { m() { return this[m](); } }', { m: 2 }],
    [
      'this calling a public method from a private one of the same name',
      'class A { m() { return 1; } #m() { return this.m(); } }',
      { m: 1, '#m': 1 },
    ],
    [
      'a function a call outside any function reaches',
      'f();\nfunction f() { return go(); }',
      { f: 1 },
    ],
  ])('doesn’t count %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    // 1, the loop, and 1 for the recursion.
    ['a call in a loop with an empty head', 'function f() { for (;;) return f(); }', { f: 3 }],
    [
      'a call in loops whose heads assign names declared before them',
      'function f(xs) { let x, i; for (x of xs) f(); for (i = 0; ; ) f(); }',
      { f: 4 },
    ],
    [
      'a method of a class with a plain field',
      'class A { n = 1; m() { return this.m(); } }',
      { m: 2 },
    ],
  ])('counts %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  // #87: the scope rules a call is resolved by.
  it.each([
    ['a call through new', 'function f() { return new f(); }', { f: 2 }],
    ['a private method through this', 'class A { #m(n) { return this.#m(n - 1); } }', { '#m': 2 }],
    // A literal key has no name, so it isn't filed under one.
    [
      'a method named undefined beside one with a literal key',
      "class A { undefined() { return this.undefined(); } 'x'() {} }",
      { undefined: 2, "'x'": 1 },
    ],
    [
      'a method past a static field of the same name',
      'class A { m() { return this.m(); } static m = 1; }',
      { m: 2 },
    ],
    [
      'a call past a static block’s var',
      'function m() { class A { static { var m = 1; } } return m(); }',
      { m: 2 },
    ],
    // 1, the default value, and the recursion.
    ['a default value past the body’s const', 'function f(n = f()) { const f = 1; }', { f: 3 }],
    [
      'a pattern’s default value past the body’s const',
      'function f({ n = f() }) { const f = 1; }',
      { f: 3 },
    ],
    [
      'a default value past the body’s var and function',
      'function f(n = f()) { var f; function f() {} }',
      { f: 3 },
    ],
    // 1, and the recursion.
    ['a computed key past the body’s const', 'function f({ [f()]: n }) { const f = 1; }', { f: 2 }],
  ])('counts %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it.each([
    [
      'a call hidden by a static block’s const',
      'function m() { class A { static { const m = () => 1; m(); } } }',
      { m: 1 },
    ],
    [
      'a call hidden by a static block’s var',
      'function m() { class A { static { var m = () => 1; m(); } } }',
      { m: 1 },
    ],
    // 1, and the default value.
    [
      'a body’s call hidden by its const, in a function with a default value',
      'function f(n = 0) { const f = () => n; return f(); }',
      { f: 2 },
    ],
    ['a default value calling a parameter', 'function f(f, n = f()) {}', { f: 2 }],
    [
      'this calling a public name from a private method',
      'class A { #m() { return this.m(); } }',
      { '#m': 1 },
    ],
    [
      'this calling a private field from a public method of the same name',
      'class A { #m = 0; m() { return this.#m(); } }',
      { m: 1 },
    ],
    [
      'a method hidden by a later field of the same name',
      'class A { m() { return this.m(); } m = 1; }',
      { m: 1 },
    ],
    [
      'a method hidden by an earlier field of the same name',
      'class A { m = 1; m() { return this.m(); } }',
      { m: 1 },
    ],
  ])('doesn’t count %s', (_, code, expected) => {
    expect(complexities(code)).toEqual(expected);
  });

  it('resolves this to a field’s function, not the method of the same name it hides', () => {
    const code = 'class A { m() { return 1; } m = () => this.m(); }';
    const scored = parse('example.ts', code).functions.map((fn) => [fn.name, fn.complexity]);
    expect(scored).toEqual([
      ['m', 1],
      ['m', 2],
    ]);
  });

  it('resolves a var that declares a catch parameter again to the parameter, in its block', () => {
    // With nested functions scored apart, g calls the arrow, and the arrow calls g.
    const code = 'function g() { try {} catch (f) { var f = () => g(); f(); } }';
    // g: 1, the catch, and the recursion.
    expect(complexities(code, { ...COUNT_SEPARATELY, recursion: true })).toEqual({
      g: 3,
      'g > f': 2,
    });
  });

  // A `var` is one binding in its function, so a call reaches the last function any `var` of its
  // name gives it, not the last one in the block the call is in. Here `g` is still undefined when
  // it's called, so nothing recurses.
  it.each([
    ['a block', 'function f() { { g(); var g = () => f(); } var g = 1; }', { f: 1, 'f > g': 1 }],
    [
      'a catch block that doesn’t declare its parameter again',
      'function f() { try {} catch (e) { g(); var g = () => f(); } var g = 1; }',
      // 1, and the catch.
      { f: 2, 'f > g': 1 },
    ],
  ])('resolves a var in %s to the function’s last value for it', (_, code, expected) => {
    expect(complexities(code, { ...COUNT_SEPARATELY, recursion: true })).toEqual(expected);
  });

  it('resolves a function’s own name to the last declaration of it, as JavaScript does', () => {
    const code = 'function g() { function f() { return f(); } function f() { return 1; } }';
    const counting = { ...COUNT_SEPARATELY, recursion: true };
    const scored = parse('example.ts', code, counting).functions.map((fn) => fn.complexity);
    expect(scored).toEqual([1, 1, 1]);
  });

  it('reaches no function through a call it can’t resolve, however functions are grouped', () => {
    function program(code: string) {
      return parseSync('example.ts', code).program as unknown as AstNode;
    }
    function all() {
      return 'all';
    }
    expect(recursive(program('function a() { other.x(); go(); }'), all, all)).toEqual(new Set());
    expect(recursive(program('function a() { a(); }'), all, all)).toEqual(new Set(['all']));
  });

  it('lists only the uses of the names it’s given that a binding hides', () => {
    const code = 'const S = 1;\nclass A { #S = 1; m(S, T) { return this.#S + S + T; } }';
    const program = parseSync('example.ts', code).program as unknown as AstNode;
    const uses = [...shadowedUses(program, new Set(['S']))].map((use) => [use.type, use.start]);
    expect(uses).toEqual([
      ['Identifier', code.indexOf('S, T')],
      ['Identifier', code.indexOf('S + T')],
    ]);
  });

  it.each(['const', 'var'])('doesn’t list a use in a default value past the body’s %s', (kind) => {
    const code = `const S = 1;\nfunction g(x = S) { ${kind} S = 2; return x + S; }`;
    const program = parseSync('example.ts', code).program as unknown as AstNode;
    const uses = [...shadowedUses(program, new Set(['S']))].map((use) => use.start);
    expect(uses).toEqual([code.indexOf('S = 2'), code.indexOf('S; }')]);
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
