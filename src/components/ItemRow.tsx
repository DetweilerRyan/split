import { Check, Trash2 } from 'lucide-react';
import type { Participant, ReceiptItem } from '../types/receipt';

interface ItemRowProps {
  item: ReceiptItem;
  participants: readonly Participant[];
  activeId: string | null;
  editing: boolean;
  onClaim: (itemId: string, participantId: string) => void;
  onClaimAll: (itemId: string, participants: readonly Participant[], claimed: boolean) => void;
  onUpdate: (itemId: string, field: 'name' | 'en' | 'eur', value: string | number) => void;
  onDelete: (itemId: string) => void;
}

export function ItemRow({
  item,
  participants,
  activeId,
  editing,
  onClaim,
  onClaimAll,
  onUpdate,
  onDelete,
}: ItemRowProps) {
  const claimedBy = participants.filter((person) => item.claims[person.id]);
  const formatEur = (value: number) => `€${value.toFixed(2)}`;

  if (editing) {
    return (
      <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_7rem_auto]">
        <input aria-label="Item name" className="input" defaultValue={item.name} onBlur={(event) => onUpdate(item.id, 'name', event.target.value)} />
        <input aria-label="English name" className="input" defaultValue={item.en} onBlur={(event) => onUpdate(item.id, 'en', event.target.value)} />
        <input aria-label="Price in euros" className="input" type="number" step="0.01" defaultValue={item.eur} onBlur={(event) => onUpdate(item.id, 'eur', Number(event.target.value) || 0)} />
        <button aria-label={`Delete ${item.name}`} className="button-secondary justify-center text-rose-700" onClick={() => onDelete(item.id)}>
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  const allClaimed = participants.length > 0 && claimedBy.length === participants.length;
  return (
    <article className="border-b border-slate-100 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => activeId && onClaim(item.id, activeId)}>
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${activeId && item.claims[activeId] ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
            {activeId && item.claims[activeId] && <Check size={14} />}
          </span>
          <span className="min-w-0">
            <span className="block break-words text-sm font-extrabold text-slate-900">{item.name}</span>
            {item.en && <span className="block text-xs italic text-slate-500">{item.en}</span>}
          </span>
        </button>
        <span className="shrink-0 font-mono text-sm font-bold">{formatEur(item.eur)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-8">
        <div className="flex flex-wrap gap-1.5">
          {participants.map((person) => (
            <button
              key={person.id}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.claims[person.id] ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-500'}`}
              onClick={() => onClaim(item.id, person.id)}
            >
              {person.name}
            </button>
          ))}
          <button
            className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold"
            onClick={() => onClaimAll(item.id, participants, !allClaimed)}
          >
            {allClaimed ? '✓ All' : 'All'}
          </button>
        </div>
        <span className="text-xs text-slate-500">
          {claimedBy.length === 0 ? 'Unclaimed' : claimedBy.length > 1 ? `${formatEur(item.eur / claimedBy.length)} each` : 'Solo'}
        </span>
      </div>
    </article>
  );
}
