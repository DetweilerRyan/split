import { describe, expect, expectTypeOf, it } from 'vitest';
import { createRoomId, encodeRoomId, pendingSeedKey, roomPath } from '../store/seedCodec';
import { savedIdentityKey, type SavedIdentityKey } from '../store/savedIdentity';
import { getRoomProvider, indexedDbName } from '../store/yjsProvider';
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

describe('RoomId at compile time', () => {
  // Each @ts-expect-error fails `npm run typecheck` if the call it marks ever type-checks:
  // a plain string, or the URL's encoded segment, must not stand in for a room id.
  it('rejects a plain string where a room id is meant', () => {
    const roomId = roomIdSchema.parse('split-k3x9');
    const encodedSegment: string = encodeRoomId(createRoomId());

    expectTypeOf(roomPath).toBeCallableWith(roomId);
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(roomPath).toBeCallableWith('split-k3x9');
    // @ts-expect-error the encoded URL segment is not a RoomId
    expectTypeOf(getRoomProvider).toBeCallableWith(encodedSegment);
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(pendingSeedKey).toBeCallableWith('split-k3x9');
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(savedIdentityKey).toBeCallableWith('split-k3x9');
    // @ts-expect-error a plain string is not a RoomId
    expectTypeOf(indexedDbName).toBeCallableWith('split-k3x9');
    // @ts-expect-error a key written by hand is not a SavedIdentityKey
    const handWritten: SavedIdentityKey = 'splitsmart-user-split-k3x9';
    expect(handWritten).toBeTypeOf('string');
  });
});
