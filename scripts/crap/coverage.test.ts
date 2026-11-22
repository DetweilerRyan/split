import { describe, expect, it } from 'vitest';
import { coverageOf, type FileCoverage } from './coverage.ts';
import { parse } from './functions.ts';

/** An istanbul file entry with one statement per listed line, run or not. */
function report(
  statements: [line: number, run: boolean][],
  functions: [line: number, called: boolean][] = [],
) {
  const file: FileCoverage = { statementMap: {}, s: {}, fnMap: {}, f: {} };
  statements.forEach(([line, run], i) => {
    file.statementMap[i] = { start: { line, column: 2 }, end: { line, column: 10 } };
    file.s[i] = run ? 1 : 0;
  });
  functions.forEach(([line, called], i) => {
    // Where `const one = () => 1;` puts its arrow function: columns 12 to 19.
    file.fnMap[i] = { loc: { start: { line, column: 12 }, end: { line, column: 19 } } };
    file.f[i] = called ? 1 : 0;
  });
  return file;
}

const code = `function outer(a) {
  if (a) x();
  y();
  const inner = () => {
    z();
  };
  w();
}
const one = () => 1;
`;

const covered = (file: FileCoverage | undefined) =>
  Object.fromEntries(
    [...coverageOf(parse('example.ts', code).functions, file)].map(([fn, c]) => [fn.name, c]),
  );

describe('coverageOf', () => {
  it('gives each function the share of its own statements that ran, not its nested functions’', () => {
    expect(
      covered(
        report([
          [2, true],
          [3, true],
          [5, false],
          [7, false],
        ]),
      ),
    ).toMatchObject({
      outer: 2 / 3,
      'outer > inner': 0,
    });
  });

  it('counts a function with no statements of its own as covered when it was called', () => {
    expect(covered(report([], [[9, true]]))).toMatchObject({ one: 1 });
    expect(covered(report([], [[9, false]]))).toMatchObject({ one: 0 });
  });

  it('scores 0 throughout a file the report doesn’t have', () => {
    expect(covered(undefined)).toEqual({ outer: 0, 'outer > inner': 0, one: 0 });
  });
});
