import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildIngestUrl,
  decodeRoomId,
  encodeRoomId,
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
