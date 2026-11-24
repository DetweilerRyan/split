import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildIngestUrl,
  createRoomId,
  decodeRoomId,
  encodeRoomId,
  parseIngestUrl,
  parseRoomHash,
  parseRoomId,
  parseRoomPath,
  pendingSeedKey,
  roomIdSchema,
  roomPath,
  validateSeed,
} from './seedCodec';
import { savedIdentityKey, type SavedIdentityKey } from './savedIdentity';
import { getRoomProvider, indexedDbName } from './yjsProvider';

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
    expect(decodeRoomId('split-k3x9')).toBe('split-k3x9');
    expect(parseRoomHash('#room=split-k3x9')).toEqual({
      roomId: 'split-k3x9',
      seed: null,
    });
  });

  it('rejects room IDs that the app never generated, such as one typed into an old link', () => {
    expect(decodeRoomId('split-legacy')).toBeNull();
    expect(parseRoomHash('#room=split-legacy')).toEqual({ roomId: null, seed: null });
    expect(parseRoomPath('/r/split-legacy')).toBeNull();
    expect(decodeRoomId('not-a-room')).toBeNull();
  });

  it('keeps the pending-seed key the app has always used', () => {
    const roomId = decodeRoomId('urn:split:room:3f2b1c4d-1111-4222-8333-444455556666')!;
    expect(pendingSeedKey(roomId)).toBe(
      'splitsmart-ingest-urn:split:room:3f2b1c4d-1111-4222-8333-444455556666',
    );
    expect(pendingSeedKey(decodeRoomId('split-k3x9')!)).toBe('splitsmart-ingest-split-k3x9');
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
    expect(parseRoomPath('/r/split-k3x9')).toBe('split-k3x9');
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

const uuidRoomId = 'urn:split:room:3f2b1c4d-1111-4222-8333-444455556666';

describe('parseRoomId', () => {
  it('accepts a UUID room id', () => {
    expect(parseRoomId(uuidRoomId)).toBe(uuidRoomId);
  });

  it('accepts a UUID room id in upper case, as the old pattern did', () => {
    expect(
      parseRoomId(uuidRoomId.toUpperCase().replace('URN:SPLIT:ROOM:', 'urn:split:room:')),
    ).not.toBeNull();
  });

  it.each(['split-a', 'split-k3', 'split-k3x', 'split-k3x9'])(
    'accepts the generated legacy id %s',
    (legacy) => {
      expect(parseRoomId(legacy)).toBe(legacy);
    },
  );

  it.each([
    ['a hand-written legacy id', 'split-legacy'],
    ['an upper-case legacy id', 'split-K3X9'],
    ['a legacy prefix with nothing after it', 'split-'],
    ['an arbitrary string', 'room-1'],
    ['an empty string', ''],
    ['an encoded room segment', btoa(uuidRoomId).replace(/=+$/, '')],
    ['a storage key', `splitsmart-user-${uuidRoomId}`],
  ])('rejects %s', (_label, value) => {
    expect(parseRoomId(value)).toBeNull();
  });

  it('rejects values that are not strings', () => {
    expect(parseRoomId(null)).toBeNull();
    expect(parseRoomId(42)).toBeNull();
  });
});

describe('roomIdSchema', () => {
  it('throws on an invalid room id, naming the two accepted forms', () => {
    expect(() => roomIdSchema.parse('room-1')).toThrow(/urn:split:room:<uuid>.*split-/);
  });
});

describe('RoomId at compile time', () => {
  // Each @ts-expect-error fails `npm run typecheck` if the call it marks ever type-checks:
  // a plain string, or the URL's encoded segment, must not stand in for a room id.
  it('rejects a plain string where a room id is meant', () => {
    const roomId = roomIdSchema.parse('split-k3x9');
    const encodedSegment: string = encodeRoomId(createRoomId());

    expectTypeOf(roomPath).toBeCallableWith(roomId);
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(roomPath).toBeCallableWith('split-k3x9');
    // @ts-expect-error the encoded URL segment is not a RoomId
    expectTypeOf(getRoomProvider).toBeCallableWith(encodedSegment);
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(pendingSeedKey).toBeCallableWith('split-k3x9');
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(savedIdentityKey).toBeCallableWith('split-k3x9');
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(indexedDbName).toBeCallableWith('split-k3x9');
    // @ts-expect-error a key written by hand is not a SavedIdentityKey
    const handWritten: SavedIdentityKey = 'splitsmart-user-split-k3x9';
    expect(handWritten).toBeTypeOf('string');
  });
});
