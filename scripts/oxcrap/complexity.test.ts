import { describe, expect, it } from 'vitest';
import { parse } from './functions.ts';

/** The complexity of the first function in `code`. */
const complexityOf = (code: string, file = 'example.ts') =>
  parse(file, code).functions[0].complexity;

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

  it('adds nothing for else, finally, optional chaining or a default parameter value', () => {
    expect(
      complexityOf(
        'function f(a = 1) { try { if (a) x(); else y(); } finally { z(); } return a?.b; }',
      ),
    ).toBe(2);
  });

  it('counts branches in parameters, such as a default value that is a conditional', () => {
    expect(complexityOf('function f(a = b ? 1 : 2) { return a; }')).toBe(2);
  });

  it('leaves out the branches of a nested function, which is counted on its own', () => {
    const { functions } = parse(
      'example.ts',
      'function outer(a) { if (a) x(); return [1].map((n) => (n ? 1 : 2)); }',
    );
    expect(functions.map((fn) => [fn.name, fn.complexity])).toEqual([
      ['outer', 2],
      ['outer > [1].map callback', 2],
    ]);
  });

  it('counts a JSX condition, such as `open && <Modal />`, as a branch', () => {
    expect(
      complexityOf('function View({ open }) { return <div>{open && <span />}</div>; }', 'view.tsx'),
    ).toBe(2);
  });
});
