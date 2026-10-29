import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
// @ts-expect-error plain JS helper without types
import * as gen from '../../skills/receipt-generation/scripts/generate-link.mjs';
import { decodeRoomId, decodeSeed } from '../store/seedCodec';

const seed = {
  title: 'Café Ünï – 日本',
  cardTipEur: 0,
  cashTipEur: 1.5,
  bankUsd: 0,
  roster: [],
  items: [
    { id: 'item-0', name: 'GRIMBERGEN BLONDE (1/2)', en: 'Blonde beer', eur: 6 },
    { id: 'item-1', name: 'GRIMBERGEN BLONDE (2/2)', en: 'Blonde beer', eur: 6 },
  ],
};

describe('generate-link script', () => {
  it('matches lz-string compression and decompression', () => {
    const samples = [JSON.stringify(seed), '', 'a', 'aaaaaaaaaaaaaaaaaaaaaaaa', 'x'.repeat(5000) + 'é€日'];
    for (const s of samples) {
      const c = gen.compressToEncodedURIComponent(s);
      expect(c).toBe(LZString.compressToEncodedURIComponent(s));
      if (s) expect(gen.decompressFromEncodedURIComponent(LZString.compressToEncodedURIComponent(s))).toBe(s);
    }
  });

  it('produces a link the app codec can decode', () => {
    const url = new URL(gen.generateLink(seed));
    const params = new URLSearchParams(url.hash.slice(1));
    expect(decodeRoomId(params.get('room'))).toMatch(/^urn:split:room:[0-9a-f-]{36}$/);
    expect(decodeSeed(params.get('seed'))).toEqual(seed);
  });

  it('rejects invalid seeds', () => {
    expect(() => gen.generateLink({ ...seed, items: [{ id: 'a', name: 'x', en: 'x', eur: NaN }] })).toThrow();
    expect(() => gen.generateLink({ title: 'x' })).toThrow();
  });
});
