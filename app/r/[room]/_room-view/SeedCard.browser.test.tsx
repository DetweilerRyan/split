import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { SeedCard } from './SeedCard';

describe('SeedCard', () => {
  it("counts the receipt's people and items", async () => {
    const screen = await render(<SeedCard participantCount={1} itemCount={2} onOpen={vi.fn()} />);
    await expect.element(screen.getByText('1 people · 2 items')).toBeVisible();
  });

  it('opens the seed dialog from its button', async () => {
    const onOpen = vi.fn();
    const screen = await render(<SeedCard participantCount={0} itemCount={0} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Seed / presets' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
