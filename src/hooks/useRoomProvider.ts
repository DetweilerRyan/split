import { useEffect, useState } from 'react';
import type { ReceiptSeed } from '../types/receipt';
import { getRoomProvider, type RoomProvider } from '../store/yjsProvider';
import { pendingSeedKey } from '../store/seedCodec';

export function useRoomProvider(roomId: string, seed: ReceiptSeed | null) {
  const [provider, setProvider] = useState<RoomProvider | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRoomProvider(roomId, seed)
      .then((roomProvider) => {
        if (!active) return;
        setProvider(roomProvider);
        try {
          window.sessionStorage.removeItem(pendingSeedKey(roomId));
        } catch {}
      })
      .catch(() => {
        if (active) setError('Could not open this receipt room.');
      });
    return () => {
      active = false;
    };
  }, [roomId, seed]);

  return { provider, error };
}
