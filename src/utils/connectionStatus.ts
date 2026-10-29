import type { RoomSnapshot } from '../types/receipt';

export function getConnectionStatusDisplay(status: RoomSnapshot['connection']['status']) {
  switch (status) {
    case 'connected':
      return {
        label: 'Connected',
        indicatorColor: 'bg-emerald-500',
        textColor: 'text-emerald-700',
      };
    case 'disconnected':
      return {
        label: 'Offline',
        indicatorColor: 'bg-rose-500',
        textColor: 'text-slate-500',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting',
        indicatorColor: 'bg-amber-400',
        textColor: 'text-slate-500',
      };
    case 'connecting':
      return {
        label: 'Connecting',
        indicatorColor: 'bg-amber-400',
        textColor: 'text-slate-500',
      };
  }
}
