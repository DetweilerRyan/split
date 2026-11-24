import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import '../index.css';
import { PRESETS } from '../data/presets';
import { encodeSeed } from '../store/seedCodec';
import { SeedModal } from './SeedModal';

const plitvice = PRESETS.plitvice;

async function renderModal(open = true) {
  const handlers = {
    onClose: vi.fn(),
    onImport: vi.fn(),
    onPreset: vi.fn(),
    onBlankRoom: vi.fn(),
  };
  const screen = await render(<SeedModal open={open} {...handlers} />);
  const field = screen.getByRole('textbox', {
    name: 'Paste seed JSON, compressed seed, or share link',
  });
  return { screen, field, ...handlers };
}

describe('SeedModal', () => {
  it('loads the preset you pick', async () => {
    const { screen, onPreset } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: /^Konoba Lička Kuća — Plitvice/ }));
    expect(onPreset).toHaveBeenCalledExactlyOnceWith(plitvice);
  });

  it('imports pasted seed JSON, replacing the current receipt', async () => {
    const { screen, field, onImport } = await renderModal();
    await userEvent.fill(field, JSON.stringify(plitvice));
    await userEvent.click(screen.getByRole('button', { name: 'Import seed' }));
    expect(onImport).toHaveBeenCalledExactlyOnceWith(plitvice, true);
  });

  it('imports a compressed seed, keeping the current receipt when you untick replace', async () => {
    const { screen, field, onImport } = await renderModal();
    await userEvent.fill(field, encodeSeed(plitvice));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Replace current receipt when importing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Import seed' }));
    expect(onImport).toHaveBeenCalledExactlyOnceWith(plitvice, false);
  });

  it('imports the seed in a pasted room link', async () => {
    const { screen, field, onImport } = await renderModal();
    await userEvent.fill(field, `https://split.example/r/split-enzo#seed=${encodeSeed(plitvice)}`);
    await userEvent.click(screen.getByRole('button', { name: 'Import seed' }));
    expect(onImport).toHaveBeenCalledExactlyOnceWith(plitvice, true);
  });

  it('says it could not parse text that holds no seed, and imports nothing', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { screen, field, onImport } = await renderModal();
    await userEvent.fill(field, 'not a seed');
    await userEvent.click(screen.getByRole('button', { name: 'Import seed' }));
    expect(alert).toHaveBeenCalledExactlyOnceWith(
      'Could not parse seed JSON, compressed seed, or room link.',
    );
    expect(onImport).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('says it could not parse a seed that fails to import', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { screen, field, onImport } = await renderModal();
    onImport.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'forEach')");
    });
    await userEvent.fill(field, JSON.stringify({ title: 'No roster', items: [] }));
    await userEvent.click(screen.getByRole('button', { name: 'Import seed' }));
    expect(alert).toHaveBeenCalledExactlyOnceWith(
      'Could not parse seed JSON, compressed seed, or room link.',
    );
    alert.mockRestore();
  });

  it('starts a new blank room', async () => {
    const { screen, onBlankRoom } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'New blank room' }));
    expect(onBlankRoom).toHaveBeenCalledOnce();
  });

  it('closes from its close button', async () => {
    const { screen, onClose } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Close seed dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows nothing while closed', async () => {
    const { screen } = await renderModal(false);
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });
});
