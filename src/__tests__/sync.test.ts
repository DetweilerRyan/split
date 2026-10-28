import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { PICASSO_SEED } from '../data/presets';
import { computeReceiptMath } from '../utils/math';
import {
  createRoomId,
  decodeRoomId,
  decodeSeed,
  encodeRoomId,
  encodeSeed,
  hydrateFromSeed,
  parseRoomHash,
} from '../store/seedCodec';
import { ReceiptStore } from '../store/useReceiptStore';

describe('Yjs synchronization and seed hydration', () => {
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

  it('publishes nested item changes through the deep-observed store', () => {
    const doc = new Y.Doc();
    hydrateFromSeed(doc, PICASSO_SEED);
    const store = new ReceiptStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);

    doc.getMap<Y.Map<unknown>>('items').get('item-0')?.set('name', 'Updated item');

    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().items[0].name).toBe('Updated item');
    doc.destroy();
  });

  it('merges claims from peers that independently hydrate the same seed', () => {
    const seedString = encodeSeed(PICASSO_SEED);
    const seed = decodeSeed(seedString);
    expect(seed).not.toBeNull();
    if (!seed) return;

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    hydrateFromSeed(docA, seed);
    hydrateFromSeed(docB, seed);

    const originalItem = docA.getMap('items').get('item-0');
    docA.getMap<boolean>('claims').set('item-0::p-ryan', true);
    docB.getMap<boolean>('claims').set('item-0::p-jameson', true);
    docB.getMap<boolean>('claims').set('item-1::p-jameson', true);

    hydrateFromSeed(docA, seed);
    expect(docA.getMap('items').get('item-0')).toBe(originalItem);
    expect(docA.getMap<boolean>('claims').get('item-0::p-ryan')).toBe(true);

    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));

    const snapshotA = new ReceiptStore(docA).getSnapshot();
    const snapshotB = new ReceiptStore(docB).getSnapshot();
    expect(snapshotA).toEqual(snapshotB);
    expect(snapshotA.items.find((item) => item.id === 'item-0')?.claims).toEqual({
      'p-ryan': true,
      'p-jameson': true,
    });
    expect(snapshotA.items.find((item) => item.id === 'item-1')?.claims['p-jameson']).toBe(true);

    const math = computeReceiptMath(snapshotA);
    expect(math.perPerson['p-ryan'].itemsSubtotalEur).toBe(3);
    expect(math.perPerson['p-jameson'].itemsSubtotalEur).toBe(9);
    docA.destroy();
    docB.destroy();
  });
});
