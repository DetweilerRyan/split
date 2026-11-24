import { describe, expect, it } from 'vitest';
import { findParticipant, participantId } from './roomSnapshot';

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
  const sam = { id: 'p-sam', name: 'Sam' };

  it('finds the participant whose id the name gives', () => {
    expect(findParticipant([sam], ' SAM ')).toBe(sam);
  });

  it('finds a participant stored under an older id by its name', () => {
    const jose = { id: 'p-jos', name: 'José' };
    expect(findParticipant([sam, jose], 'josé')).toBe(jose);
  });

  it("doesn't match a non-Latin name to another stored under the old empty id", () => {
    expect(findParticipant([{ id: 'p-', name: 'Мария' }], '李')).toBeUndefined();
  });

  it('finds nobody for a name with no letter or digit', () => {
    expect(findParticipant([{ id: 'p-', name: '!!!' }], '!!!')).toBeUndefined();
  });
});
