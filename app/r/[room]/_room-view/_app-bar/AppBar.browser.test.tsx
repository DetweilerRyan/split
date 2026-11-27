import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { AppBar } from './AppBar';

const alex = { id: participantIdSchema.parse('p-alex'), name: 'Alex', colorIdx: 0 } as const;

const enzo = {
  title: 'Trattoria Da Enzo',
  purchasedAt: '2026-03-06T19:30',
  mealType: 'Dinner',
  connection: { provider: 'WebRTC', status: 'connected' },
  peers: [{ id: 'peer-1', name: 'Alex' }],
} as const;

async function renderBar(
  props: Partial<Parameters<typeof AppBar>[0]> = {},
  snapshot: Partial<Parameters<typeof AppBar>[0]['snapshot']> = {},
) {
  const handlers = { onDetails: vi.fn(), onIdentity: vi.fn(), onEdit: vi.fn(), onShare: vi.fn() };
  const screen = await render(
    <AppBar
      snapshot={{ ...enzo, ...snapshot }}
      you={null}
      editing={false}
      {...handlers}
      {...props}
    />,
  );
  return { screen, banner: screen.getByRole('banner'), ...handlers };
}

describe('AppBar', () => {
  it('names the receipt, when it was and the meal, and opens its details', async () => {
    const { banner, onDetails } = await renderBar();
    const details = banner.getByRole('button', {
      name: 'Restaurant details for Trattoria Da Enzo',
    });
    await expect.element(details.getByText('T', { exact: true })).toBeVisible();
    await expect.element(details.getByText(/^Fri, Mar 6, 2026 · 7:30\sPM$/)).toBeVisible();
    await expect.element(details.getByText('Dinner')).toBeVisible();
    await userEvent.click(details);
    expect(onDetails).toHaveBeenCalledOnce();
  });

  it('shows only the day when the receipt has no time', async () => {
    const { banner } = await renderBar({}, { purchasedAt: '2026-03-06' });
    await expect.element(banner.getByText('Fri, Mar 6, 2026', { exact: true })).toBeVisible();
  });

  it('says the date is missing, and shows no meal, when the receipt has neither', async () => {
    const { banner } = await renderBar({}, { purchasedAt: '', mealType: '' });
    await expect.element(banner.getByText('Date not on receipt')).toBeVisible();
    await expect.element(banner.getByText('Dinner')).not.toBeInTheDocument();
  });

  it('shows a placeholder initial for an untitled receipt', async () => {
    const { banner } = await renderBar({}, { title: '  ' });
    await expect.element(banner.getByText('¤', { exact: true })).toBeVisible();
  });

  it('asks who you are until you pick, then shows your name', async () => {
    const { banner, onIdentity } = await renderBar();
    await userEvent.click(banner.getByRole('button', { name: 'Who are you?' }));
    expect(onIdentity).toHaveBeenCalledOnce();
    const picked = await renderBar({ you: alex });
    await expect
      .element(picked.banner.getByRole('button', { name: 'Alex', exact: true }))
      .toBeVisible();
  });

  it('offers to edit the receipt, or to finish while editing', async () => {
    const { banner, onEdit } = await renderBar();
    await userEvent.click(banner.getByRole('button', { name: 'Edit receipt' }));
    expect(onEdit).toHaveBeenCalledOnce();
    const editing = await renderBar({ editing: true });
    await expect
      .element(editing.banner.getByRole('button', { name: 'Done editing receipt' }))
      .toBeVisible();
  });

  it('shares the room', async () => {
    const { banner, onShare } = await renderBar();
    await userEvent.click(banner.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('says how the room is connected and how many people are online', async () => {
    const { banner } = await renderBar(
      {},
      { connection: { provider: 'Liveblocks', status: 'reconnecting' } },
    );
    await expect
      .element(banner.getByRole('status'))
      .toHaveAccessibleName('Liveblocks reconnecting, 1 connections online');
  });
});
