import { z } from 'zod';
import { normalizeCurrency } from '../domain/money/currency';

/** A rate as it's cached in IndexedDB, which gives back whatever it was given. */
const exchangeRateSchema = z
  .object({
    base: z.string(),
    quote: z.string(),
    rate: z.number(),
    /** Publication date of the rate (YYYY-MM-DD) as reported by the provider. */
    date: z.string(),
    /** Epoch ms when the rate was fetched. */
    fetchedAt: z.number(),
  })
  .readonly();
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;

/** What the rate provider answers, checked only as far as getExchangeRate reads it. */
const rateResponseSchema = z.object({
  date: z.unknown(),
  rates: z.record(z.string(), z.unknown()).optional(),
});

const DB_NAME = 'splitsmart-rates';
const STORE = 'rates';
export const RATE_TTL_MS = 12 * 60 * 60 * 1000;
const API = 'https://api.frankfurter.dev/v1/latest';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readCache(key: string): Promise<ExchangeRate | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve(exchangeRateSchema.safeParse(request.result).data ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeCache(key: string, value: ExchangeRate): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// @crap-allow CRAP 240, complexity 15. Debt from before the CRAP check (#63): no tests yet.
/**
 * Gets a base->quote rate. Fresh cached values are used first; on network failure a stale
 * cached value is returned. Resolves to null when no rate is available (e.g. offline).
 */
export async function getExchangeRate(
  baseCode: string,
  quoteCode: string,
  { force = false, now = Date.now() }: { readonly force?: boolean; readonly now?: number } = {},
): Promise<ExchangeRate | null> {
  const base = normalizeCurrency(baseCode);
  const quote = normalizeCurrency(quoteCode);
  if (base === quote) return { base, quote, rate: 1, date: '', fetchedAt: now };

  const key = `${base}:${quote}`;
  const cached = await readCache(key);
  if (cached && !force && now - cached.fetchedAt < RATE_TTL_MS) return cached;

  try {
    const response = await fetch(`${API}?base=${base}&symbols=${quote}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = rateResponseSchema.parse(await response.json());
    const rate = data.rates?.[quote];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error('No rate');
    const fresh: ExchangeRate = {
      base,
      quote,
      rate,
      date: String(data.date ?? ''),
      fetchedAt: now,
    };
    await writeCache(key, fresh);
    return fresh;
  } catch {
    return cached;
  }
}
