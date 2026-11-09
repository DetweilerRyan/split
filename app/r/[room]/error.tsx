'use client';

import { resetRoomLoads } from '../../../src/hooks/useRoomProvider';

export default function RoomError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-8 text-center text-rose-700">
      <p>{error.message}</p>
      <button
        className="button-secondary"
        onClick={() => {
          resetRoomLoads();
          reset();
        }}
      >
        Try again
      </button>
    </main>
  );
}
