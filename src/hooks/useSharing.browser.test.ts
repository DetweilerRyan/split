import { describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { buildExportText } from '../domain/receipt/exportText';
import { roomIdSchema } from '../domain/room/roomId';
import { EMPTY_SNAPSHOT } from '../sync/useReceiptStore';
import { type CopyTarget, useSharing } from './useSharing';

const roomId = roomIdSchema.parse('split-r1');
const snapshot = { ...EMPTY_SNAPSHOT, title: 'Trattoria Da Enzo' };

function fakeClipboard() {
  return { writeText: vi.fn(async () => undefined) };
}

// `null` stands for no clipboard, since `undefined` would take the default.
async function setup(target: CopyTarget | null = fakeClipboard()) {
  const clipboard = target ?? undefined;
  const showToast = vi.fn();
  const hook = await renderHook(() => useSharing(roomId, snapshot, clipboard, showToast));
  function current() {
    return hook.result.current;
  }
  return { act: hook.act, current, clipboard, showToast };
}

describe('useSharing', () => {
  it("links to the room's page on this site", async () => {
    const hook = await setup();
    expect(hook.current().url).toBe(`${window.location.origin}/r/split-r1`);
  });

  it('opens and closes the share dialog', async () => {
    const hook = await setup();
    expect(hook.current().open).toBe(false);
    await hook.act(() => hook.current().openDialog());
    expect(hook.current().open).toBe(true);
    await hook.act(() => hook.current().closeDialog());
    expect(hook.current().open).toBe(false);
  });

  it('copies the room link, then says so', async () => {
    const hook = await setup();
    await hook.act(() => hook.current().copyLink());
    expect(hook.clipboard?.writeText).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/r/split-r1`,
    );
    await expect.poll(() => hook.showToast.mock.calls).toEqual([['Room link copied.']]);
  });

  it("copies the receipt's summary, then says so", async () => {
    const hook = await setup();
    await hook.act(() => hook.current().copySummary());
    expect(hook.clipboard?.writeText).toHaveBeenCalledExactlyOnceWith(buildExportText(snapshot));
    await expect.poll(() => hook.showToast.mock.calls).toEqual([['Summary copied.']]);
  });

  it('copies nothing, and says nothing, where there is no clipboard', async () => {
    const hook = await setup(null);
    await hook.act(() => hook.current().copyLink());
    await hook.act(() => hook.current().copySummary());
    expect(hook.showToast).not.toHaveBeenCalled();
  });
});
