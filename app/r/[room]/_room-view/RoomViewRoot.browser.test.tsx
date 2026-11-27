import { type ComponentProps, use } from 'react';
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
import { type ExchangeRate, type RateSources, getExchangeRate } from '@/services/exchangeRates';

// Each fake shows what RoomViewRoot gives it, and offers a button for each callback it's handed, so
// these tests check only how RoomViewRoot wires its slots and hooks together. Each slot's component
// and each hook has tests of its own, so what a hook does with a call is checked here only far
// enough to tell which handler the call reached.
type PropsOf<Slot extends keyof RoomSlots> = Readonly<ComponentProps<RoomSlots[Slot]>>;

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
  const { currency, displayCurrency, rate } = props.snapshot;
  return (
    <section aria-label="Edit receipt">
      <p>
        Receipt in {currency}, shown in{' '}
        {displayCurrency !== '' ? displayCurrency : 'its own currency'} at {rate}
      </p>
      <button onClick={() => props.onMeta('title', 'Lunch')}>Rename to Lunch</button>
      <button onClick={() => props.onAddItem('Bread', '', 3)}>Add bread</button>
      <button onClick={() => props.onCurrency('GBP')}>Receipt in pounds</button>
      <button onClick={() => props.onDisplayCurrency('USD')}>Show in dollars</button>
      <button onClick={() => props.onRate(1.5)}>Rate 1.5</button>
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

function FakeReceiptSummary(props: PropsOf<'ReceiptSummary'>) {
  return (
    <section aria-label="Summary">
      <p>
        Summary of {props.snapshot.title}, {props.math.itemsSubtotal} {props.math.currency}
      </p>
      <button onClick={props.onCopySummary}>Copy summary</button>
    </section>
  );
}

function FakeParticipantCards(props: PropsOf<'ParticipantCards'>) {
  return <p>Cards for {props.snapshot.participants.length} people</p>;
}

function FakeIdentityModal(props: PropsOf<'IdentityModal'>) {
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
      <button onClick={props.onCopy}>Copy link</button>
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
  return message !== '' ? <output>{message}</output> : null;
}

const fakeSlots: RoomSlots = {
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

async function renderRoom(
  names: readonly string[] = ['Alex', 'Sam'],
  cached: ReadonlyMap<string, ExchangeRate> = new Map(),
) {
  const doc = new Y.Doc();
  const store = new ReceiptStore(doc);
  store.setMeta('title', 'Trattoria Da Enzo');
  store.setMeta('currency', 'EUR');
  store.addItem('Pizza', '', 10);
  names.forEach((name) => store.addParticipant(name));
  const provider = { store, setIdentity: vi.fn() };
  const navigate = vi.fn<(path: string) => void>();
  const clipboard = { writeText: vi.fn<(text: string) => Promise<void>>(() => Promise.resolve()) };
  // The real exchange-rate service runs, over a fake network and an in-memory cache.
  const rates = new Map(cached);
  const network = vi.fn<RateSources['fetch']>((url) => {
    const quote = new URL(url).searchParams.get('symbols') ?? '';
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: '2026-11-20', rates: { [quote]: 1.08 } }),
    });
  });
  const sources: RateSources = {
    cache: {
      read: (key) => Promise.resolve(rates.get(key) ?? null),
      write: (key, rate) => Promise.resolve(void rates.set(key, rate)),
    },
    fetch: network,
  };
  function fetchRate(base: string, quote: string, options: { readonly force: boolean }) {
    return getExchangeRate(base, quote, options, sources);
  }
  // Long enough that no toast clears during a test.
  const services = { clipboard, fetchRate, toastMs: 60_000 };
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
  return { screen, button, dialog, navigate, clipboard, network };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('RoomViewRoot', () => {
  it("gives each part the room's receipt and its totals", async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByRole('heading', { name: 'Trattoria Da Enzo' })).toBeVisible();
    await expect.element(screen.getByText('Banner of 1 items, 10 EUR')).toBeVisible();
    await expect.element(screen.getByText('Pizza, claimed by')).toBeVisible();
    await expect.element(screen.getByText('Summary of Trattoria Da Enzo, 10 EUR')).toBeVisible();
    await expect.element(screen.getByText('Cards for 2 people')).toBeVisible();
    await expect.element(screen.getByText('2 people · 1 items')).toBeVisible();
  });

  it('tells screen readers there are no participants while there are none', async () => {
    const { screen } = await renderRoom([]);
    await expect.element(screen.getByText('No participants yet.')).toBeInTheDocument();
    await expect.element(screen.getByText('You are nobody')).toBeVisible();
  });

  it('gives the header who you are, and says nothing of participants once there are some', async () => {
    const { screen } = await renderRoom();
    await expect.element(screen.getByText('You are p-alex')).toBeVisible();
    await expect.element(screen.getByText('No participants yet.')).not.toBeInTheDocument();
  });

  it('opens the identity picker from the header, and gives the header who you pick', async () => {
    const { screen, button, dialog } = await renderRoom();
    await button('Who am I');
    await expect.element(dialog('Identity').getByText('Picking among 2 people')).toBeVisible();
    await button('Pick Sam');
    await expect.element(dialog('Identity')).not.toBeInTheDocument();
    await expect.element(screen.getByText('You are p-sam')).toBeVisible();
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

  it("opens the restaurant's details for this room from the header, and closes them", async () => {
    const { button, dialog } = await renderRoom();
    await button('Details');
    await expect
      .element(dialog('Details').getByText('Details of Trattoria Da Enzo in split-r1'))
      .toBeVisible();
    await button('Close details');
    await expect.element(dialog('Details')).not.toBeInTheDocument();
  });

  it("opens the share dialog from the header with the room's link, copies it, and closes", async () => {
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

  it('shows the edit drawer, and the items for editing, while editing from the header', async () => {
    const { screen, button } = await renderRoom();
    const drawer = screen.getByRole('region', { name: 'Edit receipt' });
    await expect.element(drawer).not.toBeInTheDocument();
    await button('Edit');
    await expect.element(screen.getByText('Editing', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('Showing all items for editing')).toBeVisible();
    await expect
      .element(drawer.getByText('Receipt in EUR, shown in its own currency at 0'))
      .toBeVisible();
    await button('Edit');
    await expect.element(screen.getByText('Not editing')).toBeVisible();
    await expect.element(drawer).not.toBeInTheDocument();
  });

  it("saves the edit drawer's title and new items to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Edit');
    await button('Rename to Lunch');
    await button('Add bread');
    await expect.element(screen.getByRole('heading', { name: 'Lunch' })).toBeVisible();
    await expect.element(screen.getByText('Bread, claimed by')).toBeVisible();
  });

  it("fetches the rate for the edit drawer's display currency, and for its receipt currency", async () => {
    const { screen, button, network } = await renderRoom();
    await button('Edit');
    await button('Show in dollars');
    expect(network).toHaveBeenLastCalledWith(expect.stringContaining('?base=EUR&symbols=USD'));
    await expect.element(screen.getByText('Receipt in EUR, shown in USD at 1.08')).toBeVisible();
    await button('Receipt in pounds');
    expect(network).toHaveBeenLastCalledWith(expect.stringContaining('?base=GBP&symbols=USD'));
    await expect.element(screen.getByText('Receipt in GBP, shown in USD at 1.08')).toBeVisible();
  });

  it("uses a fresh cached rate for the edit drawer's display currency, without asking again", async () => {
    const fresh: ExchangeRate = {
      base: 'EUR',
      quote: 'USD',
      rate: 1.05,
      date: '2026-11-19',
      fetchedAt: Date.now(),
    };
    const { screen, button, network } = await renderRoom(
      ['Alex', 'Sam'],
      new Map([['EUR:USD', fresh]]),
    );
    await button('Edit');
    await button('Show in dollars');
    await expect.element(screen.getByText('Receipt in EUR, shown in USD at 1.05')).toBeVisible();
    expect(network).not.toHaveBeenCalled();
  });

  it("saves the edit drawer's rate to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Edit');
    await button('Show in dollars');
    await expect.element(screen.getByText('Receipt in EUR, shown in USD at 1.08')).toBeVisible();
    await button('Rate 1.5');
    await expect.element(screen.getByText('Receipt in EUR, shown in USD at 1.5')).toBeVisible();
  });

  it("filters the item list by the banner's filter", async () => {
    const { screen, button } = await renderRoom();
    await button('Show unclaimed');
    await expect.element(screen.getByText('Showing unclaimed items to claim')).toBeVisible();
  });

  it("saves the item list's claims for you and for everyone to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Claim first');
    await expect.element(screen.getByText('Pizza, claimed by p-alex')).toBeVisible();
    await button('Everyone claims first');
    await expect.element(screen.getByText('Pizza, claimed by p-alex p-sam')).toBeVisible();
  });

  it("saves the item list's edits and deletions to the room", async () => {
    const { screen, button } = await renderRoom();
    await button('Rename first');
    await expect.element(screen.getByText('Calzone, claimed by')).toBeVisible();
    await button('Delete first');
    await expect.element(screen.getByText(/^Calzone/)).not.toBeInTheDocument();
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
