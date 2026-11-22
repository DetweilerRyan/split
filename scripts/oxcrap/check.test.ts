import { describe, expect, it } from 'vitest';
import type { Allow } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import type { Changed } from './diff.ts';
import type { Fn } from './functions.ts';

function scored(
  name: string,
  complexity: number,
  coverage: number,
  lines: [number, number] = [1, 9],
): Scored {
  const fn = {
    label: name,
    name,
    complexity,
    offset: { start: 0, end: 0 },
    start: { line: lines[0], column: 0 },
    end: { line: lines[1], column: 1 },
    parents: [],
  } satisfies Fn;
  return { fn, file: 'src/a.ts', coverage, crap: crapOf(complexity, coverage) };
}

const allowFor = (crap: number, complexity: number, line = 1): Allow => ({
  file: 'src/a.ts',
  line,
  lastLine: line,
  crap,
  complexity,
  reason: 'A reason.',
});

const changedLines = (...lines: number[]): Changed => new Map([['src/a.ts', new Set(lines)]]);
const messages = (result: ReturnType<typeof check>) => ({
  problems: result.problems.map((p) => p.message),
  notices: result.notices.map((n) => n.message),
});

describe('crapOf', () => {
  it('is complexity² × (1 − coverage)³ + complexity', () => {
    expect([crapOf(12, 0), crapOf(12, 1), crapOf(6, 0.5)]).toEqual([156, 12, 10.5]);
  });
});

describe('check', () => {
  it('fails a changed function over CRAP 30, and one over complexity 10 whatever its coverage', () => {
    const result = check(
      [scored('a', 6, 0), scored('b', 11, 1), scored('c', 5, 0)],
      new Map(),
      changedLines(5),
    );
    expect(messages(result).problems).toEqual([
      'a: CRAP 42, complexity 6, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 42, complexity 6. <reason>` directly above it.',
      'b: CRAP 11, complexity 11, coverage 100%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 11, complexity 11. <reason>` directly above it.',
    ]);
  });

  it('passes a function over the limits that the branch doesn’t change', () => {
    expect(check([scored('a', 12, 0, [20, 30])], new Map(), changedLines(5)).problems).toEqual([]);
  });

  it('passes a function whose @crap-allow comment matches its numbers', () => {
    const s = scored('a', 12, 0);
    expect(check([s], new Map([[s.fn, allowFor(156, 12)]]), changedLines(5)).problems).toEqual([]);
  });

  it('fails a @crap-allow comment whose function got worse, or better, even when the branch doesn’t touch it', () => {
    const worse = scored('worse', 13, 0, [20, 30]);
    const better = scored('better', 12, 1, [40, 50]);
    const allowed = new Map([
      [worse.fn, allowFor(156, 12, 19)],
      [better.fn, allowFor(156, 12, 39)],
    ]);
    expect(messages(check([worse, better], allowed, new Map())).problems).toEqual([
      'worse: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
      'better: CRAP 12, complexity 12, coverage 100%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 12, complexity 12.`, and check its reason still holds.',
    ]);
  });

  it('fails a @crap-allow comment on a function within the limits', () => {
    const s = scored('a', 4, 0);
    expect(messages(check([s], new Map([[s.fn, allowFor(20, 4)]]), new Map())).problems).toEqual([
      "a: CRAP 20, complexity 4, coverage 0%. It's within the limits now, so delete its @crap-allow comment.",
    ]);
  });

  it('compares the score to one decimal place, as the comment gives it', () => {
    const s = scored('a', 11, 0.6);
    expect(s.crap).toBeCloseTo(18.744);
    expect(check([s], new Map([[s.fn, allowFor(18.7, 11)]]), new Map()).problems).toEqual([]);
  });

  it('gives a notice for each @crap-allow comment the branch adds or changes', () => {
    const s = scored('a', 12, 0, [2, 9]);
    const result = check([s], new Map([[s.fn, allowFor(156, 12, 1)]]), changedLines(1));
    expect(messages(result)).toEqual({
      problems: [],
      notices: [
        'Adds or changes the @crap-allow comment for a (CRAP 156, complexity 12). Its reason: A reason.',
      ],
    });
  });
});
