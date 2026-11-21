'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  createRoomId,
  INGEST_PATH,
  decodeSeed,
  parseIngestUrl,
  parseRoomHash,
  pendingSeedKey,
  roomPath,
} from './store/seedCodec';
import type { ReceiptSeed } from './types/receipt';
import type { RoomId } from './store/seedCodec';

function stashSeed(roomId: RoomId, seed: ReceiptSeed | null) {
  if (!seed) return;
  try {
    window.sessionStorage.setItem(pendingSeedKey(roomId), JSON.stringify(seed));
  } catch {}
}

export default function RoomEntry({ mode = 'root' }: { mode?: 'root' | 'ingest' }) {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const ingest = parseIngestUrl(window.location.href);
    if (mode === 'root') {
      // Old ingest links pointed at the root; forward them to the explicit path.
      if (ingest) {
        router.replace(`${INGEST_PATH}${window.location.search}${window.location.hash}`);
        return;
      }
    } else if (!ingest) {
      // The link is read from window.location, which exists only in the browser, not during render.
      // oxlint-disable-next-line react/set-state-in-effect
      setError('This page needs an ingest link containing receipt data.');
      return;
    }
    if (ingest && 'error' in ingest) {
      setError(ingest.error);
      return;
    }
    if (ingest) {
      stashSeed(ingest.roomId, ingest.seed);
      router.replace(roomPath(ingest.roomId));
      return;
    }
    const legacy = parseRoomHash(window.location.hash);
    const roomId = legacy.roomId || createRoomId();
    stashSeed(roomId, decodeSeed(legacy.seed));
    router.replace(roomPath(roomId));
  }, [router, mode]);

  if (error) {
    return <main className="mx-auto max-w-xl p-8 text-center text-rose-700">{error}</main>;
  }
  return (
    <main className="mx-auto max-w-xl p-8 text-center text-slate-600">Preparing your receipt…</main>
  );
}
