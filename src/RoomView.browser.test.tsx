import { type ComponentProps, use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import './index.css';
import { ToastContext } from './components/Toast';
import { PRESETS } from './data/presets';
import { roomIdSchema } from './domain/room/roomId';
import { parseRoomPath } from './sync/seedCodec';
import { ReceiptStore } from './sync/useReceiptStore';
import { type RoomParts, RoomView } from './RoomView';

// Each fake shows what RoomView gives it, and offers a button for each callback it's handed, so
// these tests check only how RoomView wires its parts together. Each part has tests of its own.
type PropsOf<Part extends keyof RoomParts> = Readonly<ComponentProps<RoomParts[Part]>>;

const roomId = roomIdSchema.parse('split-r1');
const plitvice = PRESETS.plitvice;

function FakeHeader(props: PropsOf<'Header'>) {
  return (
    <header>
      <h1>{props.title}</h1>
      <p>You are {props.activeId ?? 'nobody'}</p>
      <p>{props.editing ? 'Editing' : 'Not editing'}</p>
      <button onClick={props.onIdentity}>Who am I</button>
      <button onClick={props.onEdit}>Edit</button>
      <button onClick={props.onShare}>Share</button>
      <button onClick={props.onDetails}>Details</button>
    </header>
  );
}

function FakeUnclaimedBanner(props: PropsOf<'UnclaimedBanner'>) {
  return (
    <section aria-label="Banner">
      <p>
        Banner of {props.items.length} items, {props.total} {props.currency}
      </p>
      <button onClick={() => props.onFilter('unclaimed')}>Show unclaimed</button>
    </section>
  );
}

function FakeEditReceiptDrawer(props: PropsOf<'EditReceiptDrawer'>) {
  return (
    <section aria-label="Edit receipt">
      <button onClick={() => props.onMeta('title', 'Lunch')}>Rename to Lunch</button>
      <button onClick={() => props.onAddItem('Bread', '', 3)}>Add bread</button>
    </section>
  );
}

function FakeItemList(props: PropsOf<'ItemList'>) {
  const [first] = props.items;
  return (
    <section aria-label="Items">
      <p>
        Showing {props.filter} items {props.editing ? 'for editing' : 'to claim'}
      </p>
      <ul>
        {props.items.map((item) => (
          <li key={item.id}>
            {item.name}, claimed by {Object.keys(item.claims).filter((id) => item.claims[id])}
          </li>
        ))}
      </ul>
      {first && (
        <>
          <button onClick={() => props.onClaim(first.id, props.activeId ?? '')}>Claim first</button>
          <button onClick={() => props.onDelete(first.id)}>Delete first</button>
        </>
      )}
    </section>
  );
}

function FakeReceiptSummary(props: PropsOf<'ReceiptSummary'>) {
  return <p>Summary of {props.snapshot.title}</p>;
}

function FakeParticipantCards(props: PropsOf<'ParticipantCards'>) {
  return <p>Cards for {props.snapshot.participants.length} people</p>;
}

function FakeIdentityModal(props: PropsOf<'IdentityModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Identity">
      <button onClick={() => props.onSelect('p-sam')}>Pick Sam</button>
      <button onClick={() => props.onAdd('Jamie')}>Join as Jamie</button>
      <button onClick={() => props.onRemove('p-sam')}>Remove Sam</button>
      <button onClick={props.onClose}>Close identity</button>
    </dialog>
  );
}

function FakeRestaurantModal(props: PropsOf<'RestaurantModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Details">
      <p>
        Details of {props.snapshot.title} in {props.roomId}
      </p>
      <button onClick={props.onClose}>Close details</button>
    </dialog>
  );
}

function FakeShareModal(props: PropsOf<'ShareModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Share">
      <p>Link {props.url}</p>
      <button onClick={props.onClose}>Close share</button>
    </dialog>
  );
}

function FakeSeedModal(props: PropsOf<'SeedModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Seed">
      <button onClick={() => props.onImport(plitvice, true)}>Import Plitvice</button>
      <button onClick={() => props.onPreset(plitvice)}>Load Plitvice</button>
      <button onClick={props.onBlankRoom}>Blank room</button>
      <button onClick={props.onClose}>Close seed</button>
    </dialog>
  );
}

function FakeToast() {
  const message = use(ToastContext);
  return message ? <output>{message}</output> : null;
}

const fakeParts: RoomParts = {
  Header: FakeHeader,
  UnclaimedBanner: FakeUnclaimedBanner,
  EditReceiptDrawer: FakeEditReceiptDrawer,
  ItemList: FakeItemList,
  ReceiptSummary: FakeReceiptSummary,
  ParticipantCards: FakeParticipantCards,
  IdentityModal: FakeIdentityModal,
  RestaurantModal: FakeRestaurantModal,
  ShareModal: FakeShareModal,
  SeedModal: FakeSeedModal,
  Toast: FakeToast,
};

async function renderRoom(names: readonly string[] = ['Alex', 'Sam']) {
  const doc = new Y.Doc();
  const store = new ReceiptStore(doc);
  store.setMeta('title', 'Trattoria Da Enzo');
  store.setMeta('currency', 'EUR');
  store.addItem('Pizza', '', 10);
  names.forEach((name) => store.addParticipant(name));
  const provider = { doc, store, setIdentity: vi.fn() };
  const navigate = vi.fn();
  const screen = await render(
    <RoomView roomId={roomId} provider={provider} navigate={navigate} parts={fakeParts} />,
  );
  function button(name: string) {
    return userEvent.click(screen.getByRole('button', { name, exact: true }));
  }
  return { screen, button, navigate };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('RoomView', () => {
  it("gives each part the room's receipt", async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByRole('heading', { name: 'Trattoria Da Enzo' })).toBeVisible();
    await expect.element(screen.getByText('Banner of 1 items, 10 EUR')).toBeVisible();
    await expect.element(screen.getByText('Pizza, claimed by')).toBeVisible();
    await expect.element(screen.getByText('Summary of Trattoria Da Enzo')).toBeVisible();
    await expect.element(screen.getByText('Cards for 2 people')).toBeVisible();
    await expect.element(screen.getByText('2 people · 1 items')).toBeVisible();
  });

  it('tells screen readers there are no participants while there are none', async () => {
    const { screen } = await renderRoom([]);
    await expect.element(screen.getByText('No participants yet.')).toBeInTheDocument();
    await expect.element(screen.getByText('You are nobody')).toBeVisible();
  });

  it('says nothing of participants once there are some', async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByText('You are p-alex')).toBeVisible();
    await expect.element(screen.getByText('No participants yet.')).not.toBeInTheDocument();
  });

  it('opens the identity picker from the header, and makes you the participant picked', async () => {
    const { screen, button } = await renderRoom();
    await button('Who am I');
    await button('Pick Sam');
    await expect.element(screen.getByRole('dialog', { name: 'Identity' })).not.toBeInTheDocument();
    await expect.element(screen.getByText('You are p-sam')).toBeVisible();
  });

  it('adds and removes participants from the identity picker', async () => {
    const { screen, button } = await renderRoom();
    await button('Who am I');
    await button('Join as Jamie');
    await expect.element(screen.getByText('You are p-jamie')).toBeVisible();
    await expect.element(screen.getByText('Cards for 3 people')).toBeVisible();
    await button('Who am I');
    await button('Remove Sam');
    await expect.element(screen.getByText('Cards for 2 people')).toBeVisible();
    await button('Close identity');
    await expect.element(screen.getByRole('dialog', { name: 'Identity' })).not.toBeInTheDocument();
  });

  it("opens the restaurant's details for this room from the header, and closes them", async () => {
    const { screen, button } = await renderRoom();
    await button('Details');
    await expect
      .element(screen.getByText('Details of Trattoria Da Enzo in split-r1'))
      .toBeVisible();
    await button('Close details');
    await expect.element(screen.getByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
  });

  it("opens the share dialog with the room's link from the header, and closes it", async () => {
    const { screen, button } = await renderRoom();
    await button('Share');
    await expect
      .element(screen.getByText(`Link ${window.location.origin}/r/split-r1`))
      .toBeVisible();
    await button('Close share');
    await expect.element(screen.getByRole('dialog', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('shows the edit drawer, and the items for editing, while editing from the header', async () => {
    const { screen, button } = await renderRoom();
    await expect
      .element(screen.getByRole('region', { name: 'Edit receipt' }))
      .not.toBeInTheDocument();
    await button('Edit');
    await expect.element(screen.getByText('Editing', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('Showing all items for editing')).toBeVisible();
    await button('Edit');
    await expect.element(screen.getByText('Not editing')).toBeVisible();
    await expect
      .element(screen.getByRole('region', { name: 'Edit receipt' }))
      .not.toBeInTheDocument();
  });

  it("saves the edit drawer's changes to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Edit');
    await button('Rename to Lunch');
    await button('Add bread');
    await expect.element(screen.getByRole('heading', { name: 'Lunch' })).toBeVisible();
    await expect.element(screen.getByText('Bread, claimed by')).toBeVisible();
  });

  it("filters the item list by the banner's filter", async () => {
    const { screen, button } = await renderRoom();
    await button('Show unclaimed');
    await expect.element(screen.getByText('Showing unclaimed items to claim')).toBeVisible();
  });

  it("saves the item list's claims and deletions to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Claim first');
    await expect.element(screen.getByText('Pizza, claimed by p-alex')).toBeVisible();
    await button('Delete first');
    await expect.element(screen.getByText(/^Pizza/)).not.toBeInTheDocument();
  });

  it('imports a seed from the seed dialog, then closes it and says so', async () => {
    const { screen, button } = await renderRoom();
    await button('Seed / presets');
    await button('Import Plitvice');
    await expect.element(screen.getByRole('dialog', { name: 'Seed' })).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('heading', { name: 'Konoba Lička Kuća — Plitvice' }))
      .toBeVisible();
    await expect.element(screen.getByRole('status')).toHaveTextContent('Imported 4 receipt items.');
  });

  it('loads a preset from the seed dialog', async () => {
    const { screen, button } = await renderRoom();
    await button('Seed / presets');
    await button('Load Plitvice');
    await expect.element(screen.getByText('Banner of 4 items, 84 EUR')).toBeVisible();
  });

  it('goes to a new room from the seed dialog', async () => {
    const { button, navigate } = await renderRoom();
    await button('Seed / presets');
    await button('Blank room');
    expect(navigate).toHaveBeenCalledOnce();
    expect(parseRoomPath(navigate.mock.calls[0][0])).not.toBeNull();
  });

  it('hides its toast while a dialog is open', async () => {
    const { screen, button } = await renderRoom();
    await button('Seed / presets');
    await button('Import Plitvice');
    await expect.element(screen.getByRole('status')).toBeVisible();
    await button('Share');
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
    await button('Close share');
    await expect.element(screen.getByRole('status')).toBeVisible();
  });
});
