import { describe, expect, it } from 'vitest';
import { getConnectionStatusDisplay } from '../utils/connectionStatus';

describe('connection status display', () => {
  it.each([
    ['connecting', 'Connecting', 'bg-amber-400', 'text-slate-500'],
    ['connected', 'Connected', 'bg-emerald-500', 'text-emerald-700'],
    ['reconnecting', 'Reconnecting', 'bg-amber-400', 'text-slate-500'],
    ['disconnected', 'Offline', 'bg-rose-500', 'text-slate-500'],
  ] as const)('maps %s to its display state', (status, label, indicatorColor, textColor) => {
    expect(getConnectionStatusDisplay(status)).toEqual({
      label,
      indicatorColor,
      textColor,
    });
  });
});
