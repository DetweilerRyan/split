import { describe, expect, it } from 'vitest';
import { parseRoomId, roomIdSchema } from './roomId';

const uuidRoomId = 'urn:split:room:3f2b1c4d-1111-4222-8333-444455556666';

describe('parseRoomId', () => {
  it('accepts a UUID room id', () => {
    expect(parseRoomId(uuidRoomId)).toBe(uuidRoomId);
  });

  it('accepts a UUID room id in upper case, as the old pattern did', () => {
    expect(
      parseRoomId(uuidRoomId.toUpperCase().replace('URN:SPLIT:ROOM:', 'urn:split:room:')),
    ).not.toBeNull();
  });

  it.each(['split-a', 'split-k3', 'split-k3x', 'split-k3x9'])(
    'accepts the generated legacy id %s',
    (legacy) => {
      expect(parseRoomId(legacy)).toBe(legacy);
    },
  );

  it.each([
    ['a hand-written legacy id', 'split-legacy'],
    ['an upper-case legacy id', 'split-K3X9'],
    ['a legacy prefix with nothing after it', 'split-'],
    ['an arbitrary string', 'room-1'],
    ['an empty string', ''],
    ['an encoded room segment', btoa(uuidRoomId).replace(/=+$/, '')],
    ['a storage key', `splitsmart-user-${uuidRoomId}`],
  ])('rejects %s', (_label, value) => {
    expect(parseRoomId(value)).toBeNull();
  });

  it('rejects values that are not strings', () => {
    expect(parseRoomId(null)).toBeNull();
    expect(parseRoomId(42)).toBeNull();
  });
});

describe('roomIdSchema', () => {
  it('throws on an invalid room id, naming the two accepted forms', () => {
    expect(() => roomIdSchema.parse('room-1')).toThrow(/urn:split:room:<uuid>.*split-/);
  });
});
