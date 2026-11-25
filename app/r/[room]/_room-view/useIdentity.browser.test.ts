import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import * as Y from 'yjs';
import { participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { roomIdSchema } from '@/domain/room/roomId';
import { ReceiptStore, useReceiptStore } from '@/sync/useReceiptStore';
import { useIdentity } from './useIdentity';

const roomId = roomIdSchema.parse('split-r1');

async function setup(names: readonly string[], doc = new Y.Doc()) {
  const store = new ReceiptStore(doc);
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
    await hook.act(() => hook.current().choose(participantIdSchema.parse('p-sam')));
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

  it('asks for a letter or number when you join with a name that has neither', async () => {
    const hook = await setup(['Alex']);
    await hook.act(() => hook.current().openPicker());
    await hook.act(() => hook.current().add('!!!'));
    expect(hook.showToast).toHaveBeenCalledExactlyOnceWith(
      'Enter a name with at least one letter or number.',
    );
    expect(hook.participantNames()).toEqual(['Alex']);
    expect(hook.current().pickerOpen).toBe(true);
  });

  it('makes you a participant stored under an older id when you join with their name', async () => {
    const doc = new Y.Doc();
    const jose = new Y.Map<unknown>();
    jose.set('id', 'p-jos');
    jose.set('name', 'José');
    jose.set('colorIdx', 0);
    doc.getMap<Y.Map<unknown>>('participants').set('p-jos', jose);
    const hook = await setup([], doc);
    await hook.act(() => hook.current().add('José'));
    expect(hook.participantNames()).toEqual(['José']);
    expect(hook.current().activeId).toBe('p-jos');
    expect(hook.showToast).not.toHaveBeenCalled();
  });

  it('removes a participant, and moves you to the first one left when it was you', async () => {
    const hook = await setup(['Alex', 'Sam']);
    await hook.act(() => hook.current().choose(participantIdSchema.parse('p-sam')));
    await hook.act(() => hook.current().remove(participantIdSchema.parse('p-sam')));
    expect(hook.participantNames()).toEqual(['Alex']);
    expect(hook.current().activeId).toBe('p-alex');
  });

  it('keeps you as you are when someone else is removed', async () => {
    const hook = await setup(['Alex', 'Sam', 'Jamie']);
    await hook.act(() => hook.current().choose(participantIdSchema.parse('p-jamie')));
    await hook.act(() => hook.current().remove(participantIdSchema.parse('p-sam')));
    expect(hook.participantNames()).toEqual(['Alex', 'Jamie']);
    expect(hook.current().activeId).toBe('p-jamie');
  });
});
