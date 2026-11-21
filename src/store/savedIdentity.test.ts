import { describe, expect, it } from 'vitest';
import { roomIdSchema } from './seedCodec';
import { savedIdentityKey } from './savedIdentity';

describe('savedIdentityKey', () => {
  // The key holds each person's saved identity for a room, so it must never change.
  it.each([
    [
      'urn:split:room:3f2b1c4d-1111-4222-8333-444455556666',
      'splitsmart-user-urn:split:room:3f2b1c4d-1111-4222-8333-444455556666',
    ],
    ['split-k3x9', 'splitsmart-user-split-k3x9'],
  ])('keeps the key for %s', (id, key) => {
    expect(savedIdentityKey(roomIdSchema.parse(id))).toBe(key);
  });
});
