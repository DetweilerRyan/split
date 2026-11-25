import { describe, expect, it } from 'vitest';
import { typedNumber } from './typedNumber';

describe('typedNumber', () => {
  it.each([
    ['12.5', 12.5],
    ['-3', -3],
    [' 7 ', 7],
  ])('reads %j as the number it holds', (text, expected) => {
    expect(typedNumber(text)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1,5'])('reads %j, which holds no number, as 0', (text) => {
    expect(typedNumber(text)).toBe(0);
  });

  it('reads minus zero as 0', () => {
    expect(Object.is(typedNumber('-0'), 0)).toBe(true);
  });
});
