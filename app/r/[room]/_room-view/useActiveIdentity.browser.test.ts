import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { type ParticipantId, participantIdSchema } from '@/domain/receipt/roomSnapshot';
import type { RoomProvider } from '@/sync/yjsProvider';
import { roomIdSchema } from '@/domain/room/roomId';
import { useActiveIdentity } from './useActiveIdentity';

type Identity = Parameters<RoomProvider['setIdentity']>[0];
type Person = { readonly id: ParticipantId; readonly name: string; readonly colorIdx: number };

const alex = { id: participantIdSchema.parse('p-alex'), name: 'Alex', colorIdx: 0 } as const;
const sam = { id: participantIdSchema.parse('p-sam'), name: 'Sam', colorIdx: 1 } as const;
const roomId = roomIdSchema.parse('split-r1');
const storageKey = 'splitsmart-user-split-r1';

async function setup(participants: readonly Person[]) {
  const identities: Identity[] = [];
  const provider = {
    setIdentity: (identity: Identity) => {
      identities.push(identity);
    },
  };
  const renders: (string | null)[] = [];
  const hook = await renderHook(
    (people: readonly Person[] = participants) => {
      const value = useActiveIdentity(provider, roomId, people);
      renders.push(value[0]);
      return value;
    },
    { initialProps: participants },
  );
  function choose(id: string | null) {
    return hook.act(() =>
      hook.result.current[1](id === null ? null : participantIdSchema.parse(id)),
    );
  }
  // Another tab's write: the browser updates localStorage and fires a storage event in every
  // other tab with the same origin, never in the tab that wrote.
  function saveInAnotherTab(id: string) {
    return hook.act(() => {
      window.localStorage.setItem(storageKey, id);
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: id }));
    });
  }
  function current() {
    return hook.result.current[0];
  }
  return { identities, renders, choose, saveInAnotherTab, current, rerender: hook.rerender };
}

beforeEach(() => window.localStorage.clear());

describe('useActiveIdentity', () => {
  it('has no identity while the room has no participants', async () => {
    const hook = await setup([]);
    expect(hook.current()).toBeNull();
    expect(hook.identities.at(-1)).toBeNull();
  });

  it('falls back to the first participant when nothing is saved', async () => {
    const hook = await setup([alex, sam]);
    expect(hook.current()).toBe('p-alex');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-alex', name: 'Alex', colorIdx: 0 });
    expect(window.localStorage.getItem(storageKey)).toBe('p-alex');
  });

  it('restores the participant saved for the room', async () => {
    window.localStorage.setItem(storageKey, 'p-sam');
    const hook = await setup([alex, sam]);
    expect(hook.current()).toBe('p-sam');
  });

  it('ignores a saved id that is not a participant', async () => {
    window.localStorage.setItem(storageKey, 'p-gone');
    const hook = await setup([alex, sam]);
    expect(hook.current()).toBe('p-alex');
  });

  it('ignores a saved id that is no participant id, such as p-, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem(storageKey, 'p-');
    const hook = await setup([alex, sam]);
    expect(hook.current()).toBe('p-alex');
    expect(warn).toHaveBeenCalledWith(
      `SplitSmart left out the identity saved for room split-r1 as "p-": that isn't a participant id.`,
    );
    warn.mockRestore();
  });

  it('uses and saves the participant chosen', async () => {
    const hook = await setup([alex, sam]);
    await hook.choose('p-sam');
    expect(hook.current()).toBe('p-sam');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-sam', name: 'Sam', colorIdx: 1 });
    expect(window.localStorage.getItem(storageKey)).toBe('p-sam');
  });

  it('falls back to the saved participant when the choice is cleared', async () => {
    const hook = await setup([alex, sam]);
    await hook.choose('p-sam');
    await hook.choose(null);
    expect(hook.current()).toBe('p-sam');
  });

  it('falls back to the first participant when the chosen one leaves', async () => {
    const hook = await setup([alex, sam]);
    await hook.choose('p-sam');
    await hook.rerender([alex]);
    expect(hook.current()).toBe('p-alex');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-alex', name: 'Alex', colorIdx: 0 });
  });

  it('follows the participant another tab saves for the room, while none is chosen here', async () => {
    const hook = await setup([alex, sam]);
    await hook.saveInAnotherTab('p-sam');
    expect(hook.current()).toBe('p-sam');
  });

  it('keeps the participant chosen here when another tab saves a different one', async () => {
    const hook = await setup([alex, sam]);
    await hook.choose('p-alex');
    await hook.saveInAnotherTab('p-sam');
    expect(hook.current()).toBe('p-alex');
  });

  it('has the fallback identity on the first render, with no empty render first', async () => {
    const hook = await setup([alex, sam]);
    expect(hook.renders[0]).toBe('p-alex');
    expect(hook.renders).not.toContain(null);
  });
});
