import { z } from 'zod';

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
export function isUuidRoomId(roomId: RoomId): boolean {
  return uuidRoomIdPattern.test(roomId);
}

export function createRoomId(): RoomId {
  return roomIdSchema.parse(`${ROOM_ID_PREFIX}${globalThis.crypto.randomUUID()}`);
}
