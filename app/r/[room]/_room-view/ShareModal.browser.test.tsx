import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import '../../../index.css';
import { ShareModal } from './ShareModal';

const url = 'https://split.example/r/split-r1';

async function renderModal(props: Partial<Parameters<typeof ShareModal>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onCopy: vi.fn() };
  const screen = await render(<ShareModal open url={url} {...handlers} {...props} />);
  return { screen, ...handlers };
}

describe('ShareModal', () => {
  it("shows the room's link and a QR code for it", async () => {
    const { screen } = await renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Share this room' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('textbox', { name: 'Room link' })).toHaveValue(url);
    await expect
      .element(dialog.getByRole('img', { name: 'QR code for the room link' }))
      .toBeVisible();
  });

  it('shows nothing while closed', async () => {
    const { screen } = await renderModal({ open: false });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the link from its button', async () => {
    const { screen, onCopy, onClose } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from its close button', async () => {
    const { screen, onClose } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
