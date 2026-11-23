import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { changedRanges } from './mutation.ts';

// Random diffs in the format `diffArgs` asks git for, built from files and hunks the generator
// knows, so the expected ranges come from the generator rather than from parsing. It mixes files
// oxCrap mutates with ones it doesn't, paths with spaces (which git ends with a tab), files with
// no hunks, and hunks that only delete.

type Hunk = { start: number; count: number };
type File = { path: string; kind: 'mutated' | 'test' | 'feature' | 'outside'; hunks: Hunk[] };

const segment = fc.stringMatching(/^[a-z][a-z0-9 _-]{0,8}$/).map((s) => s.trimEnd() || 'x');
const pathOf = (kind: File['kind'], name: string) =>
  ({
    mutated: `scripts/oxcrap/${name}.ts`,
    test: `scripts/oxcrap/${name}.test.ts`,
    feature: `scripts/oxcrap/features/steps/${name}.ts`,
    outside: `src/${name}.ts`,
  })[kind];

const file: fc.Arbitrary<File> = fc
  .record({
    kind: fc.constantFrom<File['kind']>('mutated', 'mutated', 'test', 'feature', 'outside'),
    name: segment,
    hunks: fc.array(
      fc.record({
        start: fc.integer({ min: 1, max: 500 }),
        count: fc.integer({ min: 0, max: 20 }),
      }),
      { maxLength: 4 },
    ),
  })
  .map(({ kind, name, hunks }) => ({ path: pathOf(kind, name), kind, hunks }));

function render(files: File[]) {
  return files
    .flatMap(({ path, hunks }) => [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}${path.includes(' ') ? '\t' : ''}`,
      `+++ b/${path}${path.includes(' ') ? '\t' : ''}`,
      ...hunks.flatMap(({ start, count }) => [
        // `-L,0 +S,C` when the hunk only adds; git leaves `,C` out when C is 1.
        `@@ -${start},1 +${start}${count === 1 ? '' : `,${count}`} @@ function context`,
        ...Array.from({ length: count }, () => '+changed'),
      ]),
    ])
    .join('\n');
}

describe('changedRanges on generated diffs', () => {
  it('gives exactly the added or changed lines of the files oxCrap mutates', () => {
    fc.assert(
      fc.property(fc.array(file, { maxLength: 5 }), (files) => {
        const expected = files
          .filter((f) => f.kind === 'mutated')
          .flatMap((f) =>
            f.hunks
              .filter((h) => h.count > 0)
              .map((h) => `${f.path}:${h.start}-${h.start + h.count - 1}`),
          );
        expect(changedRanges(render(files))).toEqual(expected);
      }),
      { numRuns: 300 },
    );
  });
});
