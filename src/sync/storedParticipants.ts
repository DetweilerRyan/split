import * as Y from 'yjs';
import type { Participant } from '../domain/receipt/roomSnapshot';

/**
 * The id and name of each participant in a room's `participants` map, as stored: an id from an
 * older id rule stays as it is. Read from the map itself, so it includes participants added
 * earlier in the same transaction. An entry that isn't a map is skipped, as the room's snapshot
 * skips it.
 */
export function storedParticipants(
  participants: Y.Map<Y.Map<unknown>>,
): readonly Pick<Participant, 'id' | 'name'>[] {
  return [...participants.entries()].flatMap(([key, map]) =>
    map instanceof Y.Map
      ? [{ id: String(map.get('id') || key), name: String(map.get('name') ?? '') }]
      : [],
  );
}
