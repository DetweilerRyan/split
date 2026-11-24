import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isUuidRoomId, parseRoomId } from './roomId';

/** `value` in any mix of cases. */
function anyCase(value: string) {
  return fc
    .array(fc.boolean(), { minLength: value.length, maxLength: value.length })
    .map((upper) => [...value].map((c, i) => (upper[i] ? c.toUpperCase() : c)).join(''));
}

const base36 = fc.constantFrom(...'0123456789abcdefghijklmnopqrstuvwxyz');

/** A UUID room id as createRoomId makes it, its letters in any case. */
const uuidRoomId = fc.uuid({ version: 4 }).chain((uuid) => anyCase(`urn:split:room:${uuid}`));

/** A room id as the app made them before UUIDs: `split-` and one to four base36 characters. */
const legacyRoomId = fc
  .string({ unit: base36, minLength: 1, maxLength: 4 })
  .map((suffix) => `split-${suffix}`);

/** Strings that look like room ids but aren't one the app made. */
const lookAlike = fc.oneof(
  fc.uuid({ version: [1, 3, 5] }).map((uuid) => `urn:split:room:${uuid}`),
  fc.uuid({ version: 4 }).map((uuid) => `urn:split:other:${uuid}`),
  fc.string({ unit: base36, minLength: 5 }).map((suffix) => `split-${suffix}`),
  fc
    .tuple(fc.string({ unit: base36, maxLength: 3 }), fc.constantFrom(...'ABCXYZ'))
    .map(([suffix, upper]) => `split-${suffix}${upper}`),
  fc
    .tuple(fc.oneof(uuidRoomId, legacyRoomId), fc.constantFrom(' ', '/', '#', '-'))
    .map(([id, extra]) => id + extra),
  fc
    .tuple(fc.constantFrom(' ', 'x', '#', '/', 'room='), fc.oneof(uuidRoomId, legacyRoomId))
    .map(([extra, id]) => extra + id),
  fc
    .tuple(fc.uuid({ version: 4 }), fc.constantFrom(...'01234567cdef'))
    .map(([uuid, variant]) => `urn:split:room:${uuid.slice(0, 19)}${variant}${uuid.slice(20)}`),
);

describe('parseRoomId', () => {
  it('accepts every id in a form the app made, as it is', () => {
    fc.assert(
      fc.property(fc.oneof(uuidRoomId, legacyRoomId), (id) => {
        expect(parseRoomId(id)).toBe(id);
      }),
    );
  });

  it('tells a UUID id from a legacy one', () => {
    fc.assert(
      fc.property(uuidRoomId, legacyRoomId, (uuid, legacy) => {
        expect(isUuidRoomId(parseRoomId(uuid)!)).toBe(true);
        expect(isUuidRoomId(parseRoomId(legacy)!)).toBe(false);
      }),
    );
  });

  it('rejects every string that only looks like a room id', () => {
    fc.assert(
      fc.property(lookAlike, (value) => {
        expect(parseRoomId(value)).toBeNull();
      }),
    );
  });
});
