import { describe, expect, it } from 'vitest';
import {
  buildIngestUrl,
  createRoomId,
  decodeRoomId,
  encodeRoomId,
  parseIngestUrl,
  parseRoomHash,
  parseRoomPath,
  roomPath,
  validateSeed,
} from './seedCodec';

describe('room IDs, paths and ingest links', () => {
  it('creates opaque URL-safe URN room IDs and decodes them from hashes', () => {
    const roomId = createRoomId();
    const encoded = encodeRoomId(roomId);

    expect(roomId).toMatch(/^urn:split:room:[0-9a-f-]{36}$/i);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
    expect(decodeRoomId(encoded)).toBe(roomId);
    expect(parseRoomHash(`#room=${encoded}&seed=seed-value`)).toEqual({
      roomId,
      seed: 'seed-value',
    });
  });

  it('continues to accept room IDs from existing links', () => {
    expect(decodeRoomId('split-legacy')).toBe('split-legacy');
    expect(parseRoomHash('#room=split-legacy')).toEqual({
      roomId: 'split-legacy',
      seed: null,
    });
  });

  it('parses valid uncompressed ingest links from the hash and query string', () => {
    const seed = {
      title: 'Café Ünï – 日本',
      cardTipEur: 0,
      cashTipEur: 1.5,
      bankUsd: 0,
      roster: [],
      items: [{ id: 'item-0', name: 'Crème brûlée', en: 'Crème brûlée', eur: 6 }],
    };
    const encodedSeed = encodeURIComponent(JSON.stringify(seed));

    for (const href of [
      `https://split.detweiler.me/#ingest=${encodedSeed}`,
      `https://split.detweiler.me/?ingest=${encodedSeed}`,
    ]) {
      const parsed = parseIngestUrl(href);
      expect(parsed).not.toBeNull();
      if (!parsed || 'error' in parsed) continue;
      expect(parsed.seed).toEqual(seed);
      expect(parsed.roomId).toMatch(/^urn:split:room:[0-9a-f-]{36}$/i);
      expect(parsed.encodedRoom).not.toContain('=');
      expect(parsed.redirectUrl).toBe(`https://split.detweiler.me/r/${parsed.encodedRoom}`);
    }
  });

  it('parses and builds /r/<room> paths', () => {
    const roomId = createRoomId();
    expect(parseRoomPath(roomPath(roomId))).toBe(roomId);
    expect(parseRoomPath(`${roomPath(roomId)}/`)).toBe(roomId);
    expect(parseRoomPath('/r/split-legacy')).toBe('split-legacy');
    expect(parseRoomPath('/r')).toBeNull();
    expect(parseRoomPath('/r/a/b')).toBeNull();
    expect(parseRoomPath('/r/%E0%A4%A')).toBeNull();
  });

  it('reports malformed JSON and seed validation errors in ingest links', () => {
    expect(parseIngestUrl('https://example.test/#ingest=%7B')).toEqual({
      error: 'The ingest link does not contain valid JSON.',
    });

    const invalidSeed = encodeURIComponent(JSON.stringify({ title: 'Missing items' }));
    const result = parseIngestUrl(`https://example.test/#ingest=${invalidSeed}`);
    expect(result).toEqual({
      error:
        'Receipt data failed validation: Invalid seed: cardTipEur must be a finite number; cashTipEur must be a finite number; bankUsd must be a finite number; roster must be an array of strings; items must be an array.',
    });
    expect(() => validateSeed(null)).toThrow('Seed must be a JSON object.');
  });
});

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
    expect(() => validateSeed({ ...seed, bankUsd: Infinity })).toThrow(
      /bankUsd must be a finite number/,
    );
  });
});

describe('receipt currency in seeds', () => {
  it('defaults to USD for legacy seeds and keeps an explicit currency', async () => {
    const { hydrateFromSeed, validateSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const base = { title: 't', cardTipEur: 0, cashTipEur: 0, bankUsd: 0, roster: [], items: [] };

    const legacy = new Y.Doc();
    hydrateFromSeed(legacy, base);
    expect(new ReceiptStore(legacy).getSnapshot().currency).toBe('USD');

    const jpy = new Y.Doc();
    hydrateFromSeed(jpy, { ...base, currency: 'jpy' });
    expect(new ReceiptStore(jpy).getSnapshot().currency).toBe('JPY');

    expect(() => validateSeed({ ...base, currency: 'XXXX' })).toThrow(/currency/);
    expect(validateSeed({ ...base, currency: 'KWD' }).currency).toBe('KWD');
  });
});
