import { describe, expect, it } from 'vitest';
import { COUNT_SEPARATELY } from './complexity.ts';
import { moduleExports, ParseError, parse, positions } from './functions.ts';

/** Counting as before #74, for the tests that pin it. */
const SEPARATELY = COUNT_SEPARATELY;

/** The names of the functions in `code`, each scored on its own so nested ones are listed too. */
function names(code: string, file = 'example.tsx') {
  return parse(file, code, SEPARATELY).functions.map((fn) => fn.name);
}

describe('parse', () => {
  it.each([
    ['a function declaration', 'function grade() {}', 'grade'],
    ['a named function expression', 'const x = function grade() {};', 'grade'],
    ['an arrow assigned to a variable', 'const grade = () => 1;', 'grade'],
    ['an object method', 'const o = { grade() { return 1; } };', 'grade'],
    ['an object property', 'const o = { grade: () => 1 };', 'grade'],
    ['a class method', 'class A { grade() { return 1; } }', 'grade'],
    ['a class property', 'class A { grade = () => 1; }', 'grade'],
    ['an assignment', 'exports.grade = () => 1;', 'exports.grade'],
    [
      'a callback, by the call it is passed to',
      'items.forEach((n) => n);',
      'items.forEach callback',
    ],
    ['a default export', 'export default () => 1;', 'default export'],
    [
      'a callback passed to a constructor, by the class',
      'new Promise((resolve) => resolve(1));',
      'Promise callback',
    ],
    ['a JSX handler, by its attribute', 'const v = <button onClick={() => 1} />;', 'onClick'],
    ['a function written as a JSX child', 'const v = <div>{() => 1}</div>;', '(anonymous)'],
    ['a function written as a fragment’s child', 'const v = <>{() => 1}</>;', '(anonymous)'],
    ['a JSX handler, by its namespaced attribute', 'const v = <a b:c={() => 1} />;', 'b:c'],
    ['a name of 40 characters, in full', `const ${'a'.repeat(40)} = () => 1;`, 'a'.repeat(40)],
    ['a name longer than 40 characters', `const ${'a'.repeat(41)} = () => 1;`, '(anonymous)'],
    ['a callback whose call spans lines', 'items\n  .forEach((n) => n);', '(anonymous)'],
    ['an IIFE', 'const v = (function () { return 1; })();', '(anonymous)'],
    ['an IIFE without brackets', 'const v = function () { return 1; }();', '(anonymous)'],
    [
      'a function constructed with `new` where it is written',
      'const v = new function () {}();',
      '(anonymous)',
    ],
    ['anything else', '[() => 1];', '(anonymous)'],
  ])('labels %s', (_, code, name) => {
    expect(names(code)).toEqual([name]);
  });

  it('labels a function inside others by the functions around it', () => {
    expect(names('function RoomView() { function change() { [1].map((n) => n); } }')).toEqual([
      'RoomView',
      'RoomView > change',
      'RoomView > change > [1].map callback',
    ]);
  });

  it('gives each function’s first and last line, with columns in UTF-16 units', () => {
    const [fn] = parse(
      'example.ts',
      "const s = '€€€';\nfunction f() {\n  return 1;\n}\n",
    ).functions;
    expect(fn.start).toEqual({ line: 2, column: 0 });
    expect(fn.end).toEqual({ line: 4, column: 1 });
  });

  it('returns real comments only, not text in strings that looks like one', () => {
    const { comments } = parse(
      'example.ts',
      '// one\nconst s = `\n// not a comment\n`; /* two */\n',
    );
    expect(comments.map((c) => [c.type, c.value])).toEqual([
      ['Line', ' one'],
      ['Block', ' two '],
    ]);
  });

  it('says which functions are passed straight to a call or a constructor', () => {
    const code = [
      'items.forEach((n) => n);',
      'new Promise((resolve) => resolve(1));',
      'const x = function () { return 1; }();',
      'const f = () => 1;',
    ].join('\n');
    const [forEach, promise, called, f] = parse('example.ts', code).functions;
    expect([forEach, promise, f].map((fn) => [fn.name, fn.passedToCall])).toEqual([
      ['items.forEach callback', true],
      ['Promise callback', true],
      ['f', false],
    ]);
    // A function that is itself called isn't passed to the call, so isn't named after it.
    expect([called.name, called.passedToCall]).toEqual(['(anonymous)', false]);
  });

  it('lists every simple statement, outermost first, and no block, loop or if', () => {
    const code = [
      'const a = 1;',
      'if (a) {',
      '  for (const b of [a]) run(() => {',
      '    return b;',
      '  });',
      '}',
      'export default a;',
    ].join('\n');
    const { statements } = parse('example.ts', code);
    expect(statements.map(({ start, end }) => code.slice(start, end))).toEqual([
      'const a = 1;',
      'const b',
      'run(() => {\n    return b;\n  });',
      'return b;',
      'export default a;',
    ]);
  });

  it('throws a ParseError naming the file when the code doesn’t parse', () => {
    expect(() => parse('broken.ts', 'function (')).toThrow(ParseError);
    expect(() => parse('broken.ts', 'function (')).toThrow("Couldn't parse broken.ts");
  });
});

describe('positions', () => {
  it('turns an offset into a 1-based line and 0-based column', () => {
    const at = positions('ab\ncd\n');
    expect([at(0), at(1), at(3), at(4), at(6)]).toEqual([
      { line: 1, column: 0 },
      { line: 1, column: 1 },
      { line: 2, column: 0 },
      { line: 2, column: 1 },
      { line: 3, column: 0 },
    ]);
  });
});

describe('moduleExports', () => {
  it('gives the lookup tables and functions a module exports', () => {
    const exports = moduleExports(
      'rates.ts',
      "export const RATES = new Set(['a', 'b']);\nexport function grade() {}\n",
    );
    expect([...exports.tables.keys()]).toEqual(['RATES']);
    expect([...exports.functions]).toEqual(['grade']);
  });

  it('gives nothing for a module that doesn’t parse, even what it exports before the error', () => {
    expect(
      moduleExports(
        'rates.ts',
        "export const RATES = new Set(['a', 'b']);\nexport function grade() {}\nconst broken;\n",
      ),
    ).toEqual({ tables: new Map(), functions: new Set() });
  });
});
