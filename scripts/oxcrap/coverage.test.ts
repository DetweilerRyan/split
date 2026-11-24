import { assert, describe, expect, it } from 'vitest';
import { coverageOf, type FileCoverage, newerThan, parseReport } from './coverage.ts';
import { COUNT_ALL, COUNT_SEPARATELY, type Counting } from './complexity.ts';
import { parse } from './functions.ts';

/** An istanbul file entry with one statement per listed line, run or not. */
function report(
  statements: readonly (readonly [line: number, run: boolean])[],
  functions: readonly (readonly [line: number, called: boolean])[] = [],
) {
  const file: FileCoverage = {
    statementMap: Object.fromEntries(
      statements.map(([line], i) => [i, { start: { line, column: 2 }, end: { line, column: 10 } }]),
    ),
    s: Object.fromEntries(statements.map(([, run], i) => [i, run ? 1 : 0])),
    // Where `const one = () => 1;` puts its arrow function: columns 12 to 19.
    fnMap: Object.fromEntries(
      functions.map(([line], i) => [
        i,
        { loc: { start: { line, column: 12 }, end: { line, column: 19 } } },
      ]),
    ),
    f: Object.fromEntries(functions.map(([, called], i) => [i, called ? 1 : 0])),
  };
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

  it('gives a statement to the innermost function around it, whatever order the functions come in', () => {
    const functions = parse('example.ts', code, SEPARATELY).functions;
    const shares = coverageOf(
      [...functions].reverse(),
      report([
        [3, false],
        [5, true],
      ]),
    );
    expect(Object.fromEntries([...shares].map(([fn, c]) => [fn.name, c]))).toEqual({
      one: 0,
      'outer > inner': 1,
      outer: 0,
    });
  });

  it('leaves out a statement before a function, on its first line or one above it', () => {
    const source = 'const ready = true; start();\nrun(); const f = () => {\n  go();\n};\n';
    function at(line: number, column: number) {
      return { line, column };
    }
    // `start()` is on the line above f, at a column past where f starts; `run()` is on f's line, before it.
    const file: FileCoverage = {
      statementMap: {
        0: { start: at(1, 20), end: at(1, 28) },
        1: { start: at(2, 0), end: at(2, 6) },
        2: { start: at(3, 2), end: at(3, 7) },
      },
      s: { 0: 0, 1: 0, 2: 1 },
      fnMap: {},
      f: {},
    };
    const [f] = parse('example.ts', source, SEPARATELY).functions;
    assert(f, 'the source has a function');
    expect(f.start).toEqual(at(2, 17));
    expect(coverageOf([f], file).get(f)).toBe(1);
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

  it.each(['statementMap', 's', 'fnMap', 'f'] as const)(
    'refuses a file entry with no %s, which scoring reads',
    (part) => {
      const { [part]: _, ...entry } = report([[2, true]], [[9, true]]);
      expect(() => parseReport(JSON.stringify({ '/repo/src/a.ts': entry }), 'c.json')).toThrow(
        "c.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
      );
    },
  );

  it('refuses a report whose file entry is null', () => {
    expect(() => parseReport('{"/repo/src/a.ts": null}', 'c.json')).toThrow(
      "c.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
    );
  });

  it.each(['5', '"x"'])(
    'refuses a report whose file entry is %s, which isn’t an object',
    (entry) => {
      expect(() => parseReport(`{"/repo/src/a.ts": ${entry}}`, 'c.json')).toThrow(
        "c.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
      );
    },
  );

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

  it('sorts the files newest first, whatever order they come in', () => {
    const files = [
      { file: 'src/a.ts', time: 200 },
      { file: 'src/b.ts', time: 300 },
      { file: 'src/c.ts', time: 400 },
      { file: 'src/d.ts', time: 500 },
    ];
    expect(newerThan(100, files)).toEqual(['src/d.ts', 'src/c.ts', 'src/b.ts', 'src/a.ts']);
  });
});
