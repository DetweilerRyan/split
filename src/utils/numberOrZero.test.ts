import { describe, expect, it } from 'vitest';
import { numberOrZero } from './numberOrZero';

describe('numberOrZero', () => {
  it.each([
    ['12.5', 12.5],
    ['-3', -3],
    [' 7 ', 7],
  ])('reads the text %j as the number it holds', (text, expected) => {
    expect(numberOrZero(text)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1,5'])('reads the text %j, which holds no number, as 0', (text) => {
    expect(numberOrZero(text)).toBe(0);
  });

  it('reads a number a peer stored as it is', () => {
    expect(numberOrZero(4.25)).toBe(4.25);
  });

  it.each([undefined, {}, [1, 2]])('reads %j, which is no number, as 0', (value) => {
    expect(numberOrZero(value)).toBe(0);
  });

  it('reads minus zero as 0', () => {
    expect(Object.is(numberOrZero('-0'), 0)).toBe(true);
    expect(Object.is(numberOrZero(-0), 0)).toBe(true);
  });
});
