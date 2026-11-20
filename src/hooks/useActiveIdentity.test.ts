import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RoomProvider } from '../store/yjsProvider';
import { useActiveIdentity } from './useActiveIdentity';

type Identity = Parameters<RoomProvider['setIdentity']>[0];
type Person = { id: string; name: string; colorIdx: number };

const alex = { id: 'p-alex', name: 'Alex', colorIdx: 0 };
const sam = { id: 'p-sam', name: 'Sam', colorIdx: 1 };
const roomId = 'room-1';
const storageKey = `splitsmart-user-${roomId}`;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setup() {
  const identities: Identity[] = [];
  const provider = {
    setIdentity: (identity: Identity) => {
      identities.push(identity);
    },
  };
  const renders: (string | null)[] = [];
  let setActiveId!: (id: string | null) => void;

  function Probe({ participants }: { participants: readonly Person[] }) {
    const [activeId, set] = useActiveIdentity(provider, roomId, participants);
    renders.push(activeId);
    setActiveId = set;
    return null;
  }

  const root: Root = createRoot(document.createElement('div'));
  const render = (participants: readonly Person[]) =>
    act(() => root.render(createElement(Probe, { participants })));
  const choose = (id: string | null) => act(() => setActiveId(id));
  const current = () => renders[renders.length - 1];
  const unmount = () => act(() => root.unmount());
  return { identities, renders, render, choose, current, unmount };
}

let unmount: () => void = () => {};

beforeEach(() => window.localStorage.clear());
afterEach(() => unmount());

describe('useActiveIdentity', () => {
  it('has no identity while the room has no participants', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([]);
    expect(hook.current()).toBeNull();
    expect(hook.identities.at(-1)).toBeNull();
  });

  it('falls back to the first participant when nothing is saved', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    expect(hook.current()).toBe('p-alex');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-alex', name: 'Alex', colorIdx: 0 });
    expect(window.localStorage.getItem(storageKey)).toBe('p-alex');
  });

  it('restores the participant saved for the room', () => {
    window.localStorage.setItem(storageKey, 'p-sam');
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    expect(hook.current()).toBe('p-sam');
  });

  it('ignores a saved id that is not a participant', () => {
    window.localStorage.setItem(storageKey, 'p-gone');
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    expect(hook.current()).toBe('p-alex');
  });

  it('uses and saves the participant chosen', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    hook.choose('p-sam');
    expect(hook.current()).toBe('p-sam');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-sam', name: 'Sam', colorIdx: 1 });
    expect(window.localStorage.getItem(storageKey)).toBe('p-sam');
  });

  it('falls back to the saved participant when the choice is cleared', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    hook.choose('p-sam');
    hook.choose(null);
    expect(hook.current()).toBe('p-sam');
  });

  it('falls back to the first participant when the chosen one leaves', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    hook.choose('p-sam');
    hook.render([alex]);
    expect(hook.current()).toBe('p-alex');
    expect(hook.identities.at(-1)).toEqual({ id: 'p-alex', name: 'Alex', colorIdx: 0 });
  });

  it('has the fallback identity on the first render, with no empty render first', () => {
    const hook = setup();
    unmount = hook.unmount;
    hook.render([alex, sam]);
    expect(hook.renders).toEqual(['p-alex']);
  });
});
