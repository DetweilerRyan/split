import { describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import * as Y from 'yjs';
import { ReceiptStore, useReceiptStore } from '@/sync/useReceiptStore';
import { type FetchRate, useExchangeRate } from './useExchangeRate';

function fetchesRate(rate: number, date: string) {
  return vi.fn<FetchRate>(() => Promise.resolve({ rate, date }));
}

async function setup(fetchRate: ReturnType<typeof vi.fn<FetchRate>>) {
  const store = new ReceiptStore(new Y.Doc());
  store.setMeta('currency', 'EUR');
  const showToast = vi.fn();
  const hook = await renderHook(() => {
    const snapshot = useReceiptStore(store);
    return useExchangeRate(store, snapshot, fetchRate, showToast);
  });
  function current() {
    return hook.result.current;
  }
  function rate() {
    const { currency, displayCurrency, rate, rateDate } = store.getSnapshot();
    return { currency, displayCurrency, rate, rateDate };
  }
  return { act: hook.act, current, rate, store, showToast };
}

describe('useExchangeRate', () => {
  it('shows the receipt in the currency chosen, at the rate fetched from the receipt currency', async () => {
    const fetchRate = fetchesRate(1.08, '2026-11-20');
    const hook = await setup(fetchRate);
    await hook.act(() => hook.current().changeDisplayCurrency('USD'));
    expect(fetchRate).toHaveBeenCalledExactlyOnceWith('EUR', 'USD', { force: false });
    await expect.poll(hook.rate).toEqual({
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 1.08,
      rateDate: '2026-11-20',
    });
  });

  it('fetches the rate afresh when asked to', async () => {
    const fetchRate = fetchesRate(1.08, '2026-11-20');
    const hook = await setup(fetchRate);
    await hook.act(() => hook.current().changeDisplayCurrency('USD', true));
    expect(fetchRate).toHaveBeenCalledExactlyOnceWith('EUR', 'USD', { force: true });
  });

  it('shows the receipt currency only, with no rate, when no rate can be fetched', async () => {
    const fetchRate = vi.fn<FetchRate>(() => Promise.resolve(null));
    const hook = await setup(fetchRate);
    await hook.act(() => hook.current().changeDisplayCurrency('USD'));
    await expect
      .poll(() => hook.showToast.mock.calls)
      .toEqual([['Exchange rate unavailable offline; showing receipt currency only.']]);
    expect(hook.rate()).toEqual({
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 0,
      rateDate: '',
    });
  });

  it('stops converting, without fetching, when the display currency is cleared or is the receipt currency', async () => {
    const fetchRate = fetchesRate(1.08, '2026-11-20');
    const hook = await setup(fetchRate);
    await hook.act(() => hook.store.setExchangeRate('USD', 1.08, '2026-11-20'));
    await hook.act(() => hook.current().changeDisplayCurrency('EUR'));
    expect(hook.rate()).toEqual({ currency: 'EUR', displayCurrency: '', rate: 0, rateDate: '' });
    await hook.act(() => hook.store.setExchangeRate('USD', 1.08, '2026-11-20'));
    await hook.act(() => hook.current().changeDisplayCurrency(''));
    expect(hook.rate()).toEqual({ currency: 'EUR', displayCurrency: '', rate: 0, rateDate: '' });
    expect(fetchRate).not.toHaveBeenCalled();
  });

  it('fetches the rate from the new receipt currency when the receipt currency changes', async () => {
    const fetchRate = fetchesRate(1.27, '2026-11-21');
    const hook = await setup(fetchRate);
    await hook.act(() => hook.store.setExchangeRate('USD', 1.08, '2026-11-20'));
    await hook.act(() => hook.current().changeCurrency('GBP'));
    expect(fetchRate).toHaveBeenCalledExactlyOnceWith('GBP', 'USD', { force: false });
    await expect.poll(hook.rate).toEqual({
      currency: 'GBP',
      displayCurrency: 'USD',
      rate: 1.27,
      rateDate: '2026-11-21',
    });
  });

  it('fetches no rate when the receipt currency changes while it is shown in its own currency', async () => {
    const fetchRate = fetchesRate(1.27, '2026-11-21');
    const hook = await setup(fetchRate);
    await hook.act(() => hook.current().changeCurrency('GBP'));
    expect(hook.rate()).toEqual({ currency: 'GBP', displayCurrency: '', rate: 0, rateDate: '' });
    expect(fetchRate).not.toHaveBeenCalled();
  });

  it('uses the rate typed in, dated today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    const hook = await setup(fetchesRate(1.08, '2026-11-20'));
    await hook.act(() => hook.store.setExchangeRate('USD', 1.08, '2026-11-20'));
    await hook.act(() => hook.current().setRate(1.1));
    vi.useRealTimers();
    expect(hook.rate()).toEqual({
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 1.1,
      rateDate: '2026-11-24',
    });
  });
});
