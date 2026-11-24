import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../utils/currency';

export interface ReceiptItem {
  id: string;
  name: string;
  en: string;
  eur: number;
  order: number;
  claims: Readonly<Record<string, boolean>>;
}

export interface Participant {
  id: string;
  name: string;
  colorIdx: number;
}

export interface RoomSnapshot {
  title: string;
  address: string;
  phone: string;
  website: string;
  purchasedAt: string;
  mealType: string;
  cardTipEur: number;
  cashTipEur: number;
  bankUsd: number;
  currency: string;
  displayCurrency: string;
  rate: number;
  rateDate: string;
  participants: readonly Participant[];
  items: readonly ReceiptItem[];
  connection: {
    provider: 'Liveblocks' | 'WebRTC';
    status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  };
  peers: readonly { id: string; name: string; color?: string }[];
}

const configuredProvider: RoomSnapshot['connection']['provider'] =
  process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim() ? 'Liveblocks' : 'WebRTC';

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
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.meta = ydoc.getMap('meta');
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.participants = ydoc.getMap('participants');
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.items = ydoc.getMap('items');
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.claims = ydoc.getMap('claims');
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.snapshot = this.createSnapshot();
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    [this.meta, this.participants, this.items, this.claims].forEach((map) => {
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      map.observeDeep(() => this.publish());
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.listeners.add(listener);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    return () => this.listeners.delete(listener);
  };

  // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
  readonly getSnapshot = (): RoomSnapshot => this.snapshot;

  setPeers(peers: RoomSnapshot['peers']): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.peers = peers;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.publish();
  }

  setConnection(connection: RoomSnapshot['connection']): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.connection = connection;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
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
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.meta.set(key, value);
  }

  setExchangeRate(displayCurrency: string, rate: number, rateDate: string): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.ydoc.transact(() => {
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      this.meta.set('displayCurrency', displayCurrency);
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      this.meta.set('rate', rate);
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      this.meta.set('rateDate', rateDate);
    });
  }

  addParticipant(name: string): Participant | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = `p-${trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    if (this.participants.has(id)) return null;
    const participant = new Y.Map<unknown>();
    participant.set('id', id);
    participant.set('name', trimmed);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    participant.set('colorIdx', this.participants.size % 7);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.participants.set(id, participant);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    return { id, name: trimmed, colorIdx: this.participants.size % 7 };
  }

  removeParticipant(id: string): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.ydoc.transact(() => {
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      this.participants.delete(id);
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      this.claims.forEach((_value, key) => {
        // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
        if (key.endsWith(`::${id}`)) this.claims.delete(key);
      });
    });
  }

  toggleClaim(itemId: string, participantId: string): void {
    const key = `${itemId}::${participantId}`;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    const item = this.items.get(itemId);
    if (!item) return;
    const legacyClaims = item.get('claims');
    const legacyValue =
      legacyClaims instanceof Y.Map ? legacyClaims.get(participantId) === true : false;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    const current = this.claims.has(key) ? this.claims.get(key) === true : legacyValue;
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.claims.set(key, !current);
  }

  setClaims(itemId: string, participantIds: string[], selected: boolean): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.ydoc.transact(() => {
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      participantIds.forEach((id) => this.claims.set(`${itemId}::${id}`, selected));
    });
  }

  updateItem(id: string, field: 'name' | 'en' | 'eur', value: string | number): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.items.get(id)?.set(field, value);
  }

  addItem(name: string, en: string, eur: number): void {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item = new Y.Map<unknown>();
    item.set('id', id);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    item.set('order', this.items.size);
    item.set('name', name);
    item.set('en', en);
    item.set('eur', eur);
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.items.set(id, item);
  }

  deleteItem(id: string): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.items.delete(id);
  }

  private publish(): void {
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.snapshot = this.createSnapshot();
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.listeners.forEach((listener) => listener());
  }

  // @crap-allow CRAP 27.1, complexity 27. Debt from before the CRAP check (#63): too complex.
  private createSnapshot(): RoomSnapshot {
    const participants: Participant[] = [];
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.participants.forEach((map, key) => {
      if (map instanceof Y.Map) {
        participants.push({
          id: String(map.get('id') || key),
          name: String(map.get('name') || 'Friend'),
          colorIdx: Number(map.get('colorIdx')) || 0,
        });
      }
    });
    participants.sort((a, b) => a.colorIdx - b.colorIdx || a.id.localeCompare(b.id));

    const items: ReceiptItem[] = [];
    // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
    this.items.forEach((map, key) => {
      if (!(map instanceof Y.Map)) return;
      const id = String(map.get('id') || key);
      const legacyClaims = map.get('claims');
      const claimState: Record<string, boolean> = {};
      participants.forEach(({ id: participantId }) => {
        const key = `${id}::${participantId}`;
        // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
        claimState[participantId] = this.claims.has(key)
          ? // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
            this.claims.get(key) === true
          : legacyClaims instanceof Y.Map && legacyClaims.get(participantId) === true;
      });
      items.push({
        id,
        name: String(map.get('name') || 'Item'),
        en: String(map.get('en') || ''),
        eur: Number(map.get('eur')) || 0,
        order: Number(map.get('order') ?? 999),
        claims: claimState,
      });
    });
    items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    return {
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      title: String(this.meta.get('title') || 'European Receipt'),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      address: String(this.meta.get('address') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      phone: String(this.meta.get('phone') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      website: String(this.meta.get('website') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      purchasedAt: String(this.meta.get('purchasedAt') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      mealType: String(this.meta.get('mealType') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      cardTipEur: Number(this.meta.get('cardTipEur')) || 0,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      cashTipEur: Number(this.meta.get('cashTipEur')) || 0,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      bankUsd: Number(this.meta.get('bankUsd')) || 0,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      currency: normalizeCurrency(this.meta.get('currency')),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      displayCurrency: String(this.meta.get('displayCurrency') || ''),
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      rate: Number(this.meta.get('rate')) || 0,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      rateDate: String(this.meta.get('rateDate') || ''),
      participants,
      items,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      connection: this.connection,
      // oxlint-disable-next-line functional/no-this -- ReceiptStore keeps its class; see the comment on it.
      peers: this.peers,
    };
  }
}

// @crap-allow CRAP 56, complexity 7. Debt from before nested functions, default values and ?. counted (#74): no tests yet.
export function useReceiptStore(store: ReceiptStore | null): RoomSnapshot {
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    store?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );
}
