import { describe, expect, it } from 'vitest';
import { findAllows } from './allow.ts';
import { COUNT_ALL, COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';

/** Counting as before #74, for the tests that pin it. */
const SEPARATELY = COUNT_SEPARATELY;

/** What findAllows makes of `code`: each allowed function's name and comment, and the problems. */
function allows(code: string, counting: Counting = SEPARATELY, file = 'example.tsx') {
  const result = findAllows(file, code, parse(file, code, counting));
  return {
    allowed: [...result.allowed].map(([fn, allow]) => ({ name: fn.name, ...allow })),
    problems: result.problems.map((p) => `${p.line}: ${p.message}`),
  };
}

const allow = '// @crap-allow CRAP 156, complexity 12. One branch per row of the rate table.';

describe('findAllows', () => {
  it('matches a comment to the function below it, with its numbers and reason', () => {
    expect(allows(`${allow}\nfunction grade(n) {}\n`)).toEqual({
      allowed: [
        {
          name: 'grade',
          file: 'example.tsx',
          line: 1,
          lastLine: 1,
          crap: 156,
          complexity: 12,
          reason: 'One branch per row of the rate table.',
        },
      ],
      problems: [],
    });
  });

  it('reads a block comment’s reason across its lines', () => {
    const block =
      '/* @crap-allow CRAP 156, complexity 12. One branch per row of\n   the rate table. */';
    expect(allows(`${block}\nfunction grade(n) {}\n`).allowed[0]).toMatchObject({
      reason: 'One branch per row of the rate table.',
      lastLine: 2,
    });
  });

  it('applies across a lint directive and a doc comment, keeping the directive out of the reason', () => {
    const code = `${allow}\n// oxlint-disable-next-line eslint/no-unused-vars\n/** Grades. */\nfunction grade(n) {}\n`;
    expect(allows(code).allowed[0]).toMatchObject({
      name: 'grade',
      reason: 'One branch per row of the rate table.',
    });
  });

  it('applies to an arrow function and to a callback passed on the next line of code', () => {
    const code = `${allow}\nconst grade = (n) => n;\nfunction A() {\n  ${allow}\n  useEffect(() => {});\n}\n`;
    expect(allows(code).allowed.map((a) => a.name)).toEqual(['grade', 'A > useEffect callback']);
  });

  it('fails a comment above a nested function when it counts towards the one around it', () => {
    const code = `function A() {\n  ${allow}\n  useEffect(() => {});\n}\n`;
    expect(allows(code, COUNT_ALL).problems).toEqual([
      '2: This @crap-allow comment is above A > useEffect callback, which is inside A and counts towards it. Move the comment above A, with its numbers.',
    ]);
  });

  it('fails a comment above a wrapped call whose callback counts towards the function around it', () => {
    const code = `function A() {\n  ${allow}\n  useEffect(\n    () => {},\n  );\n}\n`;
    expect(allows(code, COUNT_ALL).problems).toEqual([
      '2: This @crap-allow comment is above A > useEffect callback, which is inside A and counts towards it. Move the comment above A, with its numbers.',
    ]);
  });

  it('reads a JSX comment above a handler', () => {
    const code = `const v = (\n  <div>\n    {/* @crap-allow CRAP 156, complexity 12. A reason. */}\n    <button onClick={() => 1} />\n  </div>\n);\n`;
    expect(allows(code).allowed.map((a) => a.name)).toEqual(['onClick']);
  });

  it('reads a JSX comment above a handler across another JSX comment', () => {
    const code = `const v = (\n  <div>\n    {/* @crap-allow CRAP 156, complexity 12. A reason. */}\n    {/* Another comment. */}\n    <button onClick={() => 1} />\n  </div>\n);\n`;
    expect(allows(code)).toMatchObject({ allowed: [{ name: 'onClick' }], problems: [] });
  });

  it('ignores comments that only mention @crap-allow, and text in strings', () => {
    const code = `// See docs/engineering/crap.md for @crap-allow comments.\n/** A @crap-allow comment gives a reason. */\nconst s = \`\n// @crap-allow CRAP 1, complexity 1. Not a comment.\n\`;\nfunction grade(n) {}\n`;
    expect(allows(code)).toEqual({ allowed: [], problems: [] });
  });

  it('fails a comment in the wrong form', () => {
    expect(
      allows('// @crap-allow CRAP=156 complexity=12 because\nfunction grade(n) {}\n').problems,
    ).toEqual([
      '1: This @crap-allow comment isn’t in the form `// @crap-allow CRAP <score>, complexity <n>. <reason>`.',
    ]);
  });

  it('fails a comment with no reason, but still matches it to its function', () => {
    const result = allows('// @crap-allow CRAP 156, complexity 12.\nfunction grade(n) {}\n');
    expect(result.problems).toEqual(['1: The @crap-allow comment for grade gives no reason.']);
    expect(result.allowed.map((a) => a.name)).toEqual(['grade']);
  });

  it('fails a comment with no function below it', () => {
    expect(allows(`${allow}\nexport const grade = 1;\n`).problems).toEqual([
      '1: This @crap-allow comment isn’t directly above a function. Move it there, or delete it.',
    ]);
  });

  it('fails a comment above a line where two functions start, rather than guessing', () => {
    expect(allows(`${allow}\nconst pair = [(n) => n, (n) => -n];\n`).problems).toEqual([
      "1: 2 functions start on line 2 ((anonymous), (anonymous)), so this @crap-allow comment could mean any of them. Put the function it's for on a line of its own.",
    ]);
  });

  it('matches a callback a formatter wrapped onto the line below its call', () => {
    const code = `${allow}\nseed.items.forEach(\n  (item) => {\n    if (item) use(item);\n  },\n);\n`;
    expect(allows(code)).toMatchObject({
      allowed: [{ name: 'seed.items.forEach callback', line: 1 }],
      problems: [],
    });
  });

  it('matches the outer function in a wrapped statement, not the ones nested in it', () => {
    const code = `${allow}\nydoc.transact(\n  () => {\n    seed.items.forEach((item) => use(item));\n  },\n);\n`;
    expect(allows(code).allowed.map((a) => a.name)).toEqual(['ydoc.transact callback']);
  });

  it('fails a comment above a wrapped statement holding two functions, rather than guessing', () => {
    const code = `${allow}\npromise.then(\n  (value) => value,\n  (error) => error,\n);\n`;
    expect(allows(code).problems).toEqual([
      "1: 2 functions are passed to calls in the statement on line 2 (promise.then callback, promise.then callback), so this @crap-allow comment could mean any of them. Put the function it's for on a line of its own.",
    ]);
  });

  it.each([
    ['a class', 'class Grade {\n  rate() {\n    return 1;\n  }\n}'],
    ['an object', 'const grade = {\n  rate() {\n    return 1;\n  },\n};'],
    ['an if', 'if (ready) {\n  items.forEach((item) => use(item));\n}'],
    ['a JSX return', 'return (\n  <button onClick={() => go()} />\n);'],
  ])('fails a comment above %s whose one function starts lower down', (_, body) => {
    const code = `function outer() {\n${allow}\n${body}\n}\n`;
    expect(allows(code).problems).toEqual([
      '2: This @crap-allow comment isn’t directly above a function. Move it there, or delete it.',
    ]);
  });

  it('fails a comment above a statement with no function in it', () => {
    expect(allows(`${allow}\nconst total = items\n  .length;\n`).problems).toEqual([
      '1: This @crap-allow comment isn’t directly above a function. Move it there, or delete it.',
    ]);
  });

  it('matches a function nested on the same line to the outer one', () => {
    expect(
      allows(`${allow}\nconst grade = (n) => [n].map((m) => m);\n`).allowed.map((a) => a.name),
    ).toEqual(['grade']);
  });

  it('fails a second comment for the same function', () => {
    expect(allows(`${allow}\n${allow}\nfunction grade(n) {}\n`).problems).toEqual([
      '2: grade already has a @crap-allow comment.',
    ]);
  });
});
