import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import '../index.css';
import type { RoomSnapshot } from '../domain/receipt/roomSnapshot';
import { roomIdSchema } from '../domain/room/roomId';
import { RestaurantModal } from './RestaurantModal';

const roomId = roomIdSchema.parse('split-enzo');

const noDetails: RoomSnapshot = {
  title: 'Trattoria Da Enzo',
  address: '',
  phone: '',
  website: '',
  purchasedAt: '',
  mealType: '',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  currency: 'EUR',
  displayCurrency: '',
  rate: 0,
  rateDate: '',
  participants: [],
  items: [],
  connection: { provider: 'WebRTC', status: 'connected' },
  peers: [],
};

async function renderModal(details: Partial<RoomSnapshot> = {}, open = true) {
  const onClose = vi.fn();
  const snapshot = { ...noDetails, ...details };
  const screen = await render(
    <RestaurantModal open={open} snapshot={snapshot} roomId={roomId} onClose={onClose} />,
  );
  return { screen, onClose, dialog: screen.getByRole('dialog', { name: 'Trattoria Da Enzo' }) };
}

describe('RestaurantModal', () => {
  it('lists when, the meal, the address, the phone and the website, each linked', async () => {
    const { dialog } = await renderModal({
      purchasedAt: '2026-03-06T19:30',
      mealType: 'Dinner',
      address: 'Via dei Vascellari 29, Rome',
      phone: '+39 06 581 2260',
      website: 'daenzoal29.com',
    });
    await expect.element(dialog.getByText(/^Fri, Mar 6, 2026 · 7:30\sPM$/)).toBeVisible();
    await expect.element(dialog.getByText('Dinner')).toBeVisible();
    await expect
      .element(dialog.getByRole('link', { name: 'Via dei Vascellari 29, Rome' }))
      .toHaveAttribute(
        'href',
        'https://www.google.com/maps/search/?api=1&query=Trattoria+Da+Enzo+Via+dei+Vascellari+29%2C+Rome',
      );
    await expect
      .element(dialog.getByRole('link', { name: '+39 06 581 2260' }))
      .toHaveAttribute('href', 'tel:+39065812260');
    await expect
      .element(dialog.getByRole('link', { name: 'daenzoal29.com' }))
      .toHaveAttribute('href', 'https://daenzoal29.com/');
  });

  it('shows only the day when the receipt has no time', async () => {
    const { dialog } = await renderModal({ purchasedAt: '2026-03-06' });
    await expect.element(dialog.getByText('Fri, Mar 6, 2026', { exact: true })).toBeVisible();
  });

  it('links a website that has a scheme as written', async () => {
    const { dialog } = await renderModal({ website: 'http://daenzoal29.com/menu' });
    await expect
      .element(dialog.getByRole('link', { name: 'http://daenzoal29.com/menu' }))
      .toHaveAttribute('href', 'http://daenzoal29.com/menu');
  });

  it('shows a website that is not a domain without linking it', async () => {
    const { dialog } = await renderModal({ website: 'info@daenzoal29.com' });
    await expect.element(dialog.getByText('info@daenzoal29.com')).toBeVisible();
    await expect.element(dialog.getByRole('link')).not.toBeInTheDocument();
  });

  it('says so when the receipt has no restaurant details', async () => {
    const { dialog } = await renderModal();
    await expect
      .element(dialog.getByText('No restaurant details were found on this receipt.'))
      .toBeVisible();
    await expect.element(dialog.getByText('room: split-enzo')).toBeVisible();
  });

  it('closes from its close button', async () => {
    const { screen, onClose } = await renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Close restaurant details' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows nothing while closed', async () => {
    const { screen } = await renderModal({}, false);
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });
});
