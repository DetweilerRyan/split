import { describe, expect, it, vi } from 'vitest';
import { isRateLimited, normalizeIp } from './rateLimit';

describe('isRateLimited', () => {
  it('blocks after the limit within the window and recovers after it', () => {
    expect(isRateLimited('k', 2, 1000, 0)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 1)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 2)).toBe(true);
    expect(isRateLimited('k', 2, 1000, 2000)).toBe(false);
  });

  it('keeps at most 1000 keys, forgetting idle ones first and then the oldest', async () => {
    // A fresh module, so no other test's keys are in it.
    vi.resetModules();
    const { isRateLimited: limited } = await import('./rateLimit');
    for (let i = 0; i < 998; i++) limited(`ip-${i}`, 1, 1000, 5000);
    limited('idle-a', 1, 1000, 0);
    limited('idle-b', 1, 1000, 0);

    // Full: the two idle keys go, though they're the newest, and the active ones stay.
    limited('new-1', 1, 1000, 5000);
    expect(limited('ip-0', 1, 1000, 5001)).toBe(true);

    // Full of active keys: the oldest, ip-0, goes, so it starts afresh.
    limited('new-2', 1, 1000, 5002);
    limited('new-3', 1, 1000, 5003);
    expect(limited('ip-0', 1, 1000, 5004)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('collapses IPv6 to /64 and leaves IPv4 alone', () => {
    expect(normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(normalizeIp('2001:DB8:1:2::1'));
    expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4');
  });
});
