import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../domain/money/currency';
import {
  type Participant,
  type ReceiptItem,
  type RoomSnapshot,
  findParticipant,
  participantId,
} from '../domain/receipt/roomSnapshot';
import { storedParticipants } from './storedParticipants';
import { storedText } from './storedText';

const configuredProvider: RoomSnapshot['connection']['provider'] =
  (process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim() ?? '') !== '' ? 'Liveblocks' : 'WebRTC';

/**
 * A number read from the room's Yjs document, where any peer can write any value: the value as a
 * number, or 0 when it isn't one. Minus zero reads as 0 too, so no amount shows as "-0.00".
 */
function storedNumber(value: unknown): number {
  const number = Number(value);
  return Number.isNaN(number) || number === 0 ? 0 : number;
}

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

  removeParticipant(id: string): void {
    this.ydoc.transact(() => {
      this.participants.delete(id);
      this.claims.forEach((_value, key) => {
        if (key.endsWith(`::${id}`)) this.claims.delete(key);
      });
    });
  }

  toggleClaim(itemId: string, participantId: string): void {
    const key = `${itemId}::${participantId}`;
    const item = this.items.get(itemId);
    if (item === undefined) return;
    const legacyClaims = item.get('claims');
    const legacyValue =
      legacyClaims instanceof Y.Map ? legacyClaims.get(participantId) === true : false;
    const current = this.claims.has(key) ? this.claims.get(key) === true : legacyValue;
    this.claims.set(key, !current);
  }

  setClaims(itemId: string, participantIds: readonly string[], selected: boolean): void {
    this.ydoc.transact(() => {
      participantIds.forEach((id) => this.claims.set(`${itemId}::${id}`, selected));
    });
  }

  updateItem(id: string, field: 'name' | 'en' | 'eur', value: string | number): void {
    this.items.get(id)?.set(field, value);
  }

  addItem(name: string, en: string, eur: number): void {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item = new Y.Map<unknown>();
    item.set('id', id);
    item.set('order', this.items.size);
    item.set('name', name);
    item.set('en', en);
    item.set('eur', eur);
    this.items.set(id, item);
  }

  deleteItem(id: string): void {
    this.items.delete(id);
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private createSnapshot(): RoomSnapshot {
    const participants: Participant[] = [];
    this.participants.forEach((map, key) => {
      if (map instanceof Y.Map) {
        participants.push({
          id: storedText(map.get('id'), key),
          name: storedText(map.get('name'), 'Friend'),
          colorIdx: storedNumber(map.get('colorIdx')),
        });
      }
    });
    participants.sort((a, b) =>
      a.colorIdx !== b.colorIdx ? a.colorIdx - b.colorIdx : a.id.localeCompare(b.id),
    );

    const items: ReceiptItem[] = [];
    this.items.forEach((map, key) => {
      if (!(map instanceof Y.Map)) return;
      const id = storedText(map.get('id'), key);
      const legacyClaims = map.get('claims');
      const claimState: Record<string, boolean> = {};
      participants.forEach(({ id: participantId }) => {
        const key = `${id}::${participantId}`;
        claimState[participantId] = this.claims.has(key)
          ? this.claims.get(key) === true
          : legacyClaims instanceof Y.Map && legacyClaims.get(participantId) === true;
      });
      items.push({
        id,
        name: storedText(map.get('name'), 'Item'),
        en: storedText(map.get('en'), ''),
        eur: storedNumber(map.get('eur')),
        order: Number(map.get('order') ?? 999),
        claims: claimState,
      });
    });
    items.sort((a, b) => {
      // An order a peer wrote may not be a number, and then the ids decide, as they do for a tie.
      const byOrder = a.order - b.order;
      return byOrder !== 0 && !Number.isNaN(byOrder) ? byOrder : a.id.localeCompare(b.id);
    });

    return {
      title: storedText(this.meta.get('title'), 'European Receipt'),
      address: storedText(this.meta.get('address'), ''),
      phone: storedText(this.meta.get('phone'), ''),
      website: storedText(this.meta.get('website'), ''),
      purchasedAt: storedText(this.meta.get('purchasedAt'), ''),
      mealType: storedText(this.meta.get('mealType'), ''),
      cardTipEur: storedNumber(this.meta.get('cardTipEur')),
      cashTipEur: storedNumber(this.meta.get('cashTipEur')),
      bankUsd: storedNumber(this.meta.get('bankUsd')),
      currency: normalizeCurrency(this.meta.get('currency')),
      displayCurrency: storedText(this.meta.get('displayCurrency'), ''),
      rate: storedNumber(this.meta.get('rate')),
      rateDate: storedText(this.meta.get('rateDate'), ''),
      participants,
      items,
      connection: this.connection,
      peers: this.peers,
    };
  }
}

export function useReceiptStore(store: ReceiptStore | null): RoomSnapshot {
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );
}
