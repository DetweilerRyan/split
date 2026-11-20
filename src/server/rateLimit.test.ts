import { describe, expect, it } from 'vitest';
import { isRateLimited, normalizeIp } from './rateLimit';

describe('isRateLimited', () => {
  it('blocks after the limit within the window and recovers after it', () => {
    expect(isRateLimited('k', 2, 1000, 0)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 1)).toBe(false);
    expect(isRateLimited('k', 2, 1000, 2)).toBe(true);
    expect(isRateLimited('k', 2, 1000, 2000)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('collapses IPv6 to /64 and leaves IPv4 alone', () => {
    expect(normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(normalizeIp('2001:DB8:1:2::1'));
    expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4');
  });
});
