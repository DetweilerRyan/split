import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import * as Y from 'yjs';
import { roomIdSchema } from '@/domain/room/roomId';
import { ReceiptStore, useReceiptStore } from '@/sync/useReceiptStore';
import { useIdentity } from './useIdentity';

const roomId = roomIdSchema.parse('split-r1');

async function setup(names: readonly string[]) {
  const store = new ReceiptStore(new Y.Doc());
  names.forEach((name) => store.addParticipant(name));
  const provider = { store, setIdentity: vi.fn() };
  const showToast = vi.fn();
  const hook = await renderHook(() => {
    const snapshot = useReceiptStore(store);
    return useIdentity(provider, roomId, snapshot.participants, showToast);
  });
  function current() {
    return hook.result.current;
  }
  function participantNames() {
    return store.getSnapshot().participants.map((person) => person.name);
  }
  return { act: hook.act, current, participantNames, showToast };
}

beforeEach(() => window.localStorage.clear());

describe('useIdentity', () => {
  it('opens and closes the identity picker', async () => {
    const hook = await setup(['Alex']);
    expect(hook.current().pickerOpen).toBe(false);
    await hook.act(() => hook.current().openPicker());
    expect(hook.current().pickerOpen).toBe(true);
    await hook.act(() => hook.current().closePicker());
    expect(hook.current().pickerOpen).toBe(false);
  });

  it('makes you the participant you choose, and closes the picker', async () => {
    const hook = await setup(['Alex', 'Sam']);
    await hook.act(() => hook.current().openPicker());
    await hook.act(() => hook.current().choose('p-sam'));
    expect(hook.current().activeId).toBe('p-sam');
    expect(hook.current().pickerOpen).toBe(false);
  });

  it('adds the name you join with, and makes you that participant', async () => {
    const hook = await setup(['Alex']);
    await hook.act(() => hook.current().openPicker());
    await hook.act(() => hook.current().add('Jamie'));
    expect(hook.participantNames()).toEqual(['Alex', 'Jamie']);
    expect(hook.current().activeId).toBe('p-jamie');
    expect(hook.current().pickerOpen).toBe(false);
  });

  it('makes you the participant already on the bill when you join with their name', async () => {
    const hook = await setup(['Alex', 'Sam']);
    await hook.act(() => hook.current().add(' SAM '));
    expect(hook.participantNames()).toEqual(['Alex', 'Sam']);
    expect(hook.current().activeId).toBe('p-sam');
    expect(hook.showToast).not.toHaveBeenCalled();
  });

  it('asks for a name when you join with a blank one, and keeps the picker open', async () => {
    const hook = await setup(['Alex']);
    await hook.act(() => hook.current().openPicker());
    await hook.act(() => hook.current().add('   '));
    expect(hook.showToast).toHaveBeenCalledExactlyOnceWith('Enter a participant name.');
    expect(hook.participantNames()).toEqual(['Alex']);
    expect(hook.current().pickerOpen).toBe(true);
  });

  it('removes a participant, and moves you to the first one left when it was you', async () => {
    const hook = await setup(['Alex', 'Sam']);
    await hook.act(() => hook.current().choose('p-sam'));
    await hook.act(() => hook.current().remove('p-sam'));
    expect(hook.participantNames()).toEqual(['Alex']);
    expect(hook.current().activeId).toBe('p-alex');
  });

  it('keeps you as you are when someone else is removed', async () => {
    const hook = await setup(['Alex', 'Sam', 'Jamie']);
    await hook.act(() => hook.current().choose('p-jamie'));
    await hook.act(() => hook.current().remove('p-sam'));
    expect(hook.participantNames()).toEqual(['Alex', 'Jamie']);
    expect(hook.current().activeId).toBe('p-jamie');
  });
});
