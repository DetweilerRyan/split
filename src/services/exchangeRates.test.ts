import { describe, expect, it, vi } from 'vitest';
import { type ExchangeRate, type RateSources, RATE_TTL_MS, getExchangeRate } from './exchangeRates';

const NOW = Date.UTC(2026, 10, 25, 12);

const cachedRate: ExchangeRate = {
  base: 'EUR',
  quote: 'USD',
  rate: 1.05,
  date: '2026-11-24',
  fetchedAt: NOW - 60_000,
};

/** The rate provider's answer to a request for EUR to USD. */
const providerAnswer = { amount: 1, base: 'EUR', date: '2026-11-25', rates: { USD: 1.1 } };

const fetchedRate: ExchangeRate = {
  base: 'EUR',
  quote: 'USD',
  rate: 1.1,
  date: '2026-11-25',
  fetchedAt: NOW,
};

type Answer =
  | { readonly kind: 'json'; readonly body: unknown; readonly status?: number }
  | { readonly kind: 'offline' };

/** A cache that keeps what it's given in memory, as IndexedDB keeps it between visits. */
function fakeCache(entries: Readonly<Record<string, ExchangeRate>> = {}) {
  const stored = new Map(Object.entries(entries));
  return {
    stored,
    read: vi.fn((key: string) => Promise.resolve(stored.get(key) ?? null)),
    write: vi.fn((key: string, rate: ExchangeRate) => {
      stored.set(key, rate);
      return Promise.resolve();
    }),
  };
}

/** A network that gives every request the same answer, or fails as it does offline. */
function fakeFetch(answer: Answer) {
  return vi.fn((_url: string) => {
    if (answer.kind === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    const status = answer.status ?? 200;
    const body: unknown = answer.body;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  });
}

function sources(
  answer: Answer,
  entries: Readonly<Record<string, ExchangeRate>> = {},
): RateSources & {
  readonly cache: ReturnType<typeof fakeCache>;
  readonly fetch: ReturnType<typeof fakeFetch>;
} {
  return { cache: fakeCache(entries), fetch: fakeFetch(answer) };
}

const online: Answer = { kind: 'json', body: providerAnswer };
const offline: Answer = { kind: 'offline' };

describe('getExchangeRate', () => {
  describe('between a currency and itself', () => {
    it('is 1, asking neither the cache nor the network', async () => {
      const fakes = sources(online);
      await expect(getExchangeRate('JPY', 'jpy', { now: NOW }, fakes)).resolves.toEqual({
        base: 'JPY',
        quote: 'JPY',
        rate: 1,
        date: '',
        fetchedAt: NOW,
      });
      expect(fakes.cache.read).not.toHaveBeenCalled();
      expect(fakes.fetch).not.toHaveBeenCalled();
    });

    it('is 1 for two codes it doesn’t know, which both read as USD', async () => {
      const fakes = sources(online);
      await expect(getExchangeRate('', 'XX', { now: NOW }, fakes)).resolves.toMatchObject({
        base: 'USD',
        quote: 'USD',
        rate: 1,
      });
    });
  });

  describe('with a fresh rate in the cache', () => {
    it('gives the cached rate without asking the network', async () => {
      const fakes = sources(online, { 'EUR:USD': cachedRate });
      await expect(getExchangeRate('eur', 'usd', { now: NOW }, fakes)).resolves.toEqual(cachedRate);
      expect(fakes.fetch).not.toHaveBeenCalled();
    });

    it('still counts a rate as fresh a moment before it’s 12 hours old', async () => {
      const fakes = sources(online, {
        'EUR:USD': { ...cachedRate, fetchedAt: NOW - RATE_TTL_MS + 1 },
      });
      await getExchangeRate('EUR', 'USD', { now: NOW }, fakes);
      expect(fakes.fetch).not.toHaveBeenCalled();
    });

    it('asks the network anyway when forced to', async () => {
      const fakes = sources(online, { 'EUR:USD': cachedRate });
      await expect(
        getExchangeRate('EUR', 'USD', { force: true, now: NOW }, fakes),
      ).resolves.toEqual(fetchedRate);
    });
  });

  describe('fetching a rate', () => {
    it('asks the provider for the quote against the base', async () => {
      const fakes = sources(online);
      await getExchangeRate('eur', 'usd', { now: NOW }, fakes);
      expect(fakes.fetch).toHaveBeenCalledExactlyOnceWith(
        'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD',
      );
    });

    it('gives the provider’s rate and date, and caches it under the pair', async () => {
      const fakes = sources(online);
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(
        fetchedRate,
      );
      expect(fakes.cache.write).toHaveBeenCalledExactlyOnceWith('EUR:USD', fetchedRate);
    });

    it('replaces a rate that is 12 hours old', async () => {
      const fakes = sources(online, {
        'EUR:USD': { ...cachedRate, fetchedAt: NOW - RATE_TTL_MS },
      });
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(
        fetchedRate,
      );
      expect(fakes.cache.stored.get('EUR:USD')).toEqual(fetchedRate);
    });

    it('gives the rate an empty date when the provider names none', async () => {
      const fakes = sources({ kind: 'json', body: { rates: { USD: 1.1 } } });
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual({
        ...fetchedRate,
        date: '',
      });
    });

    it('uses the current time when given none', async () => {
      vi.useFakeTimers({ now: NOW });
      try {
        await expect(getExchangeRate('EUR', 'USD', {}, sources(online))).resolves.toEqual(
          fetchedRate,
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('when the network fails or gives no usable rate', () => {
    const stale: ExchangeRate = { ...cachedRate, fetchedAt: NOW - 2 * RATE_TTL_MS };

    it('falls back on a stale cached rate when offline', async () => {
      const fakes = sources(offline, { 'EUR:USD': stale });
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(stale);
    });

    it('gives no rate when offline with nothing cached', async () => {
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, sources(offline))).resolves.toBe(
        null,
      );
    });

    it('falls back on the cached rate when the provider answers with an error, whatever its body', async () => {
      const fakes = sources(
        { kind: 'json', body: providerAnswer, status: 503 },
        { 'EUR:USD': stale },
      );
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(stale);
      expect(fakes.cache.write).not.toHaveBeenCalled();
    });

    it('falls back on the cached rate when the provider’s answer isn’t one it can read', async () => {
      const fakes = sources({ kind: 'json', body: 'Service unavailable' }, { 'EUR:USD': stale });
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(stale);
    });

    it('falls back on the cached rate when it can’t cache the new one', async () => {
      const fakes = sources(online, { 'EUR:USD': stale });
      fakes.cache.write.mockRejectedValueOnce(new Error('QuotaExceededError'));
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toEqual(stale);
    });

    it.each([
      ['no rates at all', { date: '2026-11-25' }],
      ['no rate for the quote', { date: '2026-11-25', rates: { GBP: 0.85 } }],
      ['a rate that isn’t a number', { date: '2026-11-25', rates: { USD: '1.1' } }],
      ['a rate of zero', { date: '2026-11-25', rates: { USD: 0 } }],
      ['a negative rate', { date: '2026-11-25', rates: { USD: -1.1 } }],
      ['an infinite rate', { date: '2026-11-25', rates: { USD: Infinity } }],
      ['a rate that isn’t a number at all', { date: '2026-11-25', rates: { USD: NaN } }],
    ])('caches nothing and gives no rate when the provider gives %s', async (_case, body) => {
      const fakes = sources({ kind: 'json', body });
      await expect(getExchangeRate('EUR', 'USD', { now: NOW }, fakes)).resolves.toBe(null);
      expect(fakes.cache.write).not.toHaveBeenCalled();
    });
  });
});
