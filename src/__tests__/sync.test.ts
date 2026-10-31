import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { computeReceiptMath } from '../utils/math';
import {
  createRoomId,
  decodeRoomId,
  decodeSeed,
  encodeRoomId,
  encodeSeed,
  hydrateFromSeed,
  parseIngestUrl,
  parseRoomHash,
  validateSeed,
} from '../store/seedCodec';
import { ReceiptStore } from '../store/useReceiptStore';

describe('Yjs synchronization and seed hydration', () => {
  const sampleSeed = {
    title: 'Sample receipt',
    cardTipEur: 0,
    cashTipEur: 0,
    bankUsd: 0,
    roster: ['Alex', 'Sam'],
    items: [
      { id: 'item-0', name: 'Coffee', en: 'Coffee', eur: 6 },
      { id: 'item-1', name: 'Tea', en: 'Tea', eur: 6 },
    ],
  };

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
      expect(parsed.redirectUrl).toBe(
        `https://split.detweiler.me/#room=${parsed.encodedRoom}`,
      );
    }
  });

  it('reports malformed JSON and seed validation errors in ingest links', () => {
    expect(parseIngestUrl('https://example.test/#ingest=%7B'))
      .toEqual({ error: 'The ingest link does not contain valid JSON.' });

    const invalidSeed = encodeURIComponent(JSON.stringify({ title: 'Missing items' }));
    const result = parseIngestUrl(`https://example.test/#ingest=${invalidSeed}`);
    expect(result).toEqual({
      error: 'Receipt data failed validation: Invalid seed: cardTipEur must be a finite number; cashTipEur must be a finite number; bankUsd must be a finite number; roster must be an array of strings; items must be an array.',
    });
    expect(() => validateSeed(null)).toThrow('Seed must be a JSON object.');
  });

  it('publishes nested item changes through the deep-observed store', () => {
    const doc = new Y.Doc();
    hydrateFromSeed(doc, sampleSeed);
    const store = new ReceiptStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);

    doc.getMap<Y.Map<unknown>>('items').get('item-0')?.set('name', 'Updated item');

    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().items[0].name).toBe('Updated item');
    doc.destroy();
  });

  it('merges claims from peers that independently hydrate the same seed', () => {
    const seedString = encodeSeed(sampleSeed);
    const seed = decodeSeed(seedString);
    expect(seed).not.toBeNull();
    if (!seed) return;

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    hydrateFromSeed(docA, seed);
    hydrateFromSeed(docB, seed);

    const originalItem = docA.getMap('items').get('item-0');
    docA.getMap<boolean>('claims').set('item-0::p-alex', true);
    docB.getMap<boolean>('claims').set('item-0::p-sam', true);
    docB.getMap<boolean>('claims').set('item-1::p-sam', true);

    hydrateFromSeed(docA, seed);
    expect(docA.getMap('items').get('item-0')).toBe(originalItem);
    expect(docA.getMap<boolean>('claims').get('item-0::p-alex')).toBe(true);

    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));

    const snapshotA = new ReceiptStore(docA).getSnapshot();
    const snapshotB = new ReceiptStore(docB).getSnapshot();
    expect(snapshotA).toEqual(snapshotB);
    expect(snapshotA.items.find((item) => item.id === 'item-0')?.claims).toEqual({
      'p-alex': true,
      'p-sam': true,
    });
    expect(snapshotA.items.find((item) => item.id === 'item-1')?.claims['p-sam']).toBe(true);

    const math = computeReceiptMath(snapshotA);
    expect(math.perPerson['p-alex'].itemsSubtotalEur).toBe(3);
    expect(math.perPerson['p-sam'].itemsSubtotalEur).toBe(9);
    docA.destroy();
    docB.destroy();
  });
});
