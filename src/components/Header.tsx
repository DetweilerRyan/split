import { CalendarDays, ChevronRight, Pencil, Share2, Users } from 'lucide-react';
import { formatPurchaseTime, guessMeal, parsePurchasedAt } from '../utils/mealInfo';
import type { Participant, RoomSnapshot } from '../types/receipt';
import { getConnectionStatusDisplay } from '../utils/connectionStatus';

interface HeaderProps {
  roomId: string;
  title: string;
  purchasedAt: string;
  itemCount: number;
  onDetails: () => void;
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
  title,
  purchasedAt,
  itemCount,
  onDetails,
  activeId,
  connection,
  peers,
  participants,
  editing,
  onIdentity,
  onEdit,
  onShare,
}: HeaderProps) {
  const purchase = parsePurchasedAt(purchasedAt);
  const when = purchase ? formatPurchaseTime(purchase) : null;
  const meal = guessMeal(purchase, itemCount);
  const identity = participants.find((person) => person.id === activeId);
  const { label: statusLabel, indicatorColor, textColor } =
    getConnectionStatusDisplay(connection.status);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={`Restaurant details for ${title}`}
              className="flex min-w-0 items-center gap-2 rounded-xl py-0.5 pr-1 text-left active:bg-slate-100"
              onClick={onDetails}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-600 font-extrabold text-white">
                {title.trim().charAt(0).toUpperCase() || '¤'}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-0.5">
                  <span className="truncate font-extrabold leading-tight text-slate-900">{title}</span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-slate-600">
                  <CalendarDays size={12} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {when ? `${when.day}${when.time ? ` · ${when.time}` : ''}` : 'Date not on receipt'}
                  </span>
                </span>
                {meal && <span className="block truncate text-xs font-semibold text-indigo-600">{meal}</span>}
              </span>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
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
