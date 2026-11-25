import * as Y from 'yjs';
import {
  type Participant,
  type ParticipantId,
  parseParticipantId,
} from '../domain/receipt/roomSnapshot';
import { storedTextSchema } from './storedText';

/**
 * The id of a participant stored in a room's `participants` map under `key`: its `id` field, or
 * `key` when that isn't text. `null`, with a console warning naming it, when that isn't a
 * participant id, such as `p-`, the id an older rule gave a name with no ASCII letter or digit.
 * The owner chose, on #124, to leave such a participant out of what the app reads, its claims
 * with it, and to leave the document as it is.
 */
export function storedParticipantId(value: unknown, key: string): ParticipantId | null {
  const stored = storedTextSchema(key).parse(value);
  const id = parseParticipantId(stored);
  if (id === null) {
    console.warn(
      `SplitSmart left out the participant stored as ${JSON.stringify(stored)}, and its claims: that isn't a participant id.`,
    );
  }
  return id;
}

/**
 * The id and name of each participant in a room's `participants` map, as stored: an id from an
 * older id rule stays as it is. Read from the map itself, so it includes participants added
 * earlier in the same transaction. An entry that isn't a map is skipped, as the room's snapshot
 * skips it, and so is one whose id isn't a participant id, as `storedParticipantId` says.
 */
export function storedParticipants(
  participants: Y.Map<Y.Map<unknown>>,
): readonly Pick<Participant, 'id' | 'name'>[] {
  return [...participants.entries()].flatMap(([key, map]) => {
    if (!(map instanceof Y.Map)) return [];
    const id = storedParticipantId(map.get('id'), key);
    return id === null ? [] : [{ id, name: storedTextSchema('').parse(map.get('name')) }];
  });
}
