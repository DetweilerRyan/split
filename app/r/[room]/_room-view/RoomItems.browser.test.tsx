import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { RoomItems } from './RoomItems';
import type { Participant } from '@/domain/receipt/roomSnapshot';
import { ReceiptStore } from '@/sync/useReceiptStore';

// RoomItems renders its real banner and list over a real store, so these tests check what a
// person sees and does with the room's items. The banner and the list have tests of their own.
async function renderItems({ editing = false, signedIn = true, editor = null as ReactNode } = {}) {
  const store = new ReceiptStore(new Y.Doc());
  store.setMeta('currency', 'EUR');
  store.addItem('Pizza', '', 10);
  store.addItem('Bread', '', 3);
  const alex = store.addParticipant('Alex');
  store.addParticipant('Sam');
  const you: Participant | null = signedIn ? alex : null;
  const screen = await render(
    <RoomItems
      store={store}
      you={you}
      mode={editing ? { kind: 'editing', editor } : { kind: 'claiming' }}
    />,
  );
  function item(name: string) {
    return screen.getByRole('article').filter({ hasText: name });
  }
  return { screen, item };
}

describe('RoomItems', () => {
  it("shows how much of the room's items is still unclaimed", async () => {
    const { screen } = await renderItems();
    await expect.element(screen.getByText('€13.00 unclaimed')).toBeVisible();
  });

  it('claims an item for you when you tap it, and saves it to the room', async () => {
    const { screen, item } = await renderItems();
    await userEvent.click(screen.getByRole('button', { name: 'Pizza', exact: true }));
    await expect.element(item('Pizza').getByText('Solo')).toBeVisible();
    await expect.element(screen.getByText('€3.00 unclaimed')).toBeVisible();
  });

  it('claims nothing when you tap an item before choosing who you are', async () => {
    const { screen } = await renderItems({ signedIn: false });
    await userEvent.click(screen.getByRole('button', { name: 'Pizza', exact: true }));
    await expect.element(screen.getByText('€13.00 unclaimed')).toBeVisible();
  });

  it('claims an item for everyone', async () => {
    const { item } = await renderItems();
    await userEvent.click(item('Pizza').getByRole('button', { name: 'All', exact: true }));
    await expect.element(item('Pizza').getByText('€5.00 each')).toBeVisible();
  });

  it("filters the list by the banner's filter", async () => {
    const { screen } = await renderItems();
    await userEvent.click(screen.getByRole('button', { name: 'Pizza', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'unclaimed', exact: true }));
    await expect
      .element(screen.getByRole('button', { name: 'Pizza', exact: true }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Bread', exact: true })).toBeVisible();
  });

  it("saves the items' edits and deletions to the room while editing", async () => {
    const { screen } = await renderItems({ editing: true });
    await userEvent.fill(screen.getByRole('textbox', { name: 'Item name' }).first(), 'Calzone');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Calzone' }));
    await expect.element(screen.getByText('€3.00 unclaimed')).toBeVisible();
  });

  it('shows the editor it is given between the banner and the list while editing', async () => {
    const { screen } = await renderItems({ editing: true, editor: <p>The editor</p> });
    const banner = screen.getByText('€13.00 unclaimed').element();
    const editor = screen.getByText('The editor').element();
    const list = screen.getByRole('region', { name: 'Receipt items' }).element();
    expect(banner.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(editor.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
