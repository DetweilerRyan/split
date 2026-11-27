import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import { EditReceiptDrawer } from './EditReceiptDrawer';

const receipt: RoomSnapshot = {
  title: 'Trattoria Da Enzo',
  address: '',
  phone: '',
  website: '',
  purchasedAt: '',
  mealType: '',
  cardTipEur: 4,
  cashTipEur: 2.5,
  bankUsd: 0,
  currency: 'EUR',
  displayCurrency: '',
  rate: 0,
  rateDate: '',
  participants: [],
  items: [],
  connection: { provider: 'WebRTC', status: 'connected' },
  peers: [],
};

/** Shown in dollars at 1.08, the rate looked up on 6 March. */
const inDollars = { displayCurrency: 'USD', rate: 1.08, rateDate: '2026-03-06' } as const;

async function renderDrawer(details: Partial<RoomSnapshot> = {}) {
  const handlers = {
    onMeta: vi.fn(),
    onCurrency: vi.fn(),
    onDisplayCurrency: vi.fn(),
    onRate: vi.fn(),
    onAddItem: vi.fn(),
  };
  const screen = await render(
    <EditReceiptDrawer snapshot={{ ...receipt, ...details }} {...handlers} />,
  );
  return { screen, ...handlers };
}

describe('EditReceiptDrawer: the receipt', () => {
  it('shows the title and renames the receipt to what you type', async () => {
    const { screen, onMeta } = await renderDrawer();
    const title = screen.getByRole('textbox', { name: 'Receipt title' });
    await expect.element(title).toHaveValue('Trattoria Da Enzo');
    await userEvent.fill(title, 'Da Enzo');
    expect(onMeta).toHaveBeenLastCalledWith('title', 'Da Enzo');
  });

  it("shows the receipt's currency and changes it to the one you choose", async () => {
    const { screen, onCurrency } = await renderDrawer();
    const currency = screen.getByRole('combobox', { name: 'Receipt currency' });
    await expect.element(currency).toHaveDisplayValue('EUR — Euro');
    await userEvent.selectOptions(currency, 'JPY');
    expect(onCurrency).toHaveBeenCalledExactlyOnceWith('JPY');
  });

  it('keeps a receipt currency the browser does not list, as its first choice', async () => {
    const { screen } = await renderDrawer({ currency: 'XYZ' });
    const currency = screen.getByRole('combobox', { name: 'Receipt currency' });
    await expect.element(currency).toHaveValue('XYZ');
    await expect.element(currency.getByRole('option').first()).toHaveTextContent('XYZ');
  });

  it('offers the price step of the receipt currency for the tips and a new item', async () => {
    const { screen } = await renderDrawer({ currency: 'JPY' });
    await expect
      .element(screen.getByRole('spinbutton', { name: 'Card tip (JPY)' }))
      .toHaveAttribute('step', '1');
    await expect
      .element(screen.getByRole('spinbutton', { name: 'Cash tip (JPY)' }))
      .toHaveAttribute('step', '1');
    await expect
      .element(screen.getByRole('spinbutton', { name: 'New item price' }))
      .toHaveAttribute('step', '1');
  });

  it('shows the tips and sets each to the amount you type', async () => {
    const { screen, onMeta } = await renderDrawer();
    const card = screen.getByRole('spinbutton', { name: 'Card tip (EUR)' });
    const cash = screen.getByRole('spinbutton', { name: 'Cash tip (EUR)' });
    await expect.element(card).toHaveValue(4);
    await expect.element(card).toHaveAttribute('step', '0.01');
    await expect.element(cash).toHaveValue(2.5);
    await userEvent.fill(card, '5.5');
    expect(onMeta).toHaveBeenLastCalledWith('cardTipEur', 5.5);
    await userEvent.fill(cash, '');
    expect(onMeta).toHaveBeenLastCalledWith('cashTipEur', 0);
  });

  it('leaves the bank charge empty until there is one, and sets it to the amount you type', async () => {
    const { screen, onMeta } = await renderDrawer();
    const bank = screen.getByRole('spinbutton', { name: 'Bank charge (display currency)' });
    await expect.element(bank).toHaveValue(null);
    await userEvent.fill(bank, '3.75');
    expect(onMeta).toHaveBeenLastCalledWith('bankUsd', 3.75);
  });

  it('shows a bank charge there is', async () => {
    const { screen } = await renderDrawer({ bankUsd: 12.4 });
    await expect
      .element(screen.getByRole('spinbutton', { name: 'Bank charge (display currency)' }))
      .toHaveValue(12.4);
  });
});

describe('EditReceiptDrawer: converting shares', () => {
  it('converts to nothing at first, and asks for no rate', async () => {
    const { screen } = await renderDrawer();
    await expect
      .element(screen.getByRole('combobox', { name: 'Convert shares to (optional)' }))
      .toHaveDisplayValue('None');
    await expect.element(screen.getByRole('spinbutton', { name: /^Rate/ })).not.toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('converts to the currency you choose, which is never the receipt currency', async () => {
    const { screen, onDisplayCurrency } = await renderDrawer();
    const convert = screen.getByRole('combobox', { name: 'Convert shares to (optional)' });
    await expect
      .element(convert.getByRole('option', { name: 'USD — US Dollar' }))
      .toBeInTheDocument();
    await expect
      .element(convert.getByRole('option', { name: 'EUR — Euro' }))
      .not.toBeInTheDocument();
    await userEvent.selectOptions(convert, 'USD');
    expect(onDisplayCurrency).toHaveBeenCalledExactlyOnceWith('USD');
  });

  it('shows the rate and the day it was looked up, and sets the rate you type', async () => {
    const { screen, onRate } = await renderDrawer(inDollars);
    const rate = screen.getByRole('spinbutton', { name: /^Rate \(1 EUR = \? USD\) · 2026-03-06/ });
    await expect.element(rate).toHaveValue(1.08);
    await userEvent.fill(rate, '1.1');
    expect(onRate).toHaveBeenLastCalledWith(1.1);
  });

  it('leaves the rate empty, with no day, until there is one', async () => {
    const { screen } = await renderDrawer({ displayCurrency: 'USD' });
    const rate = screen.getByRole('spinbutton', { name: /^Rate \(1 EUR = \? USD\)/ });
    await expect.element(rate).toHaveValue(null);
    await expect.element(screen.getByText(/·/)).not.toBeInTheDocument();
  });

  it('looks the rate up again when you press refresh', async () => {
    const { screen, onDisplayCurrency } = await renderDrawer(inDollars);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onDisplayCurrency).toHaveBeenCalledExactlyOnceWith('USD', true);
  });
});

describe('EditReceiptDrawer: adding an item', () => {
  it('adds the item you describe, trimmed, and clears the fields', async () => {
    const { screen, onAddItem } = await renderDrawer();
    const name = screen.getByRole('textbox', { name: 'New item name' });
    const english = screen.getByRole('textbox', { name: 'English translation' });
    const price = screen.getByRole('spinbutton', { name: 'New item price' });
    await userEvent.fill(name, '  Cacio e pepe ');
    await userEvent.fill(english, ' Cheese and pepper pasta ');
    await userEvent.fill(price, '14.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddItem).toHaveBeenCalledExactlyOnceWith(
      'Cacio e pepe',
      'Cheese and pepper pasta',
      14.5,
    );
    await expect.element(name).toHaveValue('');
    await expect.element(english).toHaveValue('');
    await expect.element(price).toHaveValue(null);
  });

  it('adds an item with no price at nothing', async () => {
    const { screen, onAddItem } = await renderDrawer();
    await userEvent.fill(screen.getByRole('textbox', { name: 'New item name' }), 'Bread');
    await userEvent.keyboard('{Enter}');
    expect(onAddItem).toHaveBeenCalledExactlyOnceWith('Bread', '', 0);
  });

  it('adds nothing when the name is blank, and keeps what you typed', async () => {
    const { screen, onAddItem } = await renderDrawer();
    const name = screen.getByRole('textbox', { name: 'New item name' });
    await userEvent.fill(name, '   ');
    await userEvent.fill(screen.getByRole('spinbutton', { name: 'New item price' }), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddItem).not.toHaveBeenCalled();
    await expect.element(name).toHaveValue('   ');
  });
});
