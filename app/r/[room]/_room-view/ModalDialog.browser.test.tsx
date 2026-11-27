import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { ModalDialog } from './ModalDialog';
import { ToastContext } from './Toast';

async function renderDialog(toast = '') {
  const onClose = vi.fn();
  const clickedBehind = vi.fn();
  const screen = await render(
    <ToastContext value={toast}>
      <button onClick={clickedBehind}>Behind the dialog</button>
      <ModalDialog labelledBy="title" onClose={onClose}>
        <h2 id="title">Share this room</h2>
        <button>Copy link</button>
      </ModalDialog>
    </ToastContext>,
  );
  return {
    screen,
    onClose,
    clickedBehind,
    dialog: screen.getByRole('dialog', { name: 'Share this room' }),
  };
}

describe('ModalDialog', () => {
  it('opens named by its heading, with focus inside it', async () => {
    const { dialog } = await renderDialog();
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Copy link' })).toHaveFocus();
  });

  it('keeps the page behind it from being clicked', async () => {
    const { screen, dialog, clickedBehind } = await renderDialog();
    await expect.element(dialog).toBeVisible();
    // `force` skips Playwright's wait for the button to be clickable, but still clicks where it
    // is, so the modal's top layer and backdrop take the click instead.
    await userEvent.click(screen.getByRole('button', { name: 'Behind the dialog' }), {
      force: true,
    });
    expect(clickedBehind).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { dialog, onClose } = await renderDialog();
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    // The browser fires `close` in a task after the key press, so retry until it has.
    await expect.poll(() => onClose.mock.calls.length).toBe(1);
    await expect.element(dialog).not.toBeInTheDocument();
  });

  it('closes on a tap outside it, not on one inside it', async () => {
    const { screen, dialog, onClose } = await renderDialog();
    await userEvent.click(screen.getByRole('heading', { name: 'Share this room' }));
    expect(onClose).not.toHaveBeenCalled();
    // Outside the dialog is its backdrop, which Playwright sees as the page; `force` taps it anyway.
    await userEvent.click(dialog, { position: { x: -8, y: -8 }, force: true });
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(() => onClose.mock.calls.length).toBe(1);
  });

  it('shows the room’s toast inside itself, above its backdrop', async () => {
    const { dialog } = await renderDialog('Room link copied.');
    await expect.element(dialog.getByRole('status')).toHaveTextContent('Room link copied.');
    await expect.element(dialog.getByRole('status')).toBeVisible();
  });
});
