import LZString from 'lz-string';
import * as Y from 'yjs';
import { z } from 'zod';
import { isValidCurrency, normalizeCurrency } from '../utils/currency';

export interface HydrationOptions {
  forceReset?: boolean;
}

export interface ParsedIngestUrl {
  seed: ReceiptSeed;
  roomId: RoomId;
  encodedRoom: string;
  redirectUrl: string;
}

export const INGEST_PATH = '/ingest';

// A room id in one of the two forms the app has created:
// - `urn:split:room:<uuid>`, made by createRoomId;
// - `split-` and one to four lower-case base36 characters, made before the UUID ids
//   (`'split-' + Math.random().toString(36).slice(2, 6)`).
// Any other string is rejected, including ids typed by hand into old `#room=` links. The owner
// chose rejecting them over accepting any string, on #40.
const uuidRoomIdPattern =
  /^urn:split:room:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacyRoomIdPattern = /^split-[0-9a-z]{1,4}$/;

const ROOM_ID_PREFIX = 'urn:split:room:';

export const roomIdSchema = z
  .string()
  .refine((value) => uuidRoomIdPattern.test(value) || legacyRoomIdPattern.test(value), {
    message: 'Room ids are urn:split:room:<uuid>, or split- and 1 to 4 base36 characters.',
  })
  .brand<'RoomId'>();

/**
 * A room id that has been checked. Only parsing produces one, so a plain string, the URL's
 * encoded room segment, or a key built from an id can't be passed where a room id is meant.
 */
export type RoomId = z.infer<typeof roomIdSchema>;

/** The room id in `value`, or `null` when it isn't one. */
export function parseRoomId(value: unknown): RoomId | null {
  const result = roomIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Whether a room id is the UUID form, which is base64url-encoded in room URLs. */
function isUuidRoomId(roomId: RoomId): boolean {
  return uuidRoomIdPattern.test(roomId);
}
export function createRoomId(): RoomId {
  return roomIdSchema.parse(`${ROOM_ID_PREFIX}${globalThis.crypto.randomUUID()}`);
}

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

export const MAX_ITEMS = 200;
export const MAX_ROSTER = 50;
export const MAX_TEXT = 200;

// Every `error` below is a suffix; formatSeedIssues prepends the field path.
const text = (max = MAX_TEXT) =>
  z.string({ error: 'must be a string' }).max(max, { error: `must be at most ${max} characters` });
const amount = z.number({ error: 'must be a finite number' });
const currencyCode = z
  .string({ error: 'must be an ISO 4217 currency code' })
  .refine(isValidCurrency, { error: 'must be an ISO 4217 currency code' });

/**
 * Single source of truth for the receipt seed: validates ingest links and
 * is the input schema (with descriptions) of the MCP `create_receipt_room` tool.
 */
export const receiptSeedSchema = z.object({
  title: text().describe(
    'Restaurant or receipt title. Use the merchant name, or "Receipt" if unknown.',
  ),
  address: text()
    .optional()
    .describe('Restaurant street address as printed on the receipt. Omit when not printed.'),
  phone: text(64).optional().describe('Restaurant phone number as printed. Omit when not printed.'),
  website: text()
    .optional()
    .describe('Restaurant website or email as printed. Omit when not printed.'),
  purchasedAt: text(32)
    .optional()
    .describe(
      'When the meal was paid, local time printed on the receipt: YYYY-MM-DDTHH:mm (or YYYY-MM-DD if no time). Omit when not printed.',
    ),
  mealType: text(64)
    .optional()
    .describe(
      'Short agent-inferred label for the occasion, e.g. "Dinner", "Birthday dinner", "Thanksgiving lunch". Omit when there is no basis for a guess.',
    ),
  cardTipEur: amount.describe('Tip paid by card, in the receipt currency. Use 0 when unknown.'),
  cashTipEur: amount.describe('Tip paid in cash, in the receipt currency. Use 0 when unknown.'),
  bankUsd: amount.describe(
    'Bank/card charge in the display currency (USD when displayCurrency is omitted). Overrides rate when set. Use 0 when unknown.',
  ),
  currency: currencyCode
    .optional()
    .describe(
      'ISO 4217 code printed on the receipt (EUR, JPY, KWD, ...). Omitted means USD. Ask the user if it cannot be determined.',
    ),
  displayCurrency: currencyCode
    .optional()
    .describe(
      'ISO 4217 code that participant shares are converted to. Only set when the user supplies it.',
    ),
  rate: z
    .number({ error: 'must be a positive number' })
    .positive({ error: 'must be a positive number' })
    .optional()
    .describe(
      '1 receipt-currency unit in the display currency. Never invent a rate; omit unless the user supplies one.',
    ),
  rateDate: text(32).optional().describe('Date of the rate, YYYY-MM-DD.'),
  roster: z
    .array(text(), { error: 'must be an array of strings' })
    .max(MAX_ROSTER, { error: `must have at most ${MAX_ROSTER} entries` })
    .describe('Participant names. Use [] when unknown.'),
  items: z
    .array(
      z.object(
        {
          id: text(64).describe('Sequential unique ID in printed order: item-0, item-1, ...'),
          name: text().describe(
            'Item text as printed on the receipt. Multi-quantity items are suffixed "(1/2)", "(2/2)".',
          ),
          en: text().describe(
            'English translation or concise explanation; repeat the name for English receipts.',
          ),
          eur: amount.describe(
            'Price of a SINGLE unit in the receipt currency (field name is historical). Use numbers, not formatted strings.',
          ),
        },
        { error: 'must be an object' },
      ),
      { error: 'must be an array' },
    )
    .max(MAX_ITEMS, { error: `must have at most ${MAX_ITEMS} entries` })
    .describe(
      'Receipt lines in printed order. CRITICAL: unroll quantities > 1 into separate 1x entries at the unit price. Never add VAT, tax, discount or subtotal lines as items. The sum of eur must equal the printed total.',
    )
    // `when` keeps this running alongside per-item type errors, as the old validator did.
    .check(
      z.superRefine(
        (items, ctx) => {
          if (!Array.isArray(items)) return;
          const seen = new Set<string>();
          items.forEach((item, index) => {
            const id = (item as { id?: unknown } | null)?.id;
            if (typeof id !== 'string') return;
            if (seen.has(id))
              ctx.addIssue({
                code: 'custom',
                path: [index, 'id'],
                message: `"${id}" is duplicated`,
              });
            seen.add(id);
          });
        },
        { when: () => true },
      ),
    ),
});

export type ReceiptSeed = z.infer<typeof receiptSeedSchema>;

export function formatSeedIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  const messages = issues.map((issue) => {
    const path = issue.path.reduce<string>(
      (acc, key) =>
        typeof key === 'number' ? `${acc}[${key}]` : acc ? `${acc}.${String(key)}` : String(key),
      '',
    );
    return `${path} ${issue.message}`;
  });
  return [...new Set(messages)];
}

export function encodeSeed(seed: ReceiptSeed): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(seed));
}

export function validateSeed(seed: unknown): ReceiptSeed {
  if (seed === null || typeof seed !== 'object' || Array.isArray(seed)) {
    throw new Error('Seed must be a JSON object.');
  }
  const result = receiptSeedSchema.safeParse(seed);
  if (!result.success) {
    throw new Error(`Invalid seed: ${formatSeedIssues(result.error.issues).join('; ')}.`);
  }
  return result.data;
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

export function parseIngestUrl(href: string): ParsedIngestUrl | { error: string } | null {
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
  const match = /^\/r\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeRoomSegment(match[1]) : null;
}

/** The `sessionStorage` key for a seed waiting to be applied to a room. */
export type PendingSeedKey = `splitsmart-ingest-${RoomId}`;

export function pendingSeedKey(roomId: RoomId): PendingSeedKey {
  return `splitsmart-ingest-${roomId}` as const;
}

export function parseRoomHash(hash: string): { roomId: RoomId | null; seed: string | null } {
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

  // crap-allow: CRAP 18.7, complexity 11. Debt from before the CRAP check (#63):
  // its tests run 60% of it, but its complexity is over 10.
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
          .filter((key) => typeof seed[key] === 'string' && seed[key]!.trim())
          .map((key) => [key, seed[key]!.trim()]),
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

    seed.roster.forEach((name, index) => {
      const id = `p-${name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`;
      if (participants.has(id)) return;
      const participant = new Y.Map<unknown>();
      participant.set('id', id);
      participant.set('name', name.trim());
      participant.set('colorIdx', index % 7);
      participants.set(id, participant);
    });

    // crap-allow: CRAP 20.5, complexity 16. Debt from before the CRAP check (#63):
    // its tests run 74% of it, but its complexity is over 10.
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
