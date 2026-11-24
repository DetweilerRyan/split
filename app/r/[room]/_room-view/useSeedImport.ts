import { useState } from 'react';
import type { Doc } from 'yjs';
import { localeCurrency } from '@/domain/money/currency';
import type { ReceiptSeed } from '@/domain/receipt/receiptSeed';
import { createRoomId } from '@/domain/room/roomId';
import { hydrateFromSeed, pendingSeedKey, roomPath } from '@/sync/seedCodec';

/**
 * The seed dialog: whether it's open, importing a seed or a preset into the room's document, and
 * starting a new blank room, which `navigate` goes to. The new room's seed is saved in `storage`,
 * `window.sessionStorage` when it's left out, in the currency of `language`'s region,
 * `navigator.language` when it's left out.
 */
export function useSeedImport(
  doc: Doc,
  showToast: (message: string) => void,
  navigate: (path: string) => void,
  storage?: Pick<Storage, 'setItem'>,
  language?: string,
) {
  const [open, setOpen] = useState(false);

  function openDialog() {
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  function importSeed(seed: ReceiptSeed, forceReset: boolean) {
    hydrateFromSeed(doc, seed, { forceReset });
    setOpen(false);
    showToast(`Imported ${seed.items.length} receipt items.`);
  }

  function loadPreset(seed: ReceiptSeed) {
    importSeed(seed, true);
  }

  // The new room's seed waits in storage until the room loads, as an ingest link's does. Reading
  // `window.sessionStorage` throws where the browser blocks storage, so it's read inside the `try`.
  function newBlankRoom() {
    const blank: ReceiptSeed = {
      title: 'New Receipt',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      currency: localeCurrency(language ?? navigator.language),
      roster: [],
      items: [],
    };
    const nextRoom = createRoomId();
    try {
      (storage ?? window.sessionStorage).setItem(pendingSeedKey(nextRoom), JSON.stringify(blank));
    } catch {}
    navigate(roomPath(nextRoom));
  }

  return { open, openDialog, closeDialog, importSeed, loadPreset, newBlankRoom } as const;
}
