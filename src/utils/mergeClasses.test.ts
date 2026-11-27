import { describe, expect, it } from 'vitest';
import { mergeClasses } from './mergeClasses';

describe('mergeClasses', () => {
  it('lets a later utility win over an earlier one it conflicts with', () => {
    expect(mergeClasses('p-2 mt-1', 'p-4')).toBe('mt-1 p-4');
  });

  it("keeps the app's own component classes beside the utilities", () => {
    expect(mergeClasses('card', 'mt-4')).toBe('card mt-4');
  });

  it('skips empty and missing classes', () => {
    expect(mergeClasses('card', undefined, false, null, '', 'grid')).toBe('card grid');
  });

  it('gives an empty string when there are no classes', () => {
    expect(mergeClasses()).toBe('');
  });
});
