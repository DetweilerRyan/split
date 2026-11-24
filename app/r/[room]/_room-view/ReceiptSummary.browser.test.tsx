import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import '@/index.css';
import { computeReceiptMath } from '@/domain/receipt/math';
import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import { EMPTY_SNAPSHOT } from '@/sync/useReceiptStore';
import { ReceiptSummary } from './ReceiptSummary';

// €15.50 of items and a €2 card tip: €17.50 on the card.
const receipt: RoomSnapshot = {
  ...EMPTY_SNAPSHOT,
  title: 'Trattoria Da Enzo',
  currency: 'EUR',
  cardTipEur: 2,
  items: [
    { id: 'item-0', name: 'Pizza', en: '', eur: 10, order: 0, claims: {} },
    { id: 'item-1', name: 'Wine', en: '', eur: 5.5, order: 1, claims: {} },
  ],
};

async function renderSummary(snapshot: RoomSnapshot) {
  const onCopySummary = vi.fn();
  const screen = await render(
    <ReceiptSummary
      snapshot={snapshot}
      math={computeReceiptMath(snapshot)}
      onCopySummary={onCopySummary}
    />,
  );
  // Each line of the summary, its term and its value as a person reads them.
  async function expectRow(term: string, value: string) {
    await expect
      .element(screen.getByRole('term').and(screen.getByText(term, { exact: true })))
      .toBeVisible();
    await expect
      .element(screen.getByRole('definition').and(screen.getByText(value, { exact: true })))
      .toBeVisible();
  }
  return { screen, expectRow, onCopySummary };
}

describe('ReceiptSummary', () => {
  it('names the receipt and gives its currency, items subtotal and card total', async () => {
    const { screen, expectRow } = await renderSummary(receipt);
    await expect.element(screen.getByRole('heading', { name: 'Trattoria Da Enzo' })).toBeVisible();
    await expectRow('Currency', 'EUR');
    await expectRow('Items subtotal', '€15.50');
    await expectRow('Card total', '€17.50');
  });

  it('copies the summary from its button', async () => {
    const { screen, onCopySummary } = await renderSummary(receipt);
    await userEvent.click(screen.getByRole('button', { name: 'Copy summary' }));
    expect(onCopySummary).toHaveBeenCalledOnce();
  });

  it('gives no rate while the receipt is shown in its own currency', async () => {
    const { screen } = await renderSummary(receipt);
    await expect.element(screen.getByText('Exchange rate')).not.toBeInTheDocument();
    await expect.element(screen.getByText('Bank charge')).not.toBeInTheDocument();
  });

  it("gives the bank's charge, and the rate it works out to, with no date", async () => {
    const { expectRow } = await renderSummary({
      ...receipt,
      bankUsd: 19.25,
      rateDate: '2026-11-20',
    });
    await expectRow('Bank charge', '$19.25');
    await expectRow('Exchange rate', '1.1000 USD / EUR');
  });

  it('gives the fetched rate with its date when the bank charged nothing', async () => {
    const { screen, expectRow } = await renderSummary({
      ...receipt,
      displayCurrency: 'USD',
      rate: 1.08,
      rateDate: '2026-11-20',
    });
    await expectRow('Exchange rate (2026-11-20)', '1.0800 USD / EUR');
    await expect.element(screen.getByText('Bank charge')).not.toBeInTheDocument();
  });
});
