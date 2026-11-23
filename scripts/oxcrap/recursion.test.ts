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
