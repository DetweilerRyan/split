import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import '../../../index.css';
import { ReceiptEditor } from './ReceiptEditor';
import { type ExchangeRate, type RateSources, getExchangeRate } from '@/services/exchangeRates';
import { ReceiptStore } from '@/sync/useReceiptStore';

// The editor runs for real over a real store and the real exchange-rate service, which runs over a
// fake network and an in-memory cache.
async function renderEditor() {
  const store = new ReceiptStore(new Y.Doc());
  store.setMeta('title', 'Trattoria Da Enzo');
  store.setMeta('currency', 'EUR');
  const rates = new Map<string, ExchangeRate>();
  const network = vi.fn<RateSources['fetch']>((url) => {
    const quote = new URL(url).searchParams.get('symbols') ?? '';
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: '2026-11-20', rates: { [quote]: 1.08 } }),
    });
  });
  const sources: RateSources = {
    cache: {
      read: (key) => Promise.resolve(rates.get(key) ?? null),
      write: (key, rate) => Promise.resolve(void rates.set(key, rate)),
    },
    fetch: network,
  };
  function fetchRate(base: string, quote: string, options: { readonly force: boolean }) {
    return getExchangeRate(base, quote, options, sources);
  }
  const notify = vi.fn<(message: string) => void>();
  const screen = await render(
    <ReceiptEditor store={store} fetchRate={fetchRate} notify={notify} />,
  );
  return { screen, store, network, notify };
}

describe('ReceiptEditor', () => {
  it("shows the room's receipt, and saves the title you type to it", async () => {
    const { screen, store } = await renderEditor();
    const title = screen.getByRole('textbox', { name: 'Receipt title' });
    await expect.element(title).toHaveValue('Trattoria Da Enzo');
    await userEvent.fill(title, 'Da Enzo');
    expect(store.getSnapshot().title).toBe('Da Enzo');
  });

  it('adds the item you describe to the room', async () => {
    const { screen, store } = await renderEditor();
    await userEvent.fill(screen.getByRole('textbox', { name: 'New item name' }), 'Bread');
    await userEvent.fill(screen.getByRole('spinbutton', { name: 'New item price' }), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(store.getSnapshot().items.map((item) => item.name)).toStrictEqual(['Bread']);
  });

  it('fetches the rate to the currency you convert to, and shows it', async () => {
    const { screen, network } = await renderEditor();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Convert shares to (optional)' }),
      'USD',
    );
    await expect
      .element(screen.getByRole('spinbutton', { name: /^Rate \(1 EUR = \? USD\)/ }))
      .toHaveValue(1.08);
    expect(network).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('?base=EUR&symbols=USD'),
    );
  });

  it("tells you when the rate can't be fetched", async () => {
    const { screen, network, notify } = await renderEditor();
    network.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Convert shares to (optional)' }),
      'USD',
    );
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledExactlyOnceWith(
        'Exchange rate unavailable offline; showing receipt currency only.',
      ),
    );
  });
});
