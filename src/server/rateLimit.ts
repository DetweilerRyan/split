// Best-effort per-instance limiter; serverless instances each keep their own window.
// The Vercel Firewall rule is the real, global per-IP enforcement.
const MAX_KEYS = 1000;
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit = 30, windowMs = 60_000, now = Date.now()): boolean {
  if (hits.size >= MAX_KEYS) {
    for (const [k, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(k);
    }
    // Still full of active keys: drop the oldest rather than grow without bound.
    if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value as string);
  }
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  const limited = recent.length >= limit;
  if (!limited) recent.push(now);
  hits.set(key, recent);
  return limited;
}

/** Collapses IPv6 to its /64 so one host can't dodge limits by rotating addresses. */
export function normalizeIp(ip: string): string {
  if (!ip.includes(':') || ip.includes('.')) return ip;
  const [head, tail = ''] = ip.split('::');
  const groups = head ? head.split(':') : [];
  const rest = tail ? tail.split(':') : [];
  const full = [...groups, ...Array(Math.max(0, 8 - groups.length - rest.length)).fill('0'), ...rest];
  return full.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
