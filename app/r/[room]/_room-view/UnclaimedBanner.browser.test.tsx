import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { type ReceiptItem, itemIdSchema, participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { UnclaimedBanner } from './UnclaimedBanner';

const alex = participantIdSchema.parse('p-alex');

function item(id: string, eur: number, claimed: boolean): ReceiptItem {
  return {
    id: itemIdSchema.parse(id),
    name: id,
    en: '',
    eur,
    order: 0,
    claims: claimed ? { [alex]: true } : {},
  };
}

async function renderBanner(props: Partial<Parameters<typeof UnclaimedBanner>[0]> = {}) {
  const onFilter = vi.fn();
  const items = [item('item-0', 10, true), item('item-1', 4, false)];
  const screen = await render(
    <UnclaimedBanner
      items={items}
      total={14}
      currency="EUR"
      filter="all"
      onFilter={onFilter}
      {...props}
    />,
  );
  return { screen, onFilter };
}

describe('UnclaimedBanner', () => {
  it('shows how much is still unclaimed', async () => {
    const { screen } = await renderBanner();
    await expect.element(screen.getByText('€4.00 unclaimed')).toBeVisible();
  });

  it('says all is claimed once every item has a claim', async () => {
    const { screen } = await renderBanner({ items: [item('item-0', 10, true)], total: 10 });
    await expect.element(screen.getByText('All claimed')).toBeVisible();
  });

  it('counts a claim that is off as no claim', async () => {
    const off = { ...item('item-0', 10, false), claims: { [alex]: false } };
    const { screen } = await renderBanner({ items: [off], total: 10 });
    await expect.element(screen.getByText('€10.00 unclaimed')).toBeVisible();
  });

  it('chooses each filter from its button', async () => {
    const { screen, onFilter } = await renderBanner();
    await userEvent.click(screen.getByRole('button', { name: 'unclaimed' }));
    await userEvent.click(screen.getByRole('button', { name: 'mine' }));
    await userEvent.click(screen.getByRole('button', { name: 'all' }));
    expect(onFilter.mock.calls).toStrictEqual([['unclaimed'], ['mine'], ['all']]);
  });
});
