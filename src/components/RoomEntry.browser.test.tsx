import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { receiptSeedSchema } from '../domain/receipt/receiptSeed';
import { isUuidRoomId, type RoomId } from '../domain/room/roomId';
import { buildIngestUrl, decodeRoomSegment, encodeSeed, pendingSeedKey } from '../sync/seedCodec';
import RoomEntry from './RoomEntry';

// Next's router is mounted only inside a Next app, so the test stands in for it. RoomEntry calls
// next/navigation's useRouter itself rather than taking the router as a prop, so the test replaces
// that third-party module, as testing conventions allow.
const router = vi.hoisted(() => ({ replace: vi.fn<(href: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const seed = receiptSeedSchema.parse({
  title: 'Taverna',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  roster: ['Alex'],
  items: [{ id: 'item-0', name: 'Taco (1/2)', en: 'Taco', eur: 5 }],
});

/** The hash of the ingest link an assistant builds for `seed`. */
const ingestHash = new URL(buildIngestUrl('https://split.example', seed)).hash;
const ingestQuery = `?ingest=${encodeURIComponent(JSON.stringify(seed))}`;

/** Opens `link`, a query and hash, on the test's page, and puts the page back after the test. */
function visit(link: string) {
  const original = window.location.href;
  window.history.replaceState(null, '', `${window.location.pathname}${link}`);
  onTestFinished(() => {
    window.history.replaceState(null, '', original);
  });
}

/** The room the one navigation went to, read back from its path. */
function roomNavigatedTo(): RoomId | null {
  expect(router.replace).toHaveBeenCalledOnce();
  const [path] = router.replace.mock.calls[0] ?? [];
  expect(path).toMatch(/^\/r\/[^/]+$/);
  return decodeRoomSegment(path?.slice('/r/'.length) ?? '');
}

function storedSeed(roomId: RoomId | null): unknown {
  if (roomId === null) return null;
  const stored = window.sessionStorage.getItem(pendingSeedKey(roomId));
  return stored === null ? null : JSON.parse(stored);
}

beforeEach(() => {
  router.replace.mockReset();
  window.sessionStorage.clear();
});

describe('RoomEntry at the root', () => {
  it('opens a new, empty room when the link holds nothing', async () => {
    visit('');
    await render(<RoomEntry />);
    const roomId = roomNavigatedTo();
    expect(roomId !== null && isUuidRoomId(roomId)).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('opens the room an old room link names, with the receipt it carries', async () => {
    visit(`#room=split-k3x9&seed=${encodeSeed(seed)}`);
    await render(<RoomEntry />);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/r/split-k3x9');
    expect(storedSeed(roomNavigatedTo())).toEqual(seed);
  });

  it('opens the room an old room link names, with no receipt when it carries none', async () => {
    visit('#room=split-k3x9&seed=not-a-seed');
    await render(<RoomEntry />);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/r/split-k3x9');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('forwards an ingest link in the hash to the ingest page, query and hash kept', async () => {
    visit(`?from=chat${ingestHash}`);
    await render(<RoomEntry />);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(`/ingest?from=chat${ingestHash}`);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('forwards an ingest link in the query to the ingest page', async () => {
    visit(ingestQuery);
    await render(<RoomEntry />);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(`/ingest${ingestQuery}`);
  });

  it('forwards an ingest link it cannot read, for the ingest page to explain', async () => {
    visit('#ingest=%7Bnot-json');
    await render(<RoomEntry />);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/ingest#ingest=%7Bnot-json');
  });
});

describe('RoomEntry on the ingest page', () => {
  it('opens a new room holding the receipt in the link', async () => {
    visit(ingestHash);
    const screen = await render(<RoomEntry mode="ingest" />);
    await expect.element(screen.getByText('Preparing your receipt…')).toBeVisible();
    const roomId = roomNavigatedTo();
    expect(roomId !== null && isUuidRoomId(roomId)).toBe(true);
    expect(storedSeed(roomId)).toEqual(seed);
  });

  it('opens the room when the receipt cannot be kept for it', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    visit(ingestQuery);
    await render(<RoomEntry mode="ingest" />);
    const roomId = roomNavigatedTo();
    expect(roomId !== null && isUuidRoomId(roomId)).toBe(true);
  });

  it('says a link with no receipt is not an ingest link, and stays put', async () => {
    visit('#room=split-k3x9');
    const screen = await render(<RoomEntry mode="ingest" />);
    await expect
      .element(screen.getByText('This page needs an ingest link containing receipt data.'))
      .toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('says what is wrong with a receipt it cannot read, and stays put', async () => {
    visit('#ingest=%7Bnot-json');
    const screen = await render(<RoomEntry mode="ingest" />);
    await expect
      .element(screen.getByText('The ingest link does not contain valid JSON.'))
      .toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
