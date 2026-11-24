import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { computeReceiptMath } from '../domain/receipt/math';
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

describe('adding a participant', () => {
  it('returns the colour it stores for each participant', () => {
    const store = new ReceiptStore(new Y.Doc());
    const added = ['Alex', 'Sam', 'Jamie'].map((name) => store.addParticipant(name));
    expect(added).toEqual(store.getSnapshot().participants);
    expect(added.map((participant) => participant?.colorIdx)).toEqual([0, 1, 2]);
  });

  it('refuses a name with no letter or digit, and adds nobody', () => {
    const store = new ReceiptStore(new Y.Doc());
    expect(store.addParticipant('!!!')).toBeNull();
    expect(store.getSnapshot().participants).toEqual([]);
  });

  it('gives names in different non-Latin scripts different participants', () => {
    const store = new ReceiptStore(new Y.Doc());
    store.addParticipant('李');
    store.addParticipant('Мария');
    expect(store.getSnapshot().participants.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'p-李', name: '李' },
      { id: 'p-мария', name: 'Мария' },
    ]);
  });

  it('refuses the name of a participant stored under an older id, and keeps their id', () => {
    const doc = new Y.Doc();
    const jose = new Y.Map<unknown>();
    jose.set('id', 'p-jos');
    jose.set('name', 'José');
    jose.set('colorIdx', 0);
    doc.getMap<Y.Map<unknown>>('participants').set('p-jos', jose);
    const store = new ReceiptStore(doc);

    expect(store.addParticipant('josé')).toBeNull();
    expect(store.getSnapshot().participants).toEqual([{ id: 'p-jos', name: 'José', colorIdx: 0 }]);
  });
});
