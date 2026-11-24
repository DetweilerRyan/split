import LZString from 'lz-string';
import * as Y from 'yjs';
import { isValidCurrency, normalizeCurrency } from '../domain/money/currency';
import { type ReceiptSeed, validateSeed } from '../domain/receipt/receiptSeed';
import { findParticipant, participantId } from '../domain/receipt/roomSnapshot';
import { type RoomId, createRoomId, isUuidRoomId, parseRoomId } from '../domain/room/roomId';
import { storedParticipants } from './storedParticipants';

export interface HydrationOptions {
  readonly forceReset?: boolean;
}

export interface ParsedIngestUrl {
  readonly seed: ReceiptSeed;
  readonly roomId: RoomId;
  readonly encodedRoom: string;
  readonly redirectUrl: string;
}

export const INGEST_PATH = '/ingest';

/** The room's URL segment: a UUID id base64url-encoded, a legacy id as it is. */
export function encodeRoomId(roomId: RoomId): string {
  if (!isUuidRoomId(roomId)) return roomId;
  return btoa(roomId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The room id in a URL segment or hash value, encoded or not; `null` when it holds none. */
export function decodeRoomId(value: string | null): RoomId | null {
  if (!value) return null;
  const direct = parseRoomId(value);
  if (direct) return direct;
  try {
    const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const decoded = parseRoomId(atob(padded));
    return decoded && isUuidRoomId(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function encodeSeed(seed: ReceiptSeed): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(seed));
}

export function buildIngestUrl(origin: string, seed: ReceiptSeed): string {
  return `${origin.replace(/\/+$/, '')}${INGEST_PATH}#ingest=${encodeURIComponent(JSON.stringify(seed))}`;
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

export function parseIngestUrl(href: string): ParsedIngestUrl | { readonly error: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { error: 'The ingest link is not a valid URL.' };
  }

  const hashParams = new URLSearchParams(url.hash.slice(1));
  const rawIngest = hashParams.has('ingest')
    ? hashParams.get('ingest')
    : url.searchParams.get('ingest');
  if (rawIngest === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawIngest);
  } catch {
    return { error: 'The ingest link does not contain valid JSON.' };
  }

  let seed: ReceiptSeed;
  try {
    seed = validateSeed(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown validation error.';
    return { error: `Receipt data failed validation: ${message}` };
  }

  const roomId = createRoomId();
  const encodedRoom = encodeRoomId(roomId);
  return {
    seed,
    roomId,
    encodedRoom,
    redirectUrl: `${url.origin}${roomPath(roomId)}`,
  };
}

export function roomPath(roomId: RoomId): string {
  return `/r/${encodeRoomId(roomId)}`;
}

export function decodeRoomSegment(segment: string): RoomId | null {
  try {
    return decodeRoomId(decodeURIComponent(segment));
  } catch {
    return null;
  }
}

export function parseRoomPath(pathname: string): RoomId | null {
  const segment = /^\/r\/([^/]+)\/?$/.exec(pathname)?.[1];
  return segment === undefined ? null : decodeRoomSegment(segment);
}

/** The `sessionStorage` key for a seed waiting to be applied to a room. */
export type PendingSeedKey = `splitsmart-ingest-${RoomId}`;

export function pendingSeedKey(roomId: RoomId): PendingSeedKey {
  return `splitsmart-ingest-${roomId}` as const;
}

export function parseRoomHash(hash: string): {
  readonly roomId: RoomId | null;
  readonly seed: string | null;
} {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return { roomId: decodeRoomId(params.get('room')), seed: params.get('seed') };
}

/* @crap-allow CRAP 29.3, complexity 29. Too complex: a branch for each seed field's default, in
   the room's details and in each item, and for whether forceReset overwrites it. Splitting the
   details from the items would bring it within the limits, but that is a change of its own, not
   part of moving the domain logic out of src/store/ (#94). */
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
      ...Object.fromEntries(
        (['address', 'phone', 'website', 'purchasedAt', 'mealType'] as const)
          .map((key) => [key, seed[key]?.trim()])
          .filter(([, value]) => value),
      ),
      cardTipEur: Number(seed.cardTipEur) || 0,
      cashTipEur: Number(seed.cashTipEur) || 0,
      bankUsd: Number(seed.bankUsd) || 0,
      currency: normalizeCurrency(seed.currency),
      ...(isValidCurrency(seed.displayCurrency)
        ? {
            displayCurrency: seed.displayCurrency.toUpperCase(),
            rate: Number(seed.rate) > 0 ? Number(seed.rate) : 0,
            rateDate: typeof seed.rateDate === 'string' ? seed.rateDate : '',
          }
        : {}),
    })) {
      if (forceReset || !meta.has(key)) meta.set(key, value);
    }

    addRoster(participants, seed.roster);

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

/**
 * Adds each roster name as a participant, coloured by its place in the roster. Skips a name with
 * no letter or digit, and a name that stands for a participant already in the room, including one
 * stored under an older id.
 */
function addRoster(participants: Y.Map<Y.Map<unknown>>, roster: readonly string[]): void {
  roster.forEach((name, index) => {
    const id = participantId(name);
    if (id === null || participants.has(id)) return;
    if (findParticipant(storedParticipants(participants), name)) return;
    const participant = new Y.Map<unknown>();
    participant.set('id', id);
    participant.set('name', name.trim());
    participant.set('colorIdx', index % 7);
    participants.set(id, participant);
  });
}
