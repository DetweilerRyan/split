import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_ITEM_ID, parseItemId, parseParticipantId, participantId } from './roomSnapshot';

/**
 * How one character of a word is written: as it is, upper-cased, with its accent as a separate
 * combining mark, fullwidth, or as the Kelvin sign, which is a `k` once normalized.
 */
type Writing = 'plain' | 'upper' | 'decomposed' | 'fullwidth' | 'lookalike';

function write(c: string, how: Writing): string {
  switch (how) {
    case 'plain':
      return c;
    case 'upper':
      // `ß` upper-cases to `SS`, which lower-cases to `ss`, a different word.
      return c.toUpperCase().toLowerCase() === c ? c.toUpperCase() : c;
    case 'decomposed':
      return c.normalize('NFD');
    case 'fullwidth':
      return /^[a-z0-9]$/.test(c) ? String.fromCodePoint(c.codePointAt(0)! + 0xfee0) : c;
    case 'lookalike':
      return c === 'k' ? 'K' : c;
    default: {
      const unhandled: never = how;
      return unhandled;
    }
  }
}

/**
 * Characters an id keeps, each as its id writes it: Latin letters and digits, accented Latin
 * letters, and letters and digits of other scripts, including an Arabic-Indic digit.
 */
const kept = [...'abcdefghijklmnopqrstuvwxyz0123456789kéëøßñ李王мжبع٣'];

/** A word of `letters`, from the characters an id keeps, written in any of those ways. */
function wordOf(letters: fc.Arbitrary<readonly string[]>) {
  return fc
    .tuple(
      letters,
      fc.array(fc.constantFrom<Writing>('plain', 'upper', 'decomposed', 'fullwidth', 'lookalike')),
    )
    .map(([chars, how]) => ({
      id: chars.join(''),
      written: chars.map((c, i) => write(c, how[i] ?? 'plain')).join(''),
    }));
}

/** A word of the characters an id keeps, written in any of those ways. */
const word = wordOf(fc.array(fc.constantFrom(...kept), { minLength: 1 }));

/** A word whose id isn't `p`: two characters or more, or one that isn't `p`. */
const notP = wordOf(
  fc.oneof(
    fc.array(fc.constantFrom(...kept), { minLength: 2 }),
    fc.constantFrom(...kept.filter((c) => c !== 'p')).map((c) => [c]),
  ),
);

/**
 * Characters with no letter or digit in them: spacing, punctuation, hyphens, symbols and emoji.
 * None is a combining mark, which would join the word before it.
 */
const symbols = [' ', '\t', ' ', '-', '_', '.', ',', "'", '&', '/', '(', ')', '!', '€', '·'];
const separator = fc.string({
  unit: fc.constantFrom(...symbols, '\u{1F389}', '❤️'),
  minLength: 1,
});

/** A name as a person might type it, starting with a `first` word, with the id it should give. */
function nameOf(first: typeof word) {
  return fc
    .record({
      first,
      rest: fc.array(word, { maxLength: 3 }),
      between: fc.array(separator, { minLength: 3, maxLength: 3 }),
      before: fc.option(separator, { nil: '' }),
      after: fc.option(separator, { nil: '' }),
    })
    .map(
      ({ first: head, rest, between, before, after }) =>
        [[head, ...rest], between, before, after] as const,
    )
    .map(([words, between, before, after]) => ({
      written:
        before +
        words.map((w) => w.written).reduce((acc, w, i) => acc + between[(i - 1) % 3] + w) +
        after,
      id: `p-${words.map((w) => w.id).join('-')}`,
    }));
}

/** A name as a person might type it, with the id it should give. */
const name = nameOf(word);

/** A name whose first word isn't `p`, so that dropping its `p-` doesn't leave another id. */
const notPName = nameOf(notP);

/** A name with no letter or digit, including combining marks with nothing to attach to. */
const nameless = fc.string({
  unit: fc.constantFrom(...symbols, '\u{1F389}', '́', '̈'),
});

describe('participantId', () => {
  it('gives every way of writing a name the same id: its words, lower-cased, joined by hyphens', () => {
    fc.assert(
      fc.property(name, ({ written, id }) => {
        expect(participantId(written)).toBe(id);
      }),
    );
  });

  it('gives no id for a name with no letter or digit', () => {
    fc.assert(
      fc.property(nameless, (written) => {
        expect(participantId(written)).toBeNull();
      }),
    );
  });
});

/**
 * Any text, with a letter or digit an id keeps somewhere in it, so it names someone. The letter
 * may carry a combining mark that stays one after normalizing, such as a Devanagari vowel sign.
 */
const someone = fc
  .tuple(
    fc.string({ unit: 'binary' }),
    fc.constantFrom(...kept),
    fc.constantFrom('', '\u093f', '\u094d', '\u0301'),
    fc.string({ unit: 'binary' }),
  )
  .map(([before, letter, mark, after]) => before + letter + mark + after);

/** One UTF-16 code unit, which is what an item id's 64-character limit counts. */
const codeUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));

/**
 * Strings that look like a participant id but aren't one: an id with another prefix, an empty
 * word, a word joined by something other than `-`, or `p-` on its own.
 */
const notAnId = fc.oneof(
  fc
    .oneof(
      {
        arbitrary: fc.tuple(name, fc.constantFrom('P-', 'p_', 'p', 'q-', '-', ' p-', 'pp-', 'p–')),
        weight: 8,
      },
      // Dropping the prefix of `p-p-a`, a name whose first word is "p", leaves `p-a`, an id, so
      // with no prefix the first word is anything but "p".
      { arbitrary: fc.tuple(notPName, fc.constant('')), weight: 1 },
    )
    .map(([{ id }, prefix]) => prefix + id.slice(2)),
  name.map(({ id }) => `${id}-`),
  name.map(({ id }) => id.replace('p-', 'p--')),
  fc
    .tuple(name, fc.constantFrom(' ', '_', '.', '/', '\n'), name)
    .map(([first, join, second]) => first.id + join + second.id.slice(2)),
  // `p` on its own, which no name's id less its prefix can be, now that none starts with "p".
  fc.constantFrom('p-', 'p'),
);

describe('parseParticipantId', () => {
  it('accepts every id participantId mints, for any name that has a letter or digit', () => {
    fc.assert(
      fc.property(someone, (written) => {
        const id = participantId(written);
        expect(id).not.toBeNull();
        expect(parseParticipantId(id)).toBe(id);
      }),
    );
  });

  it('accepts every id a name written any way gives', () => {
    fc.assert(
      fc.property(name, ({ id }) => {
        expect(parseParticipantId(id)).toBe(id);
      }),
    );
  });

  it("refuses a string that isn't p- and words joined by -", () => {
    fc.assert(
      fc.property(notAnId, (value) => {
        expect(parseParticipantId(value)).toBeNull();
      }),
    );
  });
});

describe('parseItemId', () => {
  it('accepts every id the app mints, and any other text up to 64 characters, as it is', () => {
    const minted = fc
      .tuple(
        fc.nat(),
        fc.string({
          unit: fc.constantFrom(...'0123456789abcdefghijklmnopqrstuvwxyz'),
          minLength: 1,
          maxLength: 5,
        }),
      )
      .map(([time, random]) => `item-${time}-${random}`);
    const preset = fc.nat({ max: 199 }).map((index) => `item-${index}`);
    const anyText = fc.string({ unit: codeUnit, minLength: 1, maxLength: MAX_ITEM_ID });
    fc.assert(
      fc.property(fc.oneof(minted, preset, anyText), (id) => {
        expect(parseItemId(id)).toBe(id);
      }),
    );
  });

  it('refuses an empty id, and one longer than 64 characters', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.string({ minLength: MAX_ITEM_ID + 1, maxLength: 200 })),
        (id) => {
          expect(parseItemId(id)).toBeNull();
        },
      ),
    );
  });
});
