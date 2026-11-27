import { use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import '../../../index.css';
import { ToastContext } from './Toast';
import { PRESETS } from '@/data/presets';
import { participantIdSchema } from '@/domain/receipt/roomSnapshot';
import { roomIdSchema } from '@/domain/room/roomId';
import { parseRoomPath } from '@/sync/seedCodec';
import { ReceiptStore } from '@/sync/useReceiptStore';
import { type RoomSlots, RoomViewRoot } from './RoomViewRoot';

// Each fake shows what RoomViewRoot gives it, and offers a button for each callback it's handed, so
// these tests check only how RoomViewRoot wires its slots and hooks together. Each slot's component
// and each hook has tests of its own, so what a hook does with a call is checked here only far
// enough to tell which handler the call reached.
type PropsOf<Slot extends keyof RoomSlots> = Readonly<Parameters<RoomSlots[Slot]>[0]>;

const roomId = roomIdSchema.parse('split-r1');
const plitvice = PRESETS.plitvice;

function FakeAppBar(props: PropsOf<'appBar'>) {
  return (
    <header>
      <h1>{props.snapshot.title}</h1>
      <p>You are {props.you?.id ?? 'nobody'}</p>
      <p>{props.editing ? 'Editing' : 'Not editing'}</p>
      <button onClick={props.onIdentity}>Who am I</button>
      <button onClick={props.onEdit}>Edit</button>
      <button onClick={props.onShare}>Share</button>
      <button onClick={props.onDetails}>Details</button>
    </header>
  );
}

function FakeItems(props: PropsOf<'items'>) {
  return (
    <section aria-label="Items">
      Items for {props.you?.id ?? 'nobody'}, {props.editing ? 'editing' : 'not editing'}
    </section>
  );
}

function FakeEditor(props: PropsOf<'editor'>) {
  return (
    <section aria-label="Edit receipt">
      <button onClick={() => props.notify('Rate unavailable')}>Notify</button>
    </section>
  );
}

function FakeSummary(props: PropsOf<'summary'>) {
  return (
    <section aria-label="Summary">
      <p>Summary of {props.snapshot.title}</p>
      <button onClick={props.onCopySummary}>Copy summary</button>
    </section>
  );
}

function FakePeople(props: PropsOf<'people'>) {
  return <p>Cards for {props.snapshot.participants.length} people</p>;
}

function FakeSeedCard(props: PropsOf<'seedCard'>) {
  return (
    <section aria-label="Seed card">
      <p>
        Seed for {props.snapshot.participants.length} people, {props.snapshot.items.length} items
      </p>
      <button onClick={props.onOpen}>Seed / presets</button>
    </section>
  );
}

function FakeIdentityModal(props: PropsOf<'identityModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Identity">
      <p>Picking among {props.participants.length} people</p>
      <button onClick={() => props.onSelect(participantIdSchema.parse('p-sam'))}>Pick Sam</button>
      <button onClick={() => props.onAdd('Jamie')}>Join as Jamie</button>
      <button onClick={() => props.onRemove(participantIdSchema.parse('p-sam'))}>Remove Sam</button>
      <button onClick={props.onClose}>Close identity</button>
    </dialog>
  );
}

function FakeRestaurantModal(props: PropsOf<'restaurantModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Details">
      <p>Details of {props.snapshot.title}</p>
      <button onClick={props.onClose}>Close details</button>
    </dialog>
  );
}

function FakeShareModal(props: PropsOf<'shareModal'>) {
  if (!props.open) return null;
  return (
    <dialog open aria-label="Share">
      <p>Link {props.url}</p>
      <button onClick={props.onCopy}>Copy link</button>
      <button onClick={props.onClose}>Close share</button>
    </dialog>
  );
}

function FakeSeedModal(props: PropsOf<'seedModal'>) {
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
  return message !== '' ? <output>{message}</output> : null;
}

const fakeSlots: RoomSlots = {
  appBar: (props) => <FakeAppBar {...props} />,
  items: (props) => <FakeItems {...props} />,
  editor: (props) => <FakeEditor {...props} />,
  summary: (props) => <FakeSummary {...props} />,
  people: (props) => <FakePeople {...props} />,
  seedCard: (props) => <FakeSeedCard {...props} />,
  identityModal: (props) => <FakeIdentityModal {...props} />,
  restaurantModal: (props) => <FakeRestaurantModal {...props} />,
  shareModal: (props) => <FakeShareModal {...props} />,
  seedModal: (props) => <FakeSeedModal {...props} />,
  toast: () => <FakeToast />,
};

async function renderRoom(names: readonly string[] = ['Alex', 'Sam']) {
  const store = new ReceiptStore(new Y.Doc());
  store.setMeta('title', 'Trattoria Da Enzo');
  store.setMeta('currency', 'EUR');
  store.addItem('Pizza', '', 10);
  names.forEach((name) => store.addParticipant(name));
  const provider = { store, setIdentity: vi.fn() };
  const navigate = vi.fn<(path: string) => void>();
  const clipboard = { writeText: vi.fn<(text: string) => Promise<void>>(() => Promise.resolve()) };
  // Long enough that no toast clears during a test.
  const services = { clipboard, toastMs: 60_000 };
  const screen = await render(
    <RoomViewRoot
      roomId={roomId}
      provider={provider}
      navigate={navigate}
      slots={fakeSlots}
      services={services}
    />,
  );
  function button(name: string) {
    return userEvent.click(screen.getByRole('button', { name, exact: true }));
  }
  function dialog(name: string) {
    return screen.getByRole('dialog', { name });
  }
  return { screen, button, dialog, navigate, clipboard };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('RoomViewRoot', () => {
  it("gives each slot the room's receipt", async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByRole('heading', { name: 'Trattoria Da Enzo' })).toBeVisible();
    await expect.element(screen.getByText('Summary of Trattoria Da Enzo')).toBeVisible();
    await expect.element(screen.getByText('Cards for 2 people')).toBeVisible();
    await expect.element(screen.getByText('Seed for 2 people, 1 items')).toBeVisible();
  });

  it('tells screen readers there are no participants while there are none', async () => {
    const { screen } = await renderRoom([]);
    await expect.element(screen.getByText('No participants yet.')).toBeInTheDocument();
    await expect.element(screen.getByText('You are nobody')).toBeVisible();
  });

  it('gives the app bar and the items who you are, and says nothing of participants once there are some', async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByText('You are p-alex')).toBeVisible();
    await expect.element(screen.getByText('Items for p-alex, not editing')).toBeVisible();
    await expect.element(screen.getByText('No participants yet.')).not.toBeInTheDocument();
  });

  it('opens the identity picker from the app bar, and gives the app bar and the items who you pick', async () => {
    const { screen, button, dialog } = await renderRoom();
    await button('Who am I');
    await expect.element(dialog('Identity').getByText('Picking among 2 people')).toBeVisible();
    await button('Pick Sam');
    await expect.element(dialog('Identity')).not.toBeInTheDocument();
    await expect.element(screen.getByText('You are p-sam')).toBeVisible();
    await expect.element(screen.getByText('Items for p-sam, not editing')).toBeVisible();
  });

  it("saves the identity picker's joins and removals to the room, and closes it", async () => {
    const { screen, button, dialog } = await renderRoom();
    await button('Who am I');
    await button('Join as Jamie');
    await expect.element(screen.getByText('Cards for 3 people')).toBeVisible();
    await button('Who am I');
    await button('Remove Sam');
    await expect.element(screen.getByText('Cards for 2 people')).toBeVisible();
    await button('Close identity');
    await expect.element(dialog('Identity')).not.toBeInTheDocument();
  });

  it("opens the restaurant's details from the app bar, and closes them", async () => {
    const { button, dialog } = await renderRoom();
    await button('Details');
    await expect.element(dialog('Details').getByText('Details of Trattoria Da Enzo')).toBeVisible();
    await button('Close details');
    await expect.element(dialog('Details')).not.toBeInTheDocument();
  });

  it("opens the share dialog from the app bar with the room's link, copies it, and closes", async () => {
    const { button, dialog, clipboard } = await renderRoom();
    const link = `${window.location.origin}/r/split-r1`;
    await button('Share');
    await expect.element(dialog('Share').getByText(`Link ${link}`)).toBeVisible();
    await button('Copy link');
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(link);
    await button('Close share');
    await expect.element(dialog('Share')).not.toBeInTheDocument();
  });

  it("copies the receipt's summary, not its link, from the summary", async () => {
    const { button, clipboard } = await renderRoom();
    await button('Copy summary');
    expect(clipboard.writeText).toHaveBeenCalledOnce();
    expect(clipboard.writeText.mock.calls[0]?.[0]).toContain('Trattoria Da Enzo');
    expect(clipboard.writeText.mock.calls[0]?.[0]).not.toContain('/r/split-r1');
  });

  it('shows the editor, and gives the items editing, while editing from the app bar', async () => {
    const { screen, button } = await renderRoom();
    const editor = screen.getByRole('region', { name: 'Edit receipt' });
    await expect.element(editor).not.toBeInTheDocument();
    await button('Edit');
    await expect.element(screen.getByText('Editing', { exact: true })).toBeVisible();
    await expect.element(editor).toBeVisible();
    await expect.element(screen.getByText('Items for p-alex, editing')).toBeVisible();
    await button('Edit');
    await expect.element(screen.getByText('Not editing')).toBeVisible();
    await expect.element(editor).not.toBeInTheDocument();
  });

  it("shows the editor's notices as the room's toast", async () => {
    const { screen, button } = await renderRoom();
    await button('Edit');
    await button('Notify');
    await expect.element(screen.getByRole('status')).toHaveTextContent('Rate unavailable');
  });

  it("opens the seed dialog from the seed card, imports into the room, and gives the toast the hook's message", async () => {
    const { screen, button, dialog } = await renderRoom();
    await button('Seed / presets');
    await button('Import Plitvice');
    await expect.element(dialog('Seed')).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('heading', { name: 'Konoba Lička Kuća — Plitvice' }))
      .toBeVisible();
    await expect.element(screen.getByRole('status')).toBeVisible();
  });

  it('loads a preset from the seed dialog into the room', async () => {
    const { screen, button } = await renderRoom();
    await button('Seed / presets');
    await button('Load Plitvice');
    await expect
      .element(screen.getByRole('heading', { name: 'Konoba Lička Kuća — Plitvice' }))
      .toBeVisible();
  });

  it('goes to a new room from the seed dialog, and closes it', async () => {
    const { button, dialog, navigate } = await renderRoom();
    await button('Seed / presets');
    await button('Blank room');
    expect(navigate).toHaveBeenCalledOnce();
    expect(parseRoomPath(navigate.mock.calls[0]?.[0] ?? '')).not.toBeNull();
    await button('Close seed');
    await expect.element(dialog('Seed')).not.toBeInTheDocument();
  });

  it('hides its toast while a dialog is open', async () => {
    const { screen, button } = await renderRoom();
    await button('Copy summary');
    await expect.element(screen.getByRole('status')).toBeVisible();
    await button('Share');
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
    await button('Close share');
    await expect.element(screen.getByRole('status')).toBeVisible();
  });
});
