import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { participantId } from './roomSnapshot';

/** A word of the characters an id keeps, in any mix of cases. */
const word = fc
  .tuple(
    fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), minLength: 1 }),
    fc.array(fc.boolean()),
  )
  .map(([letters, upper]) => ({
    id: letters,
    written: [...letters].map((c, i) => (upper[i] ? c.toUpperCase() : c)).join(''),
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
