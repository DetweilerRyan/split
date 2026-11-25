import { describe, expect, it } from 'vitest';
import { storedText } from './storedText';

describe('storedText', () => {
  it('reads a non-empty string as it is', () => {
    expect(storedText('Lunch', 'Receipt')).toBe('Lunch');
  });

  it('reads an empty or missing value as the fallback', () => {
    expect(storedText('', 'Receipt')).toBe('Receipt');
    expect(storedText(undefined, 'Receipt')).toBe('Receipt');
  });

  it('reads a value that is not a string as the fallback, not as its stringified form', () => {
    expect(storedText(42, 'Receipt')).toBe('Receipt');
    expect(storedText({ title: 'Lunch' }, 'Receipt')).toBe('Receipt');
  });
});
