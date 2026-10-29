import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import type { Participant, ReceiptItem, RoomSnapshot } from '../types/receipt';

const configuredProvider: RoomSnapshot['connection']['provider'] =
  import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY?.trim() ? 'Liveblocks' : 'WebRTC';

export const EMPTY_SNAPSHOT: RoomSnapshot = {
  title: 'Loading receipt…',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  participants: [],
  items: [],
  connection: { provider: configuredProvider, status: 'connecting' },
  peers: [],
};

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

  setMeta(key: 'title' | 'cardTipEur' | 'cashTipEur' | 'bankUsd', value: string | number): void {
    this.meta.set(key, value);
  }

  addParticipant(name: string): Participant | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = `p-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    if (this.participants.has(id)) return null;
    const participant = new Y.Map<unknown>();
    participant.set('id', id);
    participant.set('name', trimmed);
    participant.set('colorIdx', this.participants.size % 7);
    this.participants.set(id, participant);
    return { id, name: trimmed, colorIdx: this.participants.size % 7 };
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
    if (!item) return;
    const legacyClaims = item.get('claims');
    const legacyValue =
      legacyClaims instanceof Y.Map ? legacyClaims.get(participantId) === true : false;
    const current = this.claims.has(key) ? this.claims.get(key) === true : legacyValue;
    this.claims.set(key, !current);
  }

  setClaims(itemId: string, participantIds: string[], selected: boolean): void {
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
          id: String(map.get('id') || key),
          name: String(map.get('name') || 'Friend'),
          colorIdx: Number(map.get('colorIdx')) || 0,
        });
      }
    });
    participants.sort((a, b) => a.colorIdx - b.colorIdx || a.id.localeCompare(b.id));

    const items: ReceiptItem[] = [];
    this.items.forEach((map, key) => {
      if (!(map instanceof Y.Map)) return;
      const id = String(map.get('id') || key);
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
        name: String(map.get('name') || 'Item'),
        en: String(map.get('en') || ''),
        eur: Number(map.get('eur')) || 0,
        order: Number(map.get('order') ?? 999),
        claims: claimState,
      });
    });
    items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    return {
      title: String(this.meta.get('title') || 'European Receipt'),
      cardTipEur: Number(this.meta.get('cardTipEur')) || 0,
      cashTipEur: Number(this.meta.get('cashTipEur')) || 0,
      bankUsd: Number(this.meta.get('bankUsd')) || 0,
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
