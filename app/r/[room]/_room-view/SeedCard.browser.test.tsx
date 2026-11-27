import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { type ReceiptItem, itemIdSchema, participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { SeedCard } from './SeedCard';

const alex = { id: participantIdSchema.parse('p-alex'), name: 'Alex', colorIdx: 0 } as const;
const pizza: ReceiptItem = {
  id: itemIdSchema.parse('item-0'),
  name: 'Pizza',
  en: '',
  eur: 10,
  order: 0,
  claims: {},
};

describe('SeedCard', () => {
  it("counts the receipt's people and items", async () => {
    const screen = await render(
      <SeedCard snapshot={{ participants: [alex], items: [pizza, pizza] }} onOpen={vi.fn()} />,
    );
    await expect.element(screen.getByText('1 people · 2 items')).toBeVisible();
  });

  it('opens the seed dialog from its button', async () => {
    const onOpen = vi.fn();
    const screen = await render(
      <SeedCard snapshot={{ participants: [], items: [] }} onOpen={onOpen} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Seed / presets' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
