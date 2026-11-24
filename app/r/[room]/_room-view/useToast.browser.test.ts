import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useToast } from './useToast';

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast', () => {
  it('shows no message at first', async () => {
    const hook = await renderHook(() => useToast(2600));
    expect(hook.result.current.message).toBe('');
  });

  it('shows the message for as long as it is given, then clears it', async () => {
    vi.useFakeTimers();
    const hook = await renderHook(() => useToast(2600));
    await hook.act(() => hook.result.current.showToast('Room link copied.'));
    expect(hook.result.current.message).toBe('Room link copied.');
    await hook.act(() => vi.advanceTimersByTime(2599));
    expect(hook.result.current.message).toBe('Room link copied.');
    await hook.act(() => vi.advanceTimersByTime(1));
    expect(hook.result.current.message).toBe('');
  });

  it('replaces the message shown with a newer one', async () => {
    const hook = await renderHook(() => useToast(2600));
    await hook.act(() => hook.result.current.showToast('Room link copied.'));
    await hook.act(() => hook.result.current.showToast('Summary copied.'));
    expect(hook.result.current.message).toBe('Summary copied.');
  });
});
