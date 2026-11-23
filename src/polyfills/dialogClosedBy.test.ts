import { describe, expect, it, vi } from 'vitest';
import { loadDialogClosedByPolyfill } from './dialogClosedBy';

describe('loadDialogClosedByPolyfill', () => {
  it('loads the polyfill where dialogs have no closedBy', async () => {
    const load = vi.fn(() => Promise.resolve('polyfill'));
    await expect(loadDialogClosedByPolyfill({}, load)).resolves.toBe('polyfill');
    expect(load).toHaveBeenCalledOnce();
  });

  it('loads nothing where dialogs support closedBy', () => {
    const load = vi.fn(() => Promise.resolve('polyfill'));
    expect(loadDialogClosedByPolyfill({ closedBy: 'auto' }, load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
