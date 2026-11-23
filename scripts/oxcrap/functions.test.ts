import { describe, expect, it } from 'vitest';
import { COUNT_SEPARATELY } from './complexity.ts';
import { ParseError, parse, positions } from './functions.ts';

/** Counting as before #74, for the tests that pin it. */
const SEPARATELY = COUNT_SEPARATELY;

/** The names of the functions in `code`, each scored on its own so nested ones are listed too. */
const names = (code: string, file = 'example.tsx') =>
  parse(file, code, SEPARATELY).functions.map((fn) => fn.name);

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
    ['a JSX handler, by its attribute', 'const v = <button onClick={() => 1} />;', 'onClick'],
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
