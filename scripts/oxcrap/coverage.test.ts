import { describe, expect, it } from 'vitest';
import { coverageOf, type FileCoverage, newerThan, parseReport } from './coverage.ts';
import { COUNT_ALL, COUNT_SEPARATELY, type Counting } from './complexity.ts';
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

/** Counting as before #74, for the tests that pin it. */
const SEPARATELY = COUNT_SEPARATELY;

/** Each function's share of coverage, with functions scored as `counting` says. */
function covered(file: FileCoverage | undefined, counting: Counting = SEPARATELY) {
  return Object.fromEntries(
    [...coverageOf(parse('example.ts', code, counting).functions, file)].map(([fn, c]) => [
      fn.name,
      c,
    ]),
  );
}

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

  it('gives a nested function’s statements to the outermost function by default', () => {
    expect(
      covered(
        report([
          [2, true],
          [3, true],
          [5, false],
          [7, false],
        ]),
        COUNT_ALL,
      ),
    ).toEqual({ outer: 2 / 4, one: 0 });
  });

  it('counts a function with no statements of its own as covered when it was called', () => {
    expect(covered(report([], [[9, true]]))).toMatchObject({ one: 1 });
    expect(covered(report([], [[9, false]]))).toMatchObject({ one: 0 });
  });

  it('scores 0 throughout a file the report doesn’t have', () => {
    expect(covered(undefined)).toEqual({ outer: 0, 'outer > inner': 0, one: 0 });
  });
});

describe('parseReport', () => {
  it('reads an istanbul JSON report', () => {
    const file = report([[2, true]]);
    expect(parseReport(JSON.stringify({ '/repo/src/a.ts': file }), 'c.json')).toEqual({
      '/repo/src/a.ts': file,
    });
  });

  it('refuses text that isn’t JSON, and JSON that isn’t an istanbul report', () => {
    expect(() => parseReport('<html>', 'c.json')).toThrow("c.json isn't a JSON coverage report");
    expect(() => parseReport('{"total": {"lines": {"pct": 90}}}', 'c.json')).toThrow(
      "c.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
    );
  });

  it.each(['null', '5', '"x"', 'true', '[]'])('refuses %s, which isn’t a report at all', (text) => {
    expect(() => parseReport(text, 'c.json')).toThrow(
      "c.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
    );
  });
});

describe('newerThan', () => {
  it('lists the files changed after the report, newest first', () => {
    const files = [
      { file: 'src/old.ts', time: 100 },
      { file: 'src/newer.ts', time: 300 },
      { file: 'src/new.ts', time: 200 },
      { file: 'src/same.ts', time: 150 },
    ];
    expect(newerThan(150, files)).toEqual(['src/newer.ts', 'src/new.ts']);
  });
});
