import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import '../index.css';
import { IdentityModal } from './IdentityModal';

const alex = { id: 'p-alex', name: 'Alex', colorIdx: 0 };
const sam = { id: 'p-sam', name: 'Sam', colorIdx: 1 };

async function renderModal(props: Partial<Parameters<typeof IdentityModal>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onSelect: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn() };
  const screen = await render(
    <IdentityModal open participants={[alex, sam]} activeId={null} {...handlers} {...props} />,
  );
  return { screen, ...handlers };
}

describe('IdentityModal', () => {
  it('asks who you are and lists everyone on the bill', async () => {
    const { screen } = await renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Who are you on this bill?' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Alex', exact: true })).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Sam', exact: true })).toBeVisible();
  });

  it('selects the person you pick', async () => {
    const { screen, onSelect } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Sam', exact: true }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('p-sam');
  });

  it('adds the name you type and clears the field', async () => {
    const { screen, onAdd } = await renderModal();
    const field = screen.getByRole('textbox', { name: 'Participant name' });
    await userEvent.fill(field, 'Jamie');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith('Jamie');
    await expect.element(field).toHaveValue('');
  });

  it('adds nobody when the name is blank', async () => {
    const { screen, onAdd } = await renderModal();
    await userEvent.fill(screen.getByRole('textbox', { name: 'Participant name' }), '   ');
    await userEvent.keyboard('{Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('removes the person whose remove button you press', async () => {
    const { screen, onRemove } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Alex' }));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith('p-alex');
  });

  it('offers no remove button when only one person is on the bill', async () => {
    const { screen } = await renderModal({ participants: [alex] });
    await expect.element(screen.getByRole('button', { name: 'Alex', exact: true })).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Remove Alex' }))
      .not.toBeInTheDocument();
  });

  it('prompts for the first person when nobody is on the bill', async () => {
    const { screen } = await renderModal({ participants: [] });
    await expect.element(screen.getByText('Add the first person to this receipt.')).toBeVisible();
  });

  it('closes from its close button or from outside the dialog, not from inside it', async () => {
    const { screen, onClose } = await renderModal();
    await userEvent.click(screen.getByRole('heading', { name: 'Who are you on this bill?' }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close identity picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Outside the dialog is its backdrop, which Playwright sees as the page; `force` taps it anyway.
    await userEvent.click(screen.getByRole('dialog'), { position: { x: -8, y: -8 }, force: true });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows nothing while closed', async () => {
    const { screen } = await renderModal({ open: false });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });
});
