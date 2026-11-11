import { describe, expect, it } from 'vitest';
import { guessMeal, parsePurchasedAt } from '../utils/mealInfo';

describe('guessMeal', () => {
  it('guesses from time and size', () => {
    expect(guessMeal(parsePurchasedAt('2026-01-02T20:15'), 4)).toBe('Dinner');
    expect(guessMeal(parsePurchasedAt('2026-01-02T12:30'), 8)).toBe('Lunch · shared meal');
    expect(guessMeal(parsePurchasedAt('2026-01-02T08:00'), 2)).toBe('Coffee & breakfast');
  });
  it('returns null without a time', () => {
    expect(guessMeal(parsePurchasedAt('2026-01-02'), 4)).toBeNull();
    expect(parsePurchasedAt('nope')).toBeNull();
  });
});
