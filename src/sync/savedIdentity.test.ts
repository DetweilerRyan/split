import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { participantIdSchema } from '../domain/receipt/roomSnapshot';
import { roomIdSchema } from '../domain/room/roomId';
import { readSavedIdentity, saveIdentity, savedIdentityKey } from './savedIdentity';

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

describe('readSavedIdentity', () => {
  const roomId = roomIdSchema.parse('split-k3x9');

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the participant id saved for the room', () => {
    saveIdentity(roomId, participantIdSchema.parse('p-sam'));
    expect(readSavedIdentity(roomId)).toBe('p-sam');
  });

  it('reads none when nothing is saved, with no warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readSavedIdentity(roomId)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['p-', 'Sam', ''])(
    'reads none for a saved %j, which is no participant id, with a warning, and leaves it saved',
    (saved) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      window.localStorage.setItem(savedIdentityKey(roomId), saved);

      expect(readSavedIdentity(roomId)).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        `SplitSmart left out the identity saved for room split-k3x9 as ${JSON.stringify(saved)}: that isn't a participant id.`,
      );
      expect(window.localStorage.getItem(savedIdentityKey(roomId))).toBe(saved);
    },
  );
});
