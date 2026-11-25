import { describe, expect, it } from 'vitest';
import type { Allow } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import type { Fn } from './functions.ts';

const limits = { crap: 30, complexity: 10 } as const;

function scored(name: string, complexity: number, coverage: number, line = 1): Scored {
  const fn = {
    label: name,
    name,
    complexity,
    offset: { start: 0, end: 0 },
    start: { line, column: 0 },
    end: { line: line + 8, column: 1 },
    parents: [],
    passedToCall: false,
  } satisfies Fn;
  return { fn, file: 'src/a.ts', coverage, crap: crapOf(complexity, coverage) };
}

function allowFor(crap: number, complexity: number, line = 1): Allow {
  return {
    file: 'src/a.ts',
    line,
    lastLine: line,
    crap,
    complexity,
    reason: 'A reason.',
  };
}

function messages(findings: Readonly<ReturnType<typeof check>>) {
  return findings.map((f) => f.message);
}

describe('crapOf', () => {
  it('is complexity² × (1 − coverage)³ + complexity', () => {
    expect([crapOf(12, 0), crapOf(12, 1), crapOf(6, 0.5)]).toEqual([156, 12, 10.5]);
  });
});

describe('check', () => {
  it('fails every function over CRAP 30, and every one over complexity 10 whatever its coverage', () => {
    const findings = check(
      [scored('a', 6, 0, 1), scored('b', 11, 1, 20), scored('c', 5, 0, 40)],
      new Map(),
      limits,
    );
    expect(messages(findings)).toEqual([
      'a: CRAP 42, complexity 6, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 42, complexity 6. <reason>` directly above it.',
      'b: CRAP 11, complexity 11, coverage 100%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 11, complexity 11. <reason>` directly above it.',
    ]);
  });

  it('passes a function whose @crap-allow comment matches its numbers', () => {
    const s = scored('a', 12, 0);
    expect(check([s], new Map([[s.fn, allowFor(156, 12)]]), limits)).toEqual([]);
  });

  it('fails a @crap-allow comment whose function got worse, or better', () => {
    const worse = scored('worse', 13, 0, 20);
    const better = scored('better', 12, 1, 40);
    const allowed = new Map([
      [worse.fn, allowFor(156, 12, 19)],
      [better.fn, allowFor(156, 12, 39)],
    ]);
    expect(messages(check([worse, better], allowed, limits))).toEqual([
      'worse: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
      'better: CRAP 12, complexity 12, coverage 100%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 12, complexity 12.`, and check its reason still holds.',
    ]);
  });

  it('fails a @crap-allow comment on a function within the limits', () => {
    const s = scored('a', 4, 0);
    expect(messages(check([s], new Map([[s.fn, allowFor(20, 4)]]), limits))).toEqual([
      "a: CRAP 20, complexity 4, coverage 0%. It's within the limits now, so delete its @crap-allow comment.",
    ]);
  });

  it('compares the score to one decimal place, as the comment gives it', () => {
    const s = scored('a', 11, 0.6);
    expect(s.crap).toBeCloseTo(18.744);
    expect(check([s], new Map([[s.fn, allowFor(18.7, 11)]]), limits)).toEqual([]);
  });

  it('uses the limits it’s given', () => {
    const s = scored('a', 6, 0);
    expect(check([s], new Map(), { crap: 50, complexity: 10 })).toEqual([]);
    expect(messages(check([s], new Map(), { crap: 50, complexity: 5 }))).toEqual([
      'a: CRAP 42, complexity 6, coverage 0%. Over the limits (CRAP 50, complexity 5). To leave it, add `// @crap-allow CRAP 42, complexity 6. <reason>` directly above it.',
    ]);
  });

  it('compares the score with the limit as it prints it, to one decimal place', () => {
    const justOver = { ...scored('a', 5, 0), crap: 30.04 };
    expect(check([justOver], new Map(), limits)).toEqual([]);
    expect(messages(check([{ ...justOver, crap: 30.06 }], new Map(), limits))).toEqual([
      expect.stringContaining('a: CRAP 30.1, complexity 5, coverage 0%. Over the limits'),
    ]);
  });

  it('orders findings by file and line', () => {
    const findings = check(
      [scored('later', 12, 0, 30), scored('earlier', 12, 0, 5)],
      new Map(),
      limits,
    );
    expect(findings.map((f) => f.line)).toEqual([5, 30]);
  });

  it('orders findings by file before line', () => {
    const inB = { ...scored('b', 12, 0, 5), file: 'src/b.ts' };
    const inA = scored('a', 12, 0, 30);
    const inC = { ...scored('c', 12, 0, 1), file: 'src/c.ts' };
    expect(check([inB, inA, inC], new Map(), limits).map((f) => [f.file, f.line])).toEqual([
      ['src/a.ts', 30],
      ['src/b.ts', 5],
      ['src/c.ts', 1],
    ]);
  });

  it('passes a fully tested function at the complexity limit', () => {
    expect(check([scored('a', 10, 1)], new Map(), limits)).toEqual([]);
  });

  it('reports a @crap-allow comment’s problem at the comment, not at its function', () => {
    const s = scored('a', 4, 0, 10);
    const allow = { ...allowFor(20, 4, 8), file: 'src/allowed.ts' };
    expect(check([s], new Map([[s.fn, allow]]), limits)).toEqual([
      {
        file: 'src/allowed.ts',
        line: 8,
        message:
          "a: CRAP 20, complexity 4, coverage 0%. It's within the limits now, so delete its @crap-allow comment.",
      },
    ]);
  });

  it('fails a @crap-allow comment whose CRAP matches but whose complexity doesn’t', () => {
    const s = scored('a', 12, 0);
    expect(messages(check([s], new Map([[s.fn, allowFor(156, 13)]]), limits))).toEqual([
      'a: CRAP 156, complexity 12, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 13. Update the comment to `// @crap-allow CRAP 156, complexity 12.`, and check its reason still holds.',
    ]);
  });
});
