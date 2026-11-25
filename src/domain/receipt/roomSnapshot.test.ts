import { describe, expect, it } from 'vitest';
import {
  findParticipant,
  parseItemId,
  parseParticipantId,
  participantId,
  participantIdSchema,
} from './roomSnapshot';

describe('parseParticipantId', () => {
  it('accepts an id participantId mints, in any script', () => {
    expect(parseParticipantId('p-sam')).toBe('p-sam');
    expect(parseParticipantId('p-josé-李-2')).toBe('p-josé-李-2');
    expect(parseParticipantId('p-हिन्दी')).toBe('p-हिन्दी');
  });

  it('accepts an id stored under the older ASCII-only rule', () => {
    expect(parseParticipantId('p-zo-lee')).toBe('p-zo-lee');
    expect(parseParticipantId('p-jos')).toBe('p-jos');
  });

  it('refuses p- on its own, the id the older rule gave a name with no ASCII letter or digit', () => {
    expect(parseParticipantId('p-')).toBeNull();
  });

  it('refuses an id with an empty word, a separator other than -, or no p- prefix', () => {
    expect(parseParticipantId('p--sam')).toBeNull();
    expect(parseParticipantId('p-sam-')).toBeNull();
    expect(parseParticipantId('p-sam lee')).toBeNull();
    expect(parseParticipantId('p-sam_lee')).toBeNull();
    expect(parseParticipantId('sam')).toBeNull();
    expect(parseParticipantId('P-sam')).toBeNull();
    expect(parseParticipantId('')).toBeNull();
  });

  it('refuses a value that is not a string', () => {
    expect(parseParticipantId(42)).toBeNull();
    expect(parseParticipantId(null)).toBeNull();
    expect(parseParticipantId(undefined)).toBeNull();
  });
});

describe('parseItemId', () => {
  it('accepts any text from 1 to 64 characters', () => {
    expect(parseItemId('item-0')).toBe('item-0');
    expect(parseItemId('item-1764000000000-a1b2c')).toBe('item-1764000000000-a1b2c');
    expect(parseItemId('x')).toBe('x');
    expect(parseItemId('x'.repeat(64))).toBe('x'.repeat(64));
  });

  it('refuses an empty id, one longer than 64 characters, and a value that is not a string', () => {
    expect(parseItemId('')).toBeNull();
    expect(parseItemId('x'.repeat(65))).toBeNull();
    expect(parseItemId(7)).toBeNull();
  });
});

describe('participantId', () => {
  it('lower-cases the name and joins its words with hyphens', () => {
    expect(participantId('Mary Ann')).toBe('p-mary-ann');
  });

  it('drops spacing and punctuation at either end', () => {
    expect(participantId('  (Sam!)  ')).toBe('p-sam');
  });

  it('keeps accented letters in their word', () => {
    expect(participantId('Zoë Lee')).toBe('p-zoë-lee');
    expect(participantId('José')).toBe('p-josé');
    expect(participantId('ZOË')).toBe('p-zoë');
  });

  it('gives an accent typed as a separate mark the same id as the accented letter', () => {
    expect(participantId('José')).toBe('p-josé');
  });

  it('gives fullwidth letters the same id as the plain ones', () => {
    expect(participantId('ＪＯＳＥ')).toBe('p-jose');
  });

  it('keeps names written in a non-Latin script', () => {
    expect(participantId('李')).toBe('p-李');
    expect(participantId('Мария')).toBe('p-мария');
    expect(participantId('محمد')).toBe('p-محمد');
    expect(participantId('हिन्दी')).toBe('p-हिन्दी');
  });

  it('gives different non-Latin names different ids', () => {
    expect(participantId('李')).not.toBe(participantId('王'));
  });

  it('keeps the words of a name that mixes scripts, symbols and digits', () => {
    expect(participantId('Ana 李')).toBe('p-ana-李');
    expect(participantId('José & 李 #2')).toBe('p-josé-李-2');
  });

  it('gives no id for a name with no letter or digit', () => {
    expect(participantId('!!!')).toBeNull();
    expect(participantId('🎉 & ❤️')).toBeNull();
    expect(participantId('́')).toBeNull();
    expect(participantId('   ')).toBeNull();
    expect(participantId('')).toBeNull();
  });
});

describe('findParticipant', () => {
  const sam = { id: participantIdSchema.parse('p-sam'), name: 'Sam' };

  it('finds the participant whose id the name gives', () => {
    expect(findParticipant([sam], ' SAM ')).toBe(sam);
  });

  it('finds a participant stored under an older id by its name', () => {
    const jose = { id: participantIdSchema.parse('p-jos'), name: 'José' };
    expect(findParticipant([sam, jose], 'josé')).toBe(jose);
  });

  it('finds nobody for a name with no letter or digit', () => {
    const stored = { id: participantIdSchema.parse('p-x'), name: '!!!' };
    expect(findParticipant([stored], '!!!')).toBeUndefined();
  });
});
