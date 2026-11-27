import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { type ReceiptItem, itemIdSchema, participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { ItemRow } from './ItemRow';

const alex = { id: participantIdSchema.parse('p-alex'), name: 'Alex', colorIdx: 0 } as const;
const sam = { id: participantIdSchema.parse('p-sam'), name: 'Sam', colorIdx: 1 } as const;

const tortilla: ReceiptItem = {
  id: itemIdSchema.parse('item-0'),
  name: 'Tortilla',
  en: '',
  eur: 12,
  order: 0,
  claims: {},
};

async function renderRow(props: Partial<Parameters<typeof ItemRow>[0]> = {}) {
  const handlers = { onClaim: vi.fn(), onClaimAll: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn() };
  const screen = await render(
    <ItemRow
      item={tortilla}
      participants={[alex, sam]}
      activeId={alex.id}
      editing={false}
      currency="EUR"
      {...handlers}
      {...props}
    />,
  );
  return { screen, ...handlers };
}

describe('ItemRow', () => {
  describe('when claiming', () => {
    it('shows the item, its price, and that nobody has claimed it', async () => {
      const { screen } = await renderRow();
      await expect
        .element(screen.getByRole('button', { name: 'Tortilla', exact: true }))
        .toBeVisible();
      await expect.element(screen.getByText('€12.00')).toBeVisible();
      await expect.element(screen.getByText('Unclaimed')).toBeVisible();
    });

    it('shows the English name under the item’s own', async () => {
      const { screen } = await renderRow({ item: { ...tortilla, en: 'Potato omelette' } });
      await expect
        .element(screen.getByRole('button', { name: 'Tortilla Potato omelette', exact: true }))
        .toBeVisible();
    });

    it('claims the item for you when you tap it', async () => {
      const { screen, onClaim } = await renderRow({ activeId: sam.id });
      await userEvent.click(screen.getByRole('button', { name: 'Tortilla', exact: true }));
      expect(onClaim).toHaveBeenCalledExactlyOnceWith('item-0', 'p-sam');
    });

    it('claims nothing when you tap the item before choosing who you are', async () => {
      const { screen, onClaim } = await renderRow({ activeId: null });
      await userEvent.click(screen.getByRole('button', { name: 'Tortilla', exact: true }));
      expect(onClaim).not.toHaveBeenCalled();
    });

    it('claims the item for the person whose name you tap', async () => {
      const { screen, onClaim } = await renderRow();
      await userEvent.click(screen.getByRole('button', { name: 'Sam', exact: true }));
      expect(onClaim).toHaveBeenCalledExactlyOnceWith('item-0', 'p-sam');
    });

    it('says one person has it alone', async () => {
      const { screen } = await renderRow({ item: { ...tortilla, claims: { [alex.id]: true } } });
      await expect.element(screen.getByText('Solo')).toBeVisible();
    });

    it('says what each person pays when several share it', async () => {
      const { screen } = await renderRow({
        item: { ...tortilla, claims: { [alex.id]: true, [sam.id]: true } },
      });
      await expect.element(screen.getByText('€6.00 each')).toBeVisible();
    });

    it('counts only claims that are on', async () => {
      const { screen } = await renderRow({
        item: { ...tortilla, claims: { [alex.id]: true, [sam.id]: false } },
      });
      await expect.element(screen.getByText('Solo')).toBeVisible();
    });

    it('claims it for everyone from All when someone hasn’t claimed it', async () => {
      const { screen, onClaimAll } = await renderRow({
        item: { ...tortilla, claims: { [alex.id]: true } },
      });
      await userEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
      expect(onClaimAll).toHaveBeenCalledExactlyOnceWith('item-0', [alex, sam], true);
    });

    it('unclaims it for everyone from All when everyone has claimed it', async () => {
      const { screen, onClaimAll } = await renderRow({
        item: { ...tortilla, claims: { [alex.id]: true, [sam.id]: true } },
      });
      await userEvent.click(screen.getByRole('button', { name: '✓ All', exact: true }));
      expect(onClaimAll).toHaveBeenCalledExactlyOnceWith('item-0', [alex, sam], false);
    });

    it('doesn’t show All as done when nobody is on the bill', async () => {
      const { screen, onClaimAll } = await renderRow({ participants: [], activeId: null });
      await userEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
      expect(onClaimAll).toHaveBeenCalledExactlyOnceWith('item-0', [], true);
    });

    it('offers no fields to edit', async () => {
      const { screen } = await renderRow();
      await expect.element(screen.getByText('Unclaimed')).toBeVisible();
      await expect
        .element(screen.getByRole('textbox', { name: 'Item name' }))
        .not.toBeInTheDocument();
    });
  });

  describe('when editing', () => {
    const coffee: ReceiptItem = { ...tortilla, name: 'Café', en: 'Coffee', eur: 2.5 };

    it('fills each field with the item’s details', async () => {
      const { screen } = await renderRow({ editing: true, item: coffee });
      await expect.element(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('Café');
      await expect
        .element(screen.getByRole('textbox', { name: 'English name' }))
        .toHaveValue('Coffee');
      await expect
        .element(screen.getByRole('spinbutton', { name: 'Price in EUR' }))
        .toHaveValue(2.5);
      await expect
        .element(screen.getByRole('button', { name: 'Tortilla', exact: true }))
        .not.toBeInTheDocument();
    });

    it('saves the name you type when you leave the field', async () => {
      const { screen, onUpdate } = await renderRow({ editing: true, item: coffee });
      await userEvent.fill(screen.getByRole('textbox', { name: 'Item name' }), 'Cortado');
      await userEvent.tab();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('item-0', 'name', 'Cortado');
    });

    it('saves the English name you type when you leave the field', async () => {
      const { screen, onUpdate } = await renderRow({ editing: true, item: coffee });
      await userEvent.fill(screen.getByRole('textbox', { name: 'English name' }), 'Small coffee');
      await userEvent.tab();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('item-0', 'en', 'Small coffee');
    });

    it('saves the price you type as a number when you leave the field', async () => {
      const { screen, onUpdate } = await renderRow({ editing: true, item: coffee });
      await userEvent.fill(screen.getByRole('spinbutton', { name: 'Price in EUR' }), '3.2');
      await userEvent.tab();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('item-0', 'eur', 3.2);
    });

    it('saves a cleared price as zero', async () => {
      const { screen, onUpdate } = await renderRow({ editing: true, item: coffee });
      await userEvent.clear(screen.getByRole('spinbutton', { name: 'Price in EUR' }));
      await userEvent.tab();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('item-0', 'eur', 0);
    });

    it('steps the price by the cent in a currency with cents', async () => {
      const { screen } = await renderRow({ editing: true, item: coffee });
      await expect
        .element(screen.getByRole('spinbutton', { name: 'Price in EUR' }))
        .toHaveAttribute('step', '0.01');
    });

    it('steps the price by the whole unit in a currency with none smaller', async () => {
      const { screen } = await renderRow({ editing: true, item: coffee, currency: 'JPY' });
      await expect
        .element(screen.getByRole('spinbutton', { name: 'Price in JPY' }))
        .toHaveAttribute('step', '1');
    });

    it('deletes the item from its delete button', async () => {
      const { screen, onDelete } = await renderRow({ editing: true, item: coffee });
      await userEvent.click(screen.getByRole('button', { name: 'Delete Café' }));
      expect(onDelete).toHaveBeenCalledExactlyOnceWith('item-0');
    });
  });
});
