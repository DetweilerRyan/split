import { describe, expect, it } from 'vitest';
import { buildIngestUrl, parseIngestUrl, validateSeed } from '../store/seedCodec';
import { isRateLimited } from '../server/rateLimit';

const seed = {
  title: 'Taverna',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  roster: [],
  items: [{ id: 'item-0', name: 'Taco (1/2)', en: 'Taco', eur: 5 }],
};

describe('seed schema and ingest links', () => {
  it('round-trips a built ingest link through parseIngestUrl', () => {
    const url = buildIngestUrl('https://split.detweiler.me/', seed);
    expect(url.startsWith('https://split.detweiler.me/ingest#ingest=')).toBe(true);
    const parsed = parseIngestUrl(url);
    expect(parsed && 'seed' in parsed && parsed.seed).toEqual(seed);
  });

  it('reports indexed paths and duplicate ids', () => {
    const bad = { ...seed, items: [seed.items[0], { ...seed.items[0] }, { id: 'x', name: 1 }] };
    expect(() => validateSeed(bad)).toThrow(
      /items\[2\]\.name must be a string; items\[2\]\.en must be a string; items\[2\]\.eur must be a finite number; items\[1\]\.id "item-0" is duplicated/,
    );
  });

  it('rejects oversized payloads and non-finite amounts', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ ...seed.items[0], id: `item-${i}` }));
    expect(() => validateSeed({ ...seed, items: many })).toThrow(/items must have at most 200/);
    expect(() => validateSeed({ ...seed, bankUsd: Infinity })).toThrow(/bankUsd must be a finite number/);
  });
});

describe('isRateLimited', () => {
  it('blocks after the limit within the window and recovers after it', () => {
    expect(isRateLimited('k', 2, 1000, 0)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 1)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 2)).toBe(true);
    expect(isRateLimited('k', 2, 1000, 2000)).toBe(false);
  });
});
