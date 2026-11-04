import { normalizeCurrency } from './currency';

export interface ExchangeRate {
  base: string;
  quote: string;
  rate: number;
  /** Publication date of the rate (YYYY-MM-DD) as reported by the provider. */
  date: string;
  /** Epoch ms when the rate was fetched. */
  fetchedAt: number;
}

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
      request.onsuccess = () => resolve((request.result as ExchangeRate | undefined) ?? null);
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

/**
 * Gets a base->quote rate. Fresh cached values are used first; on network failure a stale
 * cached value is returned. Resolves to null when no rate is available (e.g. offline).
 */
export async function getExchangeRate(
  baseCode: string,
  quoteCode: string,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
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
    const data = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = data.rates?.[quote];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error('No rate');
    const fresh: ExchangeRate = { base, quote, rate, date: String(data.date ?? ''), fetchedAt: now };
    await writeCache(key, fresh);
    return fresh;
  } catch {
    return cached;
  }
}
