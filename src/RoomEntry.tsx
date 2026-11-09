"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  createRoomId,
  decodeSeed,
  parseIngestUrl,
  parseRoomHash,
  pendingSeedKey,
  roomPath,
} from './store/seedCodec';
import type { ReceiptSeed } from './types/receipt';

function stashSeed(roomId: string, seed: ReceiptSeed | null) {
  if (!seed) return;
  try {
    window.sessionStorage.setItem(pendingSeedKey(roomId), JSON.stringify(seed));
  } catch {}
}

export default function RoomEntry() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const ingest = parseIngestUrl(window.location.href);
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
  }, [router]);

  if (error) {
    return <main className="mx-auto max-w-xl p-8 text-center text-rose-700">{error}</main>;
  }
  return <main className="mx-auto max-w-xl p-8 text-center text-slate-600">Preparing your receipt…</main>;
}
