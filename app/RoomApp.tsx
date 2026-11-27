'use client';

import dynamic from 'next/dynamic';

function loading() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center text-slate-600">Restoring this room…</main>
  );
}

export const RoomEntry = dynamic(() => import('@/components/RoomEntry'), { ssr: false, loading });
export const IngestEntry = dynamic(() => import('./ingest/_ingest-entry/IngestEntry'), {
  ssr: false,
  loading,
});
export const RoomViewRoot = dynamic(() => import('./r/[room]/_room-view/RoomView.root'), {
  ssr: false,
  loading,
});
