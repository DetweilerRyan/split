import { describe, expect, it } from 'vitest';
import { storedTextSchema } from './storedText';

describe('storedTextSchema', () => {
  it('reads a non-empty string as it is', () => {
    expect(storedTextSchema('Receipt').parse('Lunch')).toBe('Lunch');
  });

  it('reads an empty or missing value as the fallback', () => {
    expect(storedTextSchema('Receipt').parse('')).toBe('Receipt');
    expect(storedTextSchema('Receipt').parse(undefined)).toBe('Receipt');
  });

  it('reads a value that is not a string as the fallback, not as its stringified form', () => {
    expect(storedTextSchema('Receipt').parse(42)).toBe('Receipt');
    expect(storedTextSchema('Receipt').parse({ title: 'Lunch' })).toBe('Receipt');
  });
});
