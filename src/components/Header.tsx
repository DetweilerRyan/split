import { Pencil, Share2, Users } from 'lucide-react';
import type { Participant, RoomSnapshot } from '../types/receipt';
import { getConnectionStatusDisplay } from '../utils/connectionStatus';

interface HeaderProps {
  roomId: string;
  activeId: string | null;
  connection: RoomSnapshot['connection'];
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
  connection,
  peers,
  participants,
  editing,
  onIdentity,
  onEdit,
  onShare,
}: HeaderProps) {
  const identity = participants.find((person) => person.id === activeId);
  const { label: statusLabel, indicatorColor, textColor } =
    getConnectionStatusDisplay(connection.status);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-600 font-extrabold text-white">
              €⇄$
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-extrabold text-slate-900">SplitSmart P2P</h1>
              <p className="truncate font-mono text-xs text-slate-500">room: {roomId}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button className="button-secondary" onClick={onIdentity}>
              {identity?.name ?? 'Who are you?'}
            </button>
            <button className="button-secondary hidden sm:inline-flex" onClick={onEdit}>
              <Pencil size={14} /> {editing ? 'Done' : 'Edit'}
            </button>
            <button className="button-primary" onClick={onShare}>
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
          aria-label={`${connection.provider} ${statusLabel.toLowerCase()}, ${peers.length} connections online`}
          role="status"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${indicatorColor}`} />
            <span className="font-bold text-slate-700">{connection.provider}</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className={`truncate ${textColor}`}>
              {statusLabel}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600">
            <Users size={14} />
            <span>{peers.length} online</span>
          </span>
        </div>
      </div>
    </header>
  );
}
