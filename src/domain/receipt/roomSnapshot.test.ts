import { describe, expect, it } from 'vitest';
import { participantId } from './roomSnapshot';

describe('participantId', () => {
  it('lower-cases the name and joins its words with hyphens', () => {
    expect(participantId('Mary Ann')).toBe('p-mary-ann');
  });

  it('drops spacing and punctuation at either end', () => {
    expect(participantId('  (Sam!)  ')).toBe('p-sam');
  });

  it('treats a letter outside a to z as a separator', () => {
    expect(participantId('Zoë Lee')).toBe('p-zo-lee');
  });
});
