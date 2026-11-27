import { CalendarDays, ChevronRight, Pencil, Share2, Users } from 'lucide-react';
import { formatPurchaseTime, parsePurchasedAt } from '@/domain/receipt/mealInfo';
import type { Participant, RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import { mergeClasses } from '@/utils/mergeClasses';
import { getConnectionStatusDisplay } from './connectionStatus';

type AppBarProps = {
  /** The receipt it names, and the room's connection. */
  readonly snapshot: Pick<
    RoomSnapshot,
    'title' | 'purchasedAt' | 'mealType' | 'connection' | 'peers'
  >;
  /** Who you are in the room, or `null` before you choose. */
  readonly you: Participant | null;
  readonly editing: boolean;
  readonly onDetails: () => void;
  readonly onIdentity: () => void;
  readonly onEdit: () => void;
  readonly onShare: () => void;
  /** Where the caller places it, such as `sticky top-0`; merged with its own classes. */
  readonly className?: string | undefined;
};

/** The room's bar: the receipt it's for, who you are, the edit and share actions, and the connection. */
export function AppBar({
  snapshot,
  you,
  editing,
  onDetails,
  onIdentity,
  onEdit,
  onShare,
  className,
}: AppBarProps) {
  const { title, purchasedAt, mealType, connection, peers } = snapshot;
  const purchase = parsePurchasedAt(purchasedAt);
  const when = purchase !== null ? formatPurchaseTime(purchase) : null;
  const initial = title.trim().charAt(0).toUpperCase();
  const {
    label: statusLabel,
    indicatorColor,
    textColor,
  } = getConnectionStatusDisplay(connection.status);

  return (
    <header
      className={mergeClasses(
        'border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur',
        className,
      )}
    >
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
                {initial !== '' ? initial : '¤'}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-0.5">
                  <span className="truncate font-extrabold leading-tight text-slate-900">
                    {title}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-slate-600">
                  <CalendarDays size={12} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {when !== null
                      ? `${when.day}${when.time !== '' ? ` · ${when.time}` : ''}`
                      : 'Date not on receipt'}
                  </span>
                </span>
                {mealType !== '' && (
                  <span className="block truncate text-xs font-semibold text-indigo-600">
                    {mealType}
                  </span>
                )}
              </span>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button className="button-secondary" onClick={onIdentity}>
              {you?.name ?? 'Who are you?'}
            </button>
            <button
              aria-label={editing ? 'Done editing receipt' : 'Edit receipt'}
              className="button-secondary px-2 sm:px-3"
              onClick={onEdit}
            >
              <Pencil size={14} />{' '}
              <span className="hidden sm:inline">{editing ? 'Done' : 'Edit'}</span>
            </button>
            <button className="button-primary" onClick={onShare}>
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
          aria-label={`${connection.provider} ${statusLabel.toLowerCase()}, ${peers.length} connections online`}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> is for the result of a calculation; this is the connection's state.
          role="status"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${indicatorColor}`} />
            <span className="font-bold text-slate-700">{connection.provider}</span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className={`truncate ${textColor}`}>{statusLabel}</span>
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
