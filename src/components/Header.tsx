import { Pencil, Share2, Users } from 'lucide-react';
import type { Participant, RoomSnapshot } from '../types/receipt';

interface HeaderProps {
  roomId: string;
  activeId: string | null;
  peers: RoomSnapshot['peers'];
  participants: readonly Participant[];
  editing: boolean;
  onIdentity: () => void;
  onEdit: () => void;
  onShare: () => void;
}

export function Header({
  roomId,
  activeId,
  peers,
  participants,
  editing,
  onIdentity,
  onEdit,
  onShare,
}: HeaderProps) {
  const identity = participants.find((person) => person.id === activeId);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-600 font-extrabold text-white">
              €⇄$
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-extrabold text-slate-900">SplitSmart P2P</h1>
              <p className="truncate font-mono text-xs text-slate-500">room: {roomId}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 sm:flex" aria-label={`${peers.length} peers online`}>
            <div className="flex -space-x-1.5">
              {peers.slice(0, 4).map((peer) => (
                <span
                  key={peer.id}
                  title={`${peer.name} online`}
                  className="grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-white"
                  style={{ backgroundColor: peer.color || '#4f46e5' }}
                >
                  {peer.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Users size={14} /> {peers.length}
            </span>
          </div>
          <button className="button-secondary" onClick={onIdentity}>
            {identity?.name ?? 'Who are you?'}
          </button>
          <button
            aria-label={editing ? 'Done editing receipt' : 'Edit receipt'}
            className="button-secondary px-2 sm:px-3"
            onClick={onEdit}
          >
            <Pencil size={14} /> <span className="hidden sm:inline">{editing ? 'Done' : 'Edit'}</span>
          </button>
          <button className="button-primary" onClick={onShare}>
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>
    </header>
  );
}
