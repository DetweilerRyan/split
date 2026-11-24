import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { participantId } from './roomSnapshot';

/**
 * How one character of a word is written: as it is, upper-cased, or as a character outside a to z
 * that lower-cases into one. The Kelvin sign lower-cases to `k`. `İ` lower-cases to `i` and a
 * combining dot, which the id drops, so it stands for an `i` only at the end of a word.
 */
type Writing = 'plain' | 'upper' | 'lookalike';

function write(c: string, how: Writing, last: boolean): string {
  if (how === 'upper') return c.toUpperCase();
  if (how === 'lookalike' && c === 'k') return '\u212A';
  if (how === 'lookalike' && c === 'i' && last) return '\u0130';
  return c;
}

/** A word of the characters an id keeps, written in any of those ways. */
const word = fc
  .tuple(
    fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789ik'), minLength: 1 }),
    fc.array(fc.constantFrom<Writing>('plain', 'upper', 'lookalike')),
  )
  .map(([letters, how]) => ({
    id: letters,
    written: [...letters]
      .map((c, i) => write(c, how[i] ?? 'plain', i === letters.length - 1))
      .join(''),
  }));

/** Characters an id drops: spacing, punctuation, hyphens, and letters outside a to z. */
const separator = fc.string({
  unit: fc.constantFrom(
    ' ',
    '\t',
    '-',
    '_',
    '.',
    ',',
    "'",
    '&',
    '/',
    '(',
    ')',
    'é',
    'ß',
    'Ø',
    '日',
  ),
  minLength: 1,
});

/** A name as a person might type it, with the id it should give. */
const name = fc
  .record({
    words: fc.array(word, { minLength: 1, maxLength: 4 }),
    between: fc.array(separator, { minLength: 3, maxLength: 3 }),
    before: fc.option(separator, { nil: '' }),
    after: fc.option(separator, { nil: '' }),
  })
  .map(({ words, between, before, after }) => ({
    written:
      before +
      words.map((w) => w.written).reduce((acc, w, i) => acc + between[(i - 1) % 3] + w) +
      after,
    id: `p-${words.map((w) => w.id).join('-')}`,
  }));

describe('participantId', () => {
  it('gives every way of writing a name the same id: its words, lower-cased, joined by hyphens', () => {
    fc.assert(
      fc.property(name, ({ written, id }) => {
        expect(participantId(written)).toBe(id);
      }),
    );
  });
});
