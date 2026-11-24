import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import * as Y from 'yjs';
import { PRESETS } from '../data/presets';
import { localeCurrency } from '../domain/money/currency';
import { parseRoomPath, pendingSeedKey } from '../sync/seedCodec';
import { ReceiptStore } from '../sync/useReceiptStore';
import { useSeedImport } from './useSeedImport';

const plitvice = PRESETS.plitvice;

async function setup() {
  const doc = new Y.Doc();
  const store = new ReceiptStore(doc);
  store.setMeta('title', 'Lunch');
  store.addItem('Bread', '', 3);
  const showToast = vi.fn();
  const navigate = vi.fn();
  const hook = await renderHook(() => useSeedImport(doc, showToast, navigate));
  function current() {
    return hook.result.current;
  }
  return { act: hook.act, current, store, showToast, navigate };
}

beforeEach(() => window.sessionStorage.clear());

describe('useSeedImport', () => {
  it('opens and closes the seed dialog', async () => {
    const hook = await setup();
    expect(hook.current().open).toBe(false);
    await hook.act(() => hook.current().openDialog());
    expect(hook.current().open).toBe(true);
    await hook.act(() => hook.current().closeDialog());
    expect(hook.current().open).toBe(false);
  });

  it('replaces the receipt with the seed imported, closes the dialog and says how many items came in', async () => {
    const hook = await setup();
    await hook.act(() => hook.current().openDialog());
    await hook.act(() => hook.current().importSeed(plitvice, true));
    const snapshot = hook.store.getSnapshot();
    expect(snapshot.title).toBe('Konoba Lička Kuća — Plitvice');
    expect(snapshot.items.map((item) => item.name)).toEqual(
      plitvice.items.map((item) => item.name),
    );
    expect(hook.current().open).toBe(false);
    expect(hook.showToast).toHaveBeenCalledExactlyOnceWith('Imported 4 receipt items.');
  });

  it('keeps the receipt and adds the seed to it when the import does not replace it', async () => {
    const hook = await setup();
    await hook.act(() => hook.current().importSeed(plitvice, false));
    const snapshot = hook.store.getSnapshot();
    expect(snapshot.title).toBe('Lunch');
    expect(snapshot.items).toHaveLength(5);
  });

  it('replaces the receipt with the preset loaded', async () => {
    const hook = await setup();
    await hook.act(() => hook.current().loadPreset(plitvice));
    const snapshot = hook.store.getSnapshot();
    expect(snapshot.title).toBe('Konoba Lička Kuća — Plitvice');
    expect(snapshot.items).toHaveLength(4);
    expect(hook.showToast).toHaveBeenCalledExactlyOnceWith('Imported 4 receipt items.');
  });

  it('goes to a new room, with a blank receipt in the local currency waiting for it', async () => {
    const hook = await setup();
    await hook.act(() => hook.current().newBlankRoom());
    expect(hook.navigate).toHaveBeenCalledOnce();
    const roomId = parseRoomPath(hook.navigate.mock.calls[0][0]);
    expect(roomId).not.toBeNull();
    const pending = window.sessionStorage.getItem(pendingSeedKey(roomId!));
    expect(JSON.parse(pending!)).toEqual({
      title: 'New Receipt',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      currency: localeCurrency(),
      roster: [],
      items: [],
    });
  });
});
