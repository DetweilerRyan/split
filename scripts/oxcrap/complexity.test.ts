import { describe, expect, it } from 'vitest';
import { COUNT_ALL, COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';

/** Counting as before #74, for the tests that pin it. */
const SEPARATELY = COUNT_SEPARATELY;

/** The complexity of the first function in `code`, counted as `counting` says: everything by default. */
const complexityOf = (code: string, counting?: Counting, file = 'example.ts') =>
  parse(file, code, counting).functions[0].complexity;

describe('complexity', () => {
  it('is 1 for a function with no branches', () => {
    expect(complexityOf('function f() { return 1; }')).toBe(1);
  });

  it.each([
    ['an if', 'if (a) x();'],
    ['an else if, as its own if', 'if (a) x(); else if (b) y();'],
    ['a conditional expression', 'return a ? 1 : 2;'],
    ['a for loop', 'for (let i = 0; i < a; i++) x();'],
    ['a for…in loop', 'for (const k in a) x();'],
    ['a for…of loop', 'for (const v of a) x();'],
    ['a while loop', 'while (a) x();'],
    ['a do…while loop', 'do x(); while (a);'],
    ['a catch', 'try { x(); } catch { y(); }'],
    ['&&', 'return a && b;'],
    ['||', 'return a || b;'],
    ['??', 'return a ?? b;'],
    ['&&=', 'a &&= b;'],
    ['||=', 'a ||= b;'],
    ['??=', 'a ??= b;'],
  ])('adds 1 for %s', (_, body) => {
    const extra = body.includes('else if') ? 2 : 1;
    expect(complexityOf(`function f(a, b) { ${body} }`)).toBe(1 + extra);
  });

  it('adds 1 for each case but not for default', () => {
    expect(
      complexityOf(
        'function f(a) { switch (a) { case 1: return 1; case 2: return 2; default: return 0; } }',
      ),
    ).toBe(3);
  });

  it('adds nothing for else or finally, nor for ?. and default values when those counts are off', () => {
    expect(
      complexityOf(
        'function f(a = 1) { try { if (a) x(); else y(); } finally { z(); } return a?.b; }',
        SEPARATELY,
      ),
    ).toBe(2);
  });

  it('counts each default value and each ?. by default', () => {
    expect(
      complexityOf(
        'function f(a = 1) { try { if (a) x(); else y(); } finally { z(); } return a?.b; }',
      ),
    ).toBe(4);
  });

  it.each([
    ['a parameter', 'function f(a = 1) {}', 2],
    ['destructuring in a parameter', 'function f({ a = 1, b = 2 }) {}', 3],
    ['destructuring in the body', 'function f(o) { const [a = 1] = o; }', 2],
    ['each link of a chain', 'function f(o) { return o?.a?.b; }', 3],
    ['an optional call', 'function f(o) { return o.g?.(); }', 2],
  ])('counts a default value or ?. in %s', (_, code, expected) => {
    expect(complexityOf(code)).toBe(expected);
  });

  it('counts each non-default case by default, and a whole switch once with switchCases "once"', () => {
    const code =
      'function f(n) { switch (n) { case 1: return 1; case 2: return 2; default: return 0; } }';
    expect(complexityOf(code)).toBe(3);
    expect(complexityOf(code, { ...COUNT_ALL, switchCases: 'once' })).toBe(2);
  });

  it('counts each logical operator by default, and each run of the same one with logicalOperators "sequence"', () => {
    const code = 'function f(a, b, c, d) { return (a && b && c) || d; }';
    expect(complexityOf(code)).toBe(4);
    expect(complexityOf(code, { ...COUNT_ALL, logicalOperators: 'sequence' })).toBe(3);
    expect(
      complexityOf('function f(a, b, c) { return a ?? b ?? c; }', {
        ...COUNT_ALL,
        logicalOperators: 'sequence',
      }),
    ).toBe(2);
  });

  it('counts each break or continue to a label, unless labelledJumps is off', () => {
    const code =
      'function f(xs) { outer: for (const x of xs) { for (const y of x) { if (y) continue outer; break outer; } } }';
    expect(complexityOf(code)).toBe(6);
    expect(complexityOf(code, { ...COUNT_ALL, labelledJumps: false })).toBe(4);
    expect(complexityOf('function f(xs) { for (const x of xs) { break; } }')).toBe(2);
  });

  it('doesn’t count a TypeScript optional parameter as ?.', () => {
    expect(complexityOf('function f(a?: number) { return a; }')).toBe(1);
  });

  it('counts branches in parameters, such as a default value that is a conditional', () => {
    expect(complexityOf('function f(a = b ? 1 : 2) { return a; }', SEPARATELY)).toBe(2);
  });

  it('leaves out the branches of a nested function when each is scored on its own', () => {
    const { functions } = parse(
      'example.ts',
      'function outer(a) { if (a) x(); return [1].map((n) => (n ? 1 : 2)); }',
      SEPARATELY,
    );
    expect(functions.map((fn) => [fn.name, fn.complexity])).toEqual([
      ['outer', 2],
      ['outer > [1].map callback', 2],
    ]);
  });

  it('counts a nested function’s branches towards the outermost function by default', () => {
    const { functions, nested } = parse(
      'example.ts',
      'function outer(a) { if (a) x(); const f = () => [1].map((n) => (n ? 1 : 2)); }',
    );
    expect(functions.map((fn) => [fn.name, fn.complexity])).toEqual([['outer', 3]]);
    expect(nested.map((fn) => fn.name)).toEqual(['outer > f', 'outer > f > [1].map callback']);
  });

  it('counts a JSX condition, such as `open && <Modal />`, as a branch', () => {
    expect(
      complexityOf(
        'function View({ open }) { return <div>{open && <span />}</div>; }',
        undefined,
        'view.tsx',
      ),
    ).toBe(2);
  });
});

describe('recursion', () => {
  const complexities = (code: string, counting?: Counting) =>
    Object.fromEntries(
      parse('example.ts', code, counting).functions.map((fn) => [fn.name, fn.complexity]),
    );

  it('adds 1 to a function that calls itself, however many times', () => {
    expect(complexities('function f(n) { return n ? f(n - 1) + f(n - 2) : 0; }')).toEqual({ f: 3 });
  });

  it('adds 1 to each function in a cycle of calls, and not to one that only calls into it', () => {
    const code =
      'function isEven(n) { return n === 0 || isOdd(n - 1); }\nfunction isOdd(n) { return n !== 0 && isEven(n - 1); }\nfunction check(n) { return isEven(n); }';
    expect(complexities(code)).toEqual({ isEven: 3, isOdd: 3, check: 1 });
  });

  it('follows a method calling itself through this', () => {
    expect(complexities('class Tree { size(n) { return n ? this.size(n.next) : 0; } }')).toEqual({
      size: 3,
    });
  });

  it('counts a nested function calling the outer one towards the outer one by default', () => {
    const code = 'function walk(node) { node.children.forEach((child) => walk(child)); }';
    expect(complexities(code)).toEqual({ walk: 2 });
    expect(complexities(code, COUNT_SEPARATELY)).toEqual({
      walk: 1,
      'walk > node.children.forEach callback': 1,
    });
  });

  it('adds nothing with recursion off', () => {
    expect(
      complexities('function f(n) { return n ? f(n - 1) : 0; }', {
        ...COUNT_ALL,
        recursion: false,
      }),
    ).toEqual({ f: 2 });
  });
});
