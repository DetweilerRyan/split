import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { type ItemsSlots, RoomItems } from './RoomItems';
import type { Participant } from '@/domain/receipt/roomSnapshot';
import { ReceiptStore } from '@/sync/useReceiptStore';

// Each fake shows what RoomItems gives it, and offers a button for each callback it's handed, so
// these tests check only how RoomItems wires its slots to the room's receipt.
type PropsOf<Slot extends keyof ItemsSlots> = Readonly<Parameters<ItemsSlots[Slot]>[0]>;

function FakeClaimProgress(props: PropsOf<'claimProgress'>) {
  return (
    <section aria-label="Progress">
      <p>
        Progress of {props.items.length} items, {props.total} {props.currency}, showing{' '}
        {props.filter}
      </p>
      <button onClick={() => props.onFilter('unclaimed')}>Show unclaimed</button>
    </section>
  );
}

function FakeItemList(props: PropsOf<'itemList'>) {
  const [first] = props.items;
  return (
    <section aria-label="Items">
      <p>
        Showing {props.filter} items {props.editing ? 'for editing' : 'to claim'}, for{' '}
        {props.activeId ?? 'nobody'}
      </p>
      <ul>
        {props.items.map((item) => (
          <li key={item.id}>
            {item.name}, claimed by{' '}
            {props.participants
              .filter((person) => item.claims[person.id] === true)
              .map((person) => person.id)
              .join(' ')}
          </li>
        ))}
      </ul>
      {first !== undefined && (
        <>
          <button
            onClick={() => {
              if (props.activeId !== null) props.onClaim(first.id, props.activeId);
            }}
          >
            Claim first
          </button>
          <button onClick={() => props.onClaimAll(first.id, props.participants, true)}>
            Everyone claims first
          </button>
          <button onClick={() => props.onUpdate(first.id, 'name', 'Calzone')}>Rename first</button>
          <button onClick={() => props.onDelete(first.id)}>Delete first</button>
        </>
      )}
    </section>
  );
}

const fakeSlots: ItemsSlots = {
  claimProgress: (props) => <FakeClaimProgress {...props} />,
  itemList: (props) => <FakeItemList {...props} />,
};

async function renderItems({ editing = false, signedIn = true, editor = null as ReactNode } = {}) {
  const store = new ReceiptStore(new Y.Doc());
  store.setMeta('currency', 'EUR');
  store.addItem('Pizza', '', 10);
  store.addItem('Bread', '', 3);
  const alex = store.addParticipant('Alex');
  store.addParticipant('Sam');
  const you: Participant | null = signedIn ? alex : null;
  const screen = await render(
    <RoomItems store={store} you={you} editing={editing} editor={editor} slots={fakeSlots} />,
  );
  function button(name: string) {
    return userEvent.click(screen.getByRole('button', { name, exact: true }));
  }
  return { screen, button };
}

describe('RoomItems', () => {
  it("gives the progress the room's items, their total and its currency, showing all", async () => {
    const { screen } = await renderItems();
    await expect
      .element(screen.getByText('Progress of 2 items, 13 EUR, showing all'))
      .toBeVisible();
  });

  it("filters the items by the progress's filter", async () => {
    const { screen, button } = await renderItems();
    await button('Show unclaimed');
    await expect.element(screen.getByText(/^Showing unclaimed items/)).toBeVisible();
    await expect.element(screen.getByText(/showing unclaimed$/)).toBeVisible();
  });

  it('gives the items who you are, and whether you are editing', async () => {
    const { screen } = await renderItems({ editing: true });
    await expect
      .element(screen.getByText('Showing all items for editing, for p-alex'))
      .toBeVisible();
  });

  it('shows the editor it is given between the progress and the items', async () => {
    const { screen } = await renderItems({ editing: true, editor: <p>The editor</p> });
    const progress = screen.getByRole('region', { name: 'Progress' }).element();
    const editor = screen.getByText('The editor').element();
    const items = screen.getByRole('region', { name: 'Items' }).element();
    expect(
      progress.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(editor.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gives the items nobody before you choose who you are', async () => {
    const { screen } = await renderItems({ signedIn: false });
    await expect.element(screen.getByText('Showing all items to claim, for nobody')).toBeVisible();
  });

  it("saves the items' claims for you and for everyone to the room", async () => {
    const { screen, button } = await renderItems();
    await button('Claim first');
    await expect.element(screen.getByText('Pizza, claimed by p-alex')).toBeVisible();
    await button('Everyone claims first');
    await expect.element(screen.getByText('Pizza, claimed by p-alex p-sam')).toBeVisible();
  });

  it("saves the items' edits and deletions to the room", async () => {
    const { screen, button } = await renderItems();
    await button('Rename first');
    await expect.element(screen.getByText('Calzone, claimed by')).toBeVisible();
    await button('Delete first');
    await expect.element(screen.getByText(/^Calzone/)).not.toBeInTheDocument();
  });
});
