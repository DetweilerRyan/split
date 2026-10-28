import LZString from 'lz-string';
import * as Y from 'yjs';
import type { ReceiptSeed } from '../types/receipt';

export interface HydrationOptions {
  forceReset?: boolean;
}

const ROOM_ID_PREFIX = 'urn:split:room:';
const ROOM_ID_PATTERN = /^urn:split:room:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRoomId(): string {
  return `${ROOM_ID_PREFIX}${crypto.randomUUID()}`;
}

export function encodeRoomId(roomId: string): string {
  if (!ROOM_ID_PATTERN.test(roomId)) return roomId;
  return btoa(roomId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRoomId(value: string | null): string | null {
  if (!value || ROOM_ID_PATTERN.test(value)) return value;
  try {
    const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const decoded = atob(padded);
    return ROOM_ID_PATTERN.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

export function encodeSeed(seed: ReceiptSeed): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(seed));
}

export function decodeSeed(value: string | null): ReceiptSeed | null {
  if (!value) return null;
  const content = value.trim();
  try {
    const json = content.startsWith('{')
      ? content
      : LZString.decompressFromEncodedURIComponent(content);
    if (!json) return null;
    const seed = JSON.parse(json) as ReceiptSeed;
    return seed && typeof seed === 'object' && Array.isArray(seed.items) ? seed : null;
  } catch {
    return null;
  }
}

export function parseRoomHash(hash: string): { roomId: string | null; seed: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return { roomId: decodeRoomId(params.get('room')), seed: params.get('seed') };
}

export function hydrateFromSeed(
  ydoc: Y.Doc,
  seed: ReceiptSeed,
  { forceReset = false }: HydrationOptions = {},
): void {
  const items = ydoc.getMap<Y.Map<unknown>>('items');
  const participants = ydoc.getMap<Y.Map<unknown>>('participants');
  const meta = ydoc.getMap<unknown>('meta');
  const claims = ydoc.getMap<boolean>('claims');

  ydoc.transact(() => {
    if (forceReset) {
      items.forEach((_value, key) => items.delete(key));
      participants.forEach((_value, key) => participants.delete(key));
      claims.forEach((_value, key) => claims.delete(key));
      meta.forEach((_value, key) => meta.delete(key));
    }

    for (const [key, value] of Object.entries({
      title: seed.title,
      cardTipEur: Number(seed.cardTipEur) || 0,
      cashTipEur: Number(seed.cashTipEur) || 0,
      bankUsd: Number(seed.bankUsd) || 0,
    })) {
      if (forceReset || !meta.has(key)) meta.set(key, value);
    }

    seed.roster.forEach((name, index) => {
      const id = `p-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      if (participants.has(id)) return;
      const participant = new Y.Map<unknown>();
      participant.set('id', id);
      participant.set('name', name.trim());
      participant.set('colorIdx', index % 7);
      participants.set(id, participant);
    });

    seed.items.forEach((item, index) => {
      const id = item.id || `item-${index}`;
      let existing = items.get(id);
      if (items.has(id) && !forceReset) {
        if (!(existing instanceof Y.Map)) return;
        if (!existing.has('id')) existing.set('id', id);
        if (!existing.has('order')) existing.set('order', index);
        if (!existing.has('name')) existing.set('name', item.name || 'Receipt Item');
        if (!existing.has('en')) existing.set('en', item.en || '');
        if (!existing.has('eur')) existing.set('eur', Number(item.eur) || 0);
        return;
      }

      existing = new Y.Map<unknown>();
      existing.set('id', id);
      existing.set('order', index);
      existing.set('name', item.name || 'Receipt Item');
      existing.set('en', item.en || '');
      existing.set('eur', Number(item.eur) || 0);
      items.set(id, existing);
    });
  });
}
