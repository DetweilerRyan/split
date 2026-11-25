import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import type { ReceiptStore } from '@/sync/useReceiptStore';

/** Gets the rate from `base` to `quote`, or null when none is available, as `getExchangeRate` does. */
export type FetchRate = (
  base: string,
  quote: string,
  options: { readonly force: boolean },
) => Promise<{ readonly rate: number; readonly date: string } | null>;

/**
 * Changing the receipt's currency, the currency it's shown in, and the rate between them. A new
 * display currency's rate comes from `fetchRate`.
 */
export function useExchangeRate(
  store: Pick<ReceiptStore, 'setMeta' | 'setExchangeRate'>,
  snapshot: Pick<RoomSnapshot, 'currency' | 'displayCurrency'>,
  fetchRate: FetchRate,
  showToast: (message: string) => void,
) {
  async function changeDisplayCurrency(code: string, force = false, base = snapshot.currency) {
    if (code === '' || code === base) {
      store.setExchangeRate('', 0, '');
      return;
    }
    store.setExchangeRate(code, 0, '');
    const result = await fetchRate(base, code, { force });
    if (result !== null) store.setExchangeRate(code, result.rate, result.date);
    else showToast('Exchange rate unavailable offline; showing receipt currency only.');
  }

  // A new receipt currency needs a new rate to the display currency.
  function changeCurrency(code: string) {
    store.setMeta('currency', code);
    if (snapshot.displayCurrency !== '')
      void changeDisplayCurrency(snapshot.displayCurrency, false, code);
  }

  // A rate typed by hand is dated today.
  function setRate(rate: number) {
    store.setExchangeRate(snapshot.displayCurrency, rate, new Date().toISOString().slice(0, 10));
  }

  return { changeDisplayCurrency, changeCurrency, setRate } as const;
}
