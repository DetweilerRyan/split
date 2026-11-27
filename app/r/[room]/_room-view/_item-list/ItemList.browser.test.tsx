import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { type ReceiptItem, itemIdSchema, participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { ItemList } from './ItemList';

const alex = { id: participantIdSchema.parse('p-alex'), name: 'Alex', colorIdx: 0 } as const;
const sam = { id: participantIdSchema.parse('p-sam'), name: 'Sam', colorIdx: 1 } as const;

const tortilla: ReceiptItem = {
  id: itemIdSchema.parse('item-0'),
  name: 'Tortilla',
  en: '',
  eur: 12,
  order: 0,
  claims: { [alex.id]: true },
};
const bread: ReceiptItem = {
  id: itemIdSchema.parse('item-1'),
  name: 'Bread',
  en: '',
  eur: 3,
  order: 1,
  claims: { [sam.id]: true },
};
const water: ReceiptItem = {
  id: itemIdSchema.parse('item-2'),
  name: 'Water',
  en: '',
  eur: 2,
  order: 2,
  claims: {},
};

async function renderList(props: Partial<Parameters<typeof ItemList>[0]> = {}) {
  const handlers = { onClaim: vi.fn(), onClaimAll: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn() };
  const screen = await render(
    <ItemList
      items={[tortilla, bread, water]}
      participants={[alex, sam]}
      activeId={alex.id}
      editing={false}
      currency="EUR"
      filter="all"
      {...handlers}
      {...props}
    />,
  );
  function row(name: string) {
    return screen.getByRole('button', { name, exact: true });
  }
  return { screen, row, ...handlers };
}

describe('ItemList', () => {
  it('shows how many items there are and their total', async () => {
    const { screen } = await renderList();
    const list = screen.getByRole('region', { name: 'Receipt items' });
    await expect.element(list.getByText('3 line items · tap to claim')).toBeVisible();
    await expect.element(list.getByText('€17.00')).toBeVisible();
  });

  it('shows every item under the all filter', async () => {
    const { row } = await renderList();
    await expect.element(row('Tortilla')).toBeVisible();
    await expect.element(row('Bread')).toBeVisible();
    await expect.element(row('Water')).toBeVisible();
  });

  it('shows only items nobody has claimed under the unclaimed filter', async () => {
    const { row } = await renderList({ filter: 'unclaimed' });
    await expect.element(row('Water')).toBeVisible();
    await expect.element(row('Tortilla')).not.toBeInTheDocument();
    await expect.element(row('Bread')).not.toBeInTheDocument();
  });

  it('shows only your items under the mine filter', async () => {
    const { row } = await renderList({ filter: 'mine' });
    await expect.element(row('Tortilla')).toBeVisible();
    await expect.element(row('Bread')).not.toBeInTheDocument();
    await expect.element(row('Water')).not.toBeInTheDocument();
  });

  it('shows no items under the mine filter before you choose who you are', async () => {
    const { screen } = await renderList({ filter: 'mine', activeId: null });
    await expect.element(screen.getByText('No items match this filter.')).toBeVisible();
  });

  it('still counts and totals every item while a filter hides some', async () => {
    const { screen } = await renderList({ filter: 'unclaimed' });
    await expect.element(screen.getByText('3 line items · tap to claim')).toBeVisible();
    await expect.element(screen.getByText('€17.00')).toBeVisible();
  });

  it("passes a row's claim for everyone on, with everyone on the bill", async () => {
    const { screen, onClaimAll } = await renderList({ items: [water] });
    await userEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
    expect(onClaimAll).toHaveBeenCalledExactlyOnceWith('item-2', [alex, sam], true);
  });

  it('offers its rows for editing while editing, and passes their edits on', async () => {
    const { screen, onUpdate } = await renderList({ items: [water], editing: true });
    await userEvent.fill(screen.getByRole('textbox', { name: 'Item name' }), 'Sparkling water');
    await userEvent.tab();
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('item-2', 'name', 'Sparkling water');
  });

  it("passes a row's deletion on while editing", async () => {
    const { screen, onDelete } = await renderList({ items: [water], editing: true });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Water' }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('item-2');
  });

  it('offers no fields to edit while not editing', async () => {
    const { screen } = await renderList({ items: [water] });
    await expect
      .element(screen.getByRole('textbox', { name: 'Item name' }))
      .not.toBeInTheDocument();
  });

  it("passes a row's claim on, for you", async () => {
    const { row, onClaim } = await renderList();
    await userEvent.click(row('Water'));
    expect(onClaim).toHaveBeenCalledExactlyOnceWith('item-2', 'p-alex');
  });
});
