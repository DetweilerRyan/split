import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import type { RoomProvider } from '../sync/yjsProvider';
import { roomIdSchema } from '../sync/seedCodec';
import { useActiveIdentity } from './useActiveIdentity';

type Identity = Parameters<RoomProvider['setIdentity']>[0];
type Person = { id: string; name: string; colorIdx: number };

const alex = { id: 'p-alex', name: 'Alex', colorIdx: 0 };
const sam = { id: 'p-sam', name: 'Sam', colorIdx: 1 };
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
    return hook.act(() => hook.result.current[1](id));
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
