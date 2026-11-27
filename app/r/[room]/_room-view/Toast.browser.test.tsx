import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { Toast, ToastContext } from './Toast';

describe('Toast', () => {
  it("shows the room's message as a status", async () => {
    const screen = await render(
      <ToastContext value="Imported 3 receipt items.">
        <Toast />
      </ToastContext>,
    );
    await expect.element(screen.getByRole('status')).toHaveTextContent('Imported 3 receipt items.');
  });

  it('shows nothing while there is no message', async () => {
    const screen = await render(
      <ToastContext value="">
        <Toast />
      </ToastContext>,
    );
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
  });
});
