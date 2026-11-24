import { describe, expect, it } from 'vitest';
import { localeCurrency } from './currency';

describe('localeCurrency', () => {
  it('gives the currency of the region a language tag names', () => {
    expect(localeCurrency('en-GB')).toBe('GBP');
    expect(localeCurrency('de-AT')).toBe('EUR');
    expect(localeCurrency('es-MX')).toBe('MXN');
  });

  it('gives the currency of the region a language implies, when the tag names none', () => {
    expect(localeCurrency('fr')).toBe('EUR');
    expect(localeCurrency('ja')).toBe('JPY');
    expect(localeCurrency('en')).toBe('USD');
  });

  it('falls back to USD for a region it has no currency for', () => {
    expect(localeCurrency('en-AQ')).toBe('USD');
  });

  it('falls back to USD for a string that is not a language tag', () => {
    expect(localeCurrency('')).toBe('USD');
    expect(localeCurrency('not a tag')).toBe('USD');
  });
});
