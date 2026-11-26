import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { z } from 'zod';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../domain/money/currency';
import {
  type ItemId,
  type Participant,
  type ParticipantId,
  type ReceiptItem,
  type RoomSnapshot,
  findParticipant,
  itemIdSchema,
  parseItemId,
  participantId,
} from '../domain/receipt/roomSnapshot';
import type { ReceiptSeed } from '../domain/receipt/receiptSeed';
import { type HydrationOptions, hydrateFromSeed } from './seedCodec';
import { storedParticipantId, storedParticipants } from './storedParticipants';
import { storedTextSchema } from './storedText';
import { numberOrZeroSchema } from '@/utils/schemas/numberOrZero';

/** The key of a participant's claim on an item in the room's `claims` map. */
export type ClaimKey = `${ItemId}::${ParticipantId}`;

export function claimKey(itemId: ItemId, participantId: ParticipantId): ClaimKey {
  return `${itemId}::${participantId}` as const;
}

/**
 * The room's details as a peer stored them in `meta`, each field with its fallback. Every field
 * catches, so parsing never fails: a missing or malformed value reads as its fallback, and keys
 * the app doesn't know are left out.
 */
const storedMetaSchema = z
  .object({
    title: storedTextSchema('European Receipt'),
    address: storedTextSchema(''),
    phone: storedTextSchema(''),
    website: storedTextSchema(''),
    purchasedAt: storedTextSchema(''),
    mealType: storedTextSchema(''),
    cardTipEur: numberOrZeroSchema,
    cashTipEur: numberOrZeroSchema,
    bankUsd: numberOrZeroSchema,
    currency: z.unknown().optional().transform(normalizeCurrency),
    displayCurrency: storedTextSchema(''),
    rate: numberOrZeroSchema,
    rateDate: storedTextSchema(''),
  })
  .readonly();

/** A participant's fields besides its id, as a peer stored them, each with its fallback. */
const storedParticipantSchema = z
  .object({
    id: z.unknown().optional(),
    name: storedTextSchema('Friend'),
    colorIdx: numberOrZeroSchema,
  })
  .readonly();

/**
 * An item's fields besides its id and claims, as a peer stored them, each with its fallback. An
 * `order` that isn't a number reads as `NaN`, and the snapshot then sorts the item by its id.
 */
const storedItemSchema = z
  .object({
    id: z.unknown().optional(),
    name: storedTextSchema('Item'),
    en: storedTextSchema(''),
    eur: numberOrZeroSchema,
    order: z
      .unknown()
      .optional()
      .transform((order) => Number(order ?? 999)),
  })
  .readonly();

/**
 * The id of an item stored in the room's `items` map under `key`: its `id` field, or `key` when
 * that isn't text. `null`, with a console warning naming it, when that isn't an item id, which
 * leaves the item and its claims out of the snapshot, as the owner chose on #124.
 */
function storedItemId(value: unknown, key: string): ItemId | null {
  const stored = storedTextSchema(key).parse(value);
  const id = parseItemId(stored);
  if (id === null) {
    console.warn(
      `SplitSmart left out the item stored as ${JSON.stringify(stored)}, and its claims: that isn't an item id.`,
    );
  }
  return id;
}

/**
 * The participant stored in the room's `participants` map under `key`, with a fallback for each
 * field. `null` when the entry isn't a map, or when its id doesn't parse, as `storedParticipantId`
 * says.
 */
function storedParticipant(map: unknown, key: string): Participant | null {
  if (!(map instanceof Y.Map)) return null;
  const { id: storedId, ...fields } = storedParticipantSchema.parse(map.toJSON());
  const id = storedParticipantId(storedId, key);
  return id === null ? null : { id, ...fields };
}

/**
 * The item stored in the room's `items` map under `key`, with a fallback for each field, and each
 * participant's claim on it: the one in the room's `claims` map, else the one an older version
 * stored on the item itself. `null` when the entry isn't a map, or when its id doesn't parse, as
 * `storedItemId` says.
 */
function storedItem(
  map: unknown,
  key: string,
  participants: readonly Participant[],
  claims: Y.Map<boolean>,
): ReceiptItem | null {
  if (!(map instanceof Y.Map)) return null;
  const { id: storedId, ...fields } = storedItemSchema.parse(map.toJSON());
  const id = storedItemId(storedId, key);
  if (id === null) return null;
  const legacyClaims: unknown = map.get('claims');
  const claimState: Record<ParticipantId, boolean> = {};
  participants.forEach(({ id: participantId }) => {
    const claim = claimKey(id, participantId);
    claimState[participantId] = claims.has(claim)
      ? claims.get(claim) === true
      : legacyClaims instanceof Y.Map && legacyClaims.get(participantId) === true;
  });
  return { id, ...fields, claims: claimState };
}

const configuredProvider: RoomSnapshot['connection']['provider'] =
  (process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim() ?? '') !== '' ? 'Liveblocks' : 'WebRTC';

export const EMPTY_SNAPSHOT: RoomSnapshot = {
  title: 'Loading receipt…',
  address: '',
  phone: '',
  website: '',
  purchasedAt: '',
  mealType: '',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  currency: DEFAULT_CURRENCY,
  displayCurrency: '',
  rate: 0,
  rateDate: '',
  participants: [],
  items: [],
  connection: { provider: configuredProvider, status: 'connecting' },
  peers: [],
};

// oxlint-disable-next-line functional/no-classes -- it wraps Yjs's own stateful types (a Y.Doc and its Y.Maps) for useSyncExternalStore, as the owner decided on #83.
export class ReceiptStore {
  private readonly meta: Y.Map<unknown>;
  private readonly participants: Y.Map<Y.Map<unknown>>;
  private readonly items: Y.Map<Y.Map<unknown>>;
  private readonly claims: Y.Map<boolean>;
  private listeners = new Set<() => void>();
  private connection: RoomSnapshot['connection'] = {
    provider: configuredProvider,
    status: 'connecting',
  };
  private peers: RoomSnapshot['peers'] = [];
  private snapshot: RoomSnapshot;

  constructor(private readonly ydoc: Y.Doc) {
    this.meta = ydoc.getMap('meta');
    this.participants = ydoc.getMap('participants');
    this.items = ydoc.getMap('items');
    this.claims = ydoc.getMap('claims');
    this.snapshot = this.createSnapshot();
    [this.meta, this.participants, this.items, this.claims].forEach((map) => {
      map.observeDeep(() => this.publish());
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): RoomSnapshot => this.snapshot;

  setPeers(peers: RoomSnapshot['peers']): void {
    this.peers = peers;
    this.publish();
  }

  setConnection(connection: RoomSnapshot['connection']): void {
    this.connection = connection;
    this.publish();
  }

  setMeta(
    key:
      | 'title'
      | 'cardTipEur'
      | 'cashTipEur'
      | 'bankUsd'
      | 'currency'
      | 'displayCurrency'
      | 'rate'
      | 'rateDate',
    value: string | number,
  ): void {
    this.meta.set(key, value);
  }

  setExchangeRate(displayCurrency: string, rate: number, rateDate: string): void {
    this.ydoc.transact(() => {
      this.meta.set('displayCurrency', displayCurrency);
      this.meta.set('rate', rate);
      this.meta.set('rateDate', rateDate);
    });
  }

  /**
   * Adds a participant with this name, and returns it. Returns `null`, and adds nobody, when the
   * name has no letter or digit, or when it stands for a participant already on the bill.
   */
  addParticipant(name: string): Participant | null {
    const trimmed = name.trim();
    const id = participantId(trimmed);
    if (id === null || this.participants.has(id)) return null;
    if (findParticipant(storedParticipants(this.participants), trimmed) !== undefined) return null;
    const colorIdx = this.participants.size % 7;
    const participant = new Y.Map<unknown>();
    participant.set('id', id);
    participant.set('name', trimmed);
    participant.set('colorIdx', colorIdx);
    this.participants.set(id, participant);
    return { id, name: trimmed, colorIdx };
  }

  removeParticipant(id: ParticipantId): void {
    this.ydoc.transact(() => {
      this.participants.delete(id);
      this.claims.forEach((_value, key) => {
        if (key.endsWith(`::${id}`)) this.claims.delete(key);
      });
    });
  }

  toggleClaim(itemId: ItemId, participantId: ParticipantId): void {
    const key = claimKey(itemId, participantId);
    const item = this.items.get(itemId);
    if (item === undefined) return;
    const legacyClaims = item.get('claims');
    const legacyValue =
      legacyClaims instanceof Y.Map ? legacyClaims.get(participantId) === true : false;
    const current = this.claims.has(key) ? this.claims.get(key) === true : legacyValue;
    this.claims.set(key, !current);
  }

  setClaims(itemId: ItemId, participantIds: readonly ParticipantId[], selected: boolean): void {
    this.ydoc.transact(() => {
      participantIds.forEach((id) => this.claims.set(claimKey(itemId, id), selected));
    });
  }

  updateItem(id: ItemId, field: 'name' | 'en' | 'eur', value: string | number): void {
    this.items.get(id)?.set(field, value);
  }

  addItem(name: string, en: string, eur: number): void {
    const id = itemIdSchema.parse(`item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const item = new Y.Map<unknown>();
    item.set('id', id);
    item.set('order', this.items.size);
    item.set('name', name);
    item.set('en', en);
    item.set('eur', eur);
    this.items.set(id, item);
  }

  deleteItem(id: ItemId): void {
    this.items.delete(id);
  }

  /** Writes `seed` into the room's document, as `hydrateFromSeed` does. */
  hydrateSeed(seed: ReceiptSeed, options?: HydrationOptions): void {
    hydrateFromSeed(this.ydoc, seed, options);
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private createSnapshot(): RoomSnapshot {
    const participants: Participant[] = [];
    this.participants.forEach((map, key) => {
      const participant = storedParticipant(map, key);
      if (participant !== null) participants.push(participant);
    });
    participants.sort((a, b) =>
      a.colorIdx !== b.colorIdx ? a.colorIdx - b.colorIdx : a.id.localeCompare(b.id),
    );

    const items: ReceiptItem[] = [];
    this.items.forEach((map, key) => {
      const item = storedItem(map, key, participants, this.claims);
      if (item !== null) items.push(item);
    });
    items.sort((a, b) => {
      // An order a peer wrote may not be a number, and then the ids decide, as they do for a tie.
      const byOrder = a.order - b.order;
      return byOrder !== 0 && !Number.isNaN(byOrder) ? byOrder : a.id.localeCompare(b.id);
    });

    return {
      ...storedMetaSchema.parse(this.meta.toJSON()),
      participants,
      items,
      connection: this.connection,
      peers: this.peers,
    };
  }
}

export function useReceiptStore(
  store: Pick<ReceiptStore, 'subscribe' | 'getSnapshot'> | null,
): RoomSnapshot {
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );
}
