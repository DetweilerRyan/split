import { afterEach, assert, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as Y from 'yjs';
import { computeReceiptMath } from '../domain/receipt/math';
import { receiptSeedSchema } from '../domain/receipt/receiptSeed';
import { itemIdSchema, participantIdSchema } from '../domain/receipt/roomSnapshot';
import { decodeSeed, encodeSeed, hydrateFromSeed } from './seedCodec';
import { type ClaimKey, ReceiptStore, claimKey } from './useReceiptStore';

const alex = participantIdSchema.parse('p-alex');
const sam = participantIdSchema.parse('p-sam');

describe('Yjs synchronization and seed hydration', () => {
  const sampleSeed = receiptSeedSchema.parse({
    title: 'Sample receipt',
    cardTipEur: 0,
    cashTipEur: 0,
    bankUsd: 0,
    roster: ['Alex', 'Sam'],
    items: [
      { id: 'item-0', name: 'Coffee', en: 'Coffee', eur: 6 },
      { id: 'item-1', name: 'Tea', en: 'Tea', eur: 6 },
    ],
  });

  it('publishes nested item changes through the deep-observed store', () => {
    const doc = new Y.Doc();
    hydrateFromSeed(doc, sampleSeed);
    const store = new ReceiptStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);

    doc.getMap<Y.Map<unknown>>('items').get('item-0')?.set('name', 'Updated item');

    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().items[0]?.name).toBe('Updated item');
    doc.destroy();
  });

  it('merges claims from peers that independently hydrate the same seed', () => {
    const seedString = encodeSeed(sampleSeed);
    const seed = decodeSeed(seedString);
    expect(seed).not.toBeNull();
    if (seed === null) return;

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
    expect(snapshotA.items.find((item) => item.id === 'item-1')?.claims[sam]).toBe(true);

    const math = computeReceiptMath(snapshotA);
    expect(math.perPerson[alex]?.itemsSubtotal).toBe(3);
    expect(math.perPerson[sam]?.itemsSubtotal).toBe(9);
    docA.destroy();
    docB.destroy();
  });
});

describe('hydrating a seed through the store', () => {
  it("writes the seed into the store's own document, and resets it when asked", () => {
    const store = new ReceiptStore(new Y.Doc());
    const seed = receiptSeedSchema.parse({
      title: 'Lunch',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      roster: ['Alex'],
      items: [{ id: 'item-0', name: 'Soup', en: 'Soup', eur: 5 }],
    });
    store.addItem('Bread', '', 3);
    store.hydrateSeed(seed);
    expect(store.getSnapshot().title).toBe('Lunch');
    expect(
      store
        .getSnapshot()
        .items.map((item) => item.name)
        .toSorted(),
    ).toStrictEqual(['Bread', 'Soup']);
    store.hydrateSeed(seed, { forceReset: true });
    expect(store.getSnapshot().items.map((item) => item.name)).toStrictEqual(['Soup']);
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

describe('removing a participant', () => {
  it("deletes their claims from the room, and keeps everyone else's", () => {
    const doc = new Y.Doc();
    const store = new ReceiptStore(doc);
    store.addItem('Pizza', '', 10);
    store.addItem('Bread', '', 3);
    const alex = store.addParticipant('Alex');
    const sam = store.addParticipant('Sam');
    const pizza = store.getSnapshot().items.find((item) => item.name === 'Pizza');
    const bread = store.getSnapshot().items.find((item) => item.name === 'Bread');
    assert(alex !== null && sam !== null && pizza !== undefined && bread !== undefined);
    store.setClaims(pizza.id, [alex.id, sam.id], true);
    store.toggleClaim(bread.id, sam.id);

    store.removeParticipant(sam.id);

    function claimsOf(name: string) {
      return store.getSnapshot().items.find((item) => item.name === name)?.claims;
    }
    expect(claimsOf('Pizza')).toStrictEqual({ [alex.id]: true });
    expect(claimsOf('Bread')).toStrictEqual({ [alex.id]: false });
    expect([...doc.getMap<boolean>('claims').keys()]).toStrictEqual([claimKey(pizza.id, alex.id)]);
  });
});

describe('ids stored in the document', () => {
  // A stored participant, item or claim whose id doesn't parse is left out of what the app
  // reads, with a warning, and the document is left as it is, as the owner chose on #124.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function storeParticipant(doc: Y.Doc, key: string, id: unknown, name: string) {
    const participant = new Y.Map<unknown>();
    participant.set('id', id);
    participant.set('name', name);
    participant.set('colorIdx', 0);
    doc.getMap<Y.Map<unknown>>('participants').set(key, participant);
  }

  function storeItem(doc: Y.Doc, key: string, id: unknown) {
    const item = new Y.Map<unknown>();
    item.set('id', id);
    item.set('name', 'Soup');
    item.set('eur', 4);
    item.set('order', 0);
    doc.getMap<Y.Map<unknown>>('items').set(key, item);
  }

  it('leaves out a participant stored as p-, and its claims, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const doc = new Y.Doc();
    storeParticipant(doc, 'p-', 'p-', 'Мария');
    storeParticipant(doc, 'p-sam', 'p-sam', 'Sam');
    storeItem(doc, 'item-0', 'item-0');
    doc.getMap<boolean>('claims').set('item-0::p-', true);
    doc.getMap<boolean>('claims').set('item-0::p-sam', true);

    const snapshot = new ReceiptStore(doc).getSnapshot();

    expect(snapshot.participants).toEqual([{ id: 'p-sam', name: 'Sam', colorIdx: 0 }]);
    expect(snapshot.items[0]?.claims).toEqual({ 'p-sam': true });
    expect(warn).toHaveBeenCalledWith(
      'SplitSmart left out the participant stored as "p-", and its claims: that isn\'t a participant id.',
    );
    expect(doc.getMap('participants').has('p-')).toBe(true);
    expect(doc.getMap('claims').get('item-0::p-')).toBe(true);
  });

  it('leaves out a participant whose id field is a malformed string, under a good key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const doc = new Y.Doc();
    storeParticipant(doc, 'p-sam', 'Sam Lee', 'Sam');

    expect(new ReceiptStore(doc).getSnapshot().participants).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'SplitSmart left out the participant stored as "Sam Lee", and its claims: that isn\'t a participant id.',
    );
  });

  it("reads a participant whose id field isn't text by its key, as before ids had a type", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const doc = new Y.Doc();
    storeParticipant(doc, 'p-sam', 42, 'Sam');

    expect(new ReceiptStore(doc).getSnapshot().participants).toEqual([
      { id: 'p-sam', name: 'Sam', colorIdx: 0 },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves out an item whose id is longer than 64 characters, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const doc = new Y.Doc();
    const long = 'x'.repeat(65);
    storeItem(doc, long, long);
    storeItem(doc, 'item-0', 'item-0');

    const snapshot = new ReceiptStore(doc).getSnapshot();

    expect(snapshot.items.map(({ id }) => id)).toEqual(['item-0']);
    expect(warn).toHaveBeenCalledWith(
      `SplitSmart left out the item stored as "${long}", and its claims: that isn't an item id.`,
    );
    expect(doc.getMap('items').has(long)).toBe(true);
  });

  it('adds a participant whose name was stored under p-, since the one stored there is left out', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const doc = new Y.Doc();
    storeParticipant(doc, 'p-', 'p-', 'Мария');
    const store = new ReceiptStore(doc);

    expect(store.addParticipant('Мария')).toEqual({ id: 'p-мария', name: 'Мария', colorIdx: 1 });
    expect(store.getSnapshot().participants.map(({ id }) => id)).toEqual(['p-мария']);
  });

  it('skips an entry that is not a map, and reads a missing field as its fallback', () => {
    const doc = new Y.Doc();
    doc.getMap<unknown>('participants').set('p-ghost', 'not a map');
    doc.getMap<unknown>('items').set('item-ghost', 'not a map');
    const zoe = new Y.Map<unknown>();
    zoe.set('name', 'Zoe');
    doc.getMap<Y.Map<unknown>>('participants').set('p-zoe', zoe);
    storeParticipant(doc, 'p-amy', 'p-amy', 'Amy');
    const legacyClaims = new Y.Map<boolean>();
    const bread = new Y.Map<unknown>();
    bread.set('claims', legacyClaims);
    doc.getMap<Y.Map<unknown>>('items').set('bread', bread);
    legacyClaims.set('p-zoe', true);

    const snapshot = new ReceiptStore(doc).getSnapshot();

    expect(snapshot.participants).toEqual([
      { id: 'p-amy', name: 'Amy', colorIdx: 0 },
      { id: 'p-zoe', name: 'Zoe', colorIdx: 0 },
    ]);
    expect(snapshot.items).toEqual([
      {
        id: 'bread',
        name: 'Item',
        en: '',
        eur: 0,
        order: 999,
        claims: { 'p-amy': false, 'p-zoe': true },
      },
    ]);
  });

  it('reads a participant with no name as Friend, and orders participants by colour, then id', () => {
    const doc = new Y.Doc();
    const participants = doc.getMap<Y.Map<unknown>>('participants');
    [
      { id: 'p-cy', colorIdx: 1 },
      { id: 'p-bo', colorIdx: 0 },
      { id: 'p-al', colorIdx: 1 },
    ].forEach(({ id, colorIdx }) => {
      const participant = new Y.Map<unknown>();
      participant.set('id', id);
      participant.set('colorIdx', colorIdx);
      participants.set(id, participant);
    });

    expect(new ReceiptStore(doc).getSnapshot().participants).toEqual([
      { id: 'p-bo', name: 'Friend', colorIdx: 0 },
      { id: 'p-al', name: 'Friend', colorIdx: 1 },
      { id: 'p-cy', name: 'Friend', colorIdx: 1 },
    ]);
  });

  it('orders items by order, and by id when orders tie or one is not a number', () => {
    const doc = new Y.Doc();
    const items = doc.getMap<Y.Map<unknown>>('items');
    [
      { id: 'item-d', order: 1 },
      { id: 'item-c', order: 'first' },
      { id: 'item-b', order: 0 },
      { id: 'item-a', order: 1 },
    ].forEach(({ id, order }) => {
      const item = new Y.Map<unknown>();
      item.set('id', id);
      item.set('order', order);
      items.set(id, item);
    });

    expect(new ReceiptStore(doc).getSnapshot().items.map(({ id }) => id)).toEqual([
      'item-b',
      'item-a',
      'item-c',
      'item-d',
    ]);
  });

  it('reads a claim from the claims map over one stored on the item', () => {
    const doc = new Y.Doc();
    storeParticipant(doc, 'p-sam', 'p-sam', 'Sam');
    storeParticipant(doc, 'p-amy', 'p-amy', 'Amy');
    storeItem(doc, 'item-0', 'item-0');
    const legacyClaims = new Y.Map<boolean>();
    legacyClaims.set('p-sam', true);
    legacyClaims.set('p-amy', true);
    doc.getMap<Y.Map<unknown>>('items').get('item-0')?.set('claims', legacyClaims);
    doc.getMap<boolean>('claims').set('item-0::p-sam', false);

    expect(new ReceiptStore(doc).getSnapshot().items[0]?.claims).toEqual({
      'p-amy': true,
      'p-sam': false,
    });
  });

  it('claims with keys built from an item id and a participant id', () => {
    const store = new ReceiptStore(new Y.Doc());
    store.addParticipant('Sam');
    store.addItem('Soup', 'Soup', 4);
    const [item] = store.getSnapshot().items;
    assert(item !== undefined, 'the item was added');

    store.toggleClaim(item.id, sam);

    expect(claimKey(item.id, sam)).toBe(`${item.id}::p-sam`);
    expect(store.getSnapshot().items[0]?.claims).toEqual({ 'p-sam': true });
  });

  // Each @ts-expect-error fails `npm run typecheck` if the line it marks ever type-checks.
  it('rejects a plain string where a participant id, an item id or a claim key is meant', () => {
    const item = itemIdSchema.parse('item-0');

    expectTypeOf<ReceiptStore['toggleClaim']>().toBeCallableWith(item, sam);
    // @ts-expect-error a plain string is not an ItemId
    expectTypeOf<ReceiptStore['toggleClaim']>().toBeCallableWith('item-0', sam);
    // @ts-expect-error a plain string is not a ParticipantId
    expectTypeOf<ReceiptStore['toggleClaim']>().toBeCallableWith(item, 'p-sam');
    // @ts-expect-error a participant id is not an item id
    expectTypeOf<ReceiptStore['deleteItem']>().toBeCallableWith(sam);
    // @ts-expect-error a key written by hand is not a ClaimKey
    const handWritten: ClaimKey = 'item-0::p-sam';
    expect(handWritten).toBeTypeOf('string');
  });
});
