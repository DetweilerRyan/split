import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildIngestUrl,
  decodeRoomId,
  decodeSeed,
  encodeRoomId,
  encodeSeed,
  parseIngestUrl,
  parseRoomHash,
  parseRoomPath,
  pendingSeedKey,
  roomPath,
} from './seedCodec';
import { createRoomId, roomIdSchema } from '../domain/room/roomId';
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
  });
});

const seed = {
  title: 'Taverna',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  roster: [],
  items: [{ id: 'item-0', name: 'Taco (1/2)', en: 'Taco', eur: 5 }],
} as const;

describe('ingest links', () => {
  it('round-trips a built ingest link through parseIngestUrl', () => {
    const url = buildIngestUrl('https://split.detweiler.me/', seed);
    expect(url.startsWith('https://split.detweiler.me/ingest#ingest=')).toBe(true);
    const parsed = parseIngestUrl(url);
    expect(parsed && 'seed' in parsed && parsed.seed).toEqual(seed);
  });
});

describe('decoding a seed', () => {
  it('decodes a seed as JSON or compressed', () => {
    expect(decodeSeed(JSON.stringify(seed))).toEqual(seed);
    expect(decodeSeed(encodeSeed(seed))).toEqual(seed);
  });

  it.each([
    ['nothing', null],
    ['text that holds no seed', 'not a seed'],
    ['a seed with only a title and items', JSON.stringify({ title: 'No roster', items: [] })],
    ['a seed whose item has no price', JSON.stringify({ ...seed, items: [{ id: 'item-0' }] })],
    ['a compressed seed with no roster', encodeSeed({ ...seed, roster: undefined } as never)],
  ])('refuses %s', (_, value) => {
    expect(decodeSeed(value)).toBeNull();
  });
});

describe('receipt currency in seeds', () => {
  it('defaults to USD for legacy seeds and keeps an explicit currency', async () => {
    const { hydrateFromSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const base = { title: 't', cardTipEur: 0, cashTipEur: 0, bankUsd: 0, roster: [], items: [] };

    const legacy = new Y.Doc();
    hydrateFromSeed(legacy, base);
    expect(new ReceiptStore(legacy).getSnapshot().currency).toBe('USD');

    const jpy = new Y.Doc();
    hydrateFromSeed(jpy, { ...base, currency: 'jpy' });
    expect(new ReceiptStore(jpy).getSnapshot().currency).toBe('JPY');
  });
});

describe('seed hydration into a room that already has data', () => {
  it('fills in the fields an item already in the room is missing, and keeps the rest', async () => {
    const { hydrateFromSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const doc = new Y.Doc();
    const stored = new Y.Map<unknown>();
    stored.set('name', 'Edited taco');
    doc.getMap('items').set('item-0', stored);

    hydrateFromSeed(doc, seed);
    expect(new ReceiptStore(doc).getSnapshot().items).toEqual([
      { id: 'item-0', name: 'Edited taco', en: 'Taco', eur: 5, order: 0, claims: {} },
    ]);
  });

  it('keeps a display currency and its rate from the seed', async () => {
    const { hydrateFromSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const doc = new Y.Doc();

    hydrateFromSeed(doc, { ...seed, displayCurrency: 'usd', rate: 1.08, rateDate: '2026-11-01' });
    const snapshot = new ReceiptStore(doc).getSnapshot();
    expect([snapshot.displayCurrency, snapshot.rate, snapshot.rateDate]).toEqual([
      'USD',
      1.08,
      '2026-11-01',
    ]);
  });
});

describe('the roster in seeds', () => {
  const base = { title: 't', cardTipEur: 0, cashTipEur: 0, bankUsd: 0, items: [] };

  it('adds nobody for a roster name with no letter or digit', async () => {
    const { hydrateFromSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const doc = new Y.Doc();
    hydrateFromSeed(doc, { ...base, roster: ['李', '!!!', 'Мария'] });
    expect(new ReceiptStore(doc).getSnapshot().participants.map(({ id }) => id)).toEqual([
      'p-李',
      'p-мария',
    ]);
  });

  it('keeps a participant stored under an older id, rather than adding them again', async () => {
    const { hydrateFromSeed } = await import('./seedCodec');
    const { ReceiptStore } = await import('./useReceiptStore');
    const Y = await import('yjs');
    const doc = new Y.Doc();
    const jose = new Y.Map<unknown>();
    jose.set('id', 'p-jos');
    jose.set('name', 'José');
    jose.set('colorIdx', 0);
    doc.getMap('participants').set('p-jos', jose);

    hydrateFromSeed(doc, { ...base, roster: ['José', 'Sam'] });
    expect(new ReceiptStore(doc).getSnapshot().participants.map(({ id }) => id)).toEqual([
      'p-jos',
      'p-sam',
    ]);
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
