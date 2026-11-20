import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { computeReceiptMath } from '../utils/math';
import { decodeSeed, encodeSeed, hydrateFromSeed } from './seedCodec';
import { ReceiptStore } from './useReceiptStore';

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
    expect(math.perPerson['p-alex'].itemsSubtotal).toBe(3);
    expect(math.perPerson['p-sam'].itemsSubtotal).toBe(9);
    docA.destroy();
    docB.destroy();
  });
});
