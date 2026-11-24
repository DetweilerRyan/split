import { useState } from 'react';
import { buildExportText } from '../domain/receipt/exportText';
import type { RoomSnapshot } from '../domain/receipt/roomSnapshot';
import type { RoomId } from '../domain/room/roomId';
import { roomPath } from '../sync/seedCodec';

/** Where copied text goes: `navigator.clipboard`, which is missing outside a secure context. */
export type CopyTarget = Pick<Clipboard, 'writeText'> | undefined;

/**
 * Sharing the room: the share dialog, the room's link, and copying the link or the receipt's
 * summary to `clipboard`.
 */
export function useSharing(
  roomId: RoomId,
  snapshot: RoomSnapshot,
  clipboard: CopyTarget,
  showToast: (message: string) => void,
) {
  const [open, setOpen] = useState(false);
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}${roomPath(roomId)}`;

  function openDialog() {
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  function copyLink() {
    void clipboard?.writeText(url).then(() => showToast('Room link copied.'));
  }

  function copySummary() {
    void clipboard?.writeText(buildExportText(snapshot)).then(() => showToast('Summary copied.'));
  }

  return { open, url, openDialog, closeDialog, copyLink, copySummary } as const;
}
