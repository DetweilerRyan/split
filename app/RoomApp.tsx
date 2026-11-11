'use client';

import dynamic from 'next/dynamic';

const loading = () => (
  <main className="mx-auto max-w-xl p-8 text-center text-slate-600">Restoring this room…</main>
);

export const RoomEntry = dynamic(() => import('../src/RoomEntry'), { ssr: false, loading });
export const IngestEntry = dynamic(() => import('../src/IngestEntry'), { ssr: false, loading });
export const RoomView = dynamic(() => import('../src/RoomView'), { ssr: false, loading });
