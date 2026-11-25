import { Check, Trash2 } from 'lucide-react';
import type {
  ItemId,
  Participant,
  ParticipantId,
  ReceiptItem,
} from '@/domain/receipt/roomSnapshot';
import { currencyExponent, formatMoney } from '@/domain/money/currency';
import { numberOrZero } from '@/utils/schemas/numberOrZero';

type ItemRowProps = {
  readonly item: ReceiptItem;
  readonly participants: readonly Participant[];
  readonly activeId: ParticipantId | null;
  readonly editing: boolean;
  readonly currency: string;
  readonly onClaim: (itemId: ItemId, participantId: ParticipantId) => void;
  readonly onClaimAll: (
    itemId: ItemId,
    participants: readonly Participant[],
    claimed: boolean,
  ) => void;
  readonly onUpdate: (itemId: ItemId, field: 'name' | 'en' | 'eur', value: string | number) => void;
  readonly onDelete: (itemId: ItemId) => void;
};

type EditorProps = Pick<ItemRowProps, 'item' | 'currency' | 'onUpdate' | 'onDelete'>;

type ClaimerProps = Pick<
  ItemRowProps,
  'item' | 'participants' | 'activeId' | 'currency' | 'onClaim' | 'onClaimAll'
>;

/** A receipt line: its fields while the receipt is being edited, and its claims otherwise. */
export function ItemRow({
  item,
  participants,
  activeId,
  editing,
  currency,
  onClaim,
  onClaimAll,
  onUpdate,
  onDelete,
}: ItemRowProps) {
  if (editing) {
    return <ItemEditor item={item} currency={currency} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  return (
    <ItemClaimer
      item={item}
      participants={participants}
      activeId={activeId}
      currency={currency}
      onClaim={onClaim}
      onClaimAll={onClaimAll}
    />
  );
}

function ItemEditor({ item, currency, onUpdate, onDelete }: EditorProps) {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_7rem_auto]">
      <input
        aria-label="Item name"
        className="input"
        defaultValue={item.name}
        onBlur={(event) => onUpdate(item.id, 'name', event.target.value)}
      />
      <input
        aria-label="English name"
        className="input"
        defaultValue={item.en}
        onBlur={(event) => onUpdate(item.id, 'en', event.target.value)}
      />
      <input
        aria-label={`Price in ${currency}`}
        className="input"
        type="number"
        step={10 ** -currencyExponent(currency)}
        defaultValue={item.eur}
        onBlur={(event) => onUpdate(item.id, 'eur', numberOrZero(event.target.value))}
      />
      <button
        aria-label={`Delete ${item.name}`}
        className="button-secondary justify-center text-rose-700"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function ItemClaimer({
  item,
  participants,
  activeId,
  currency,
  onClaim,
  onClaimAll,
}: ClaimerProps) {
  const claimedBy = participants.filter((person) => item.claims[person.id] === true);
  const allClaimed = participants.length > 0 && claimedBy.length === participants.length;
  const claimedByMe = activeId !== null && item.claims[activeId] === true;
  return (
    <article className="border-b border-slate-100 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <button
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={() => {
            if (activeId !== null) onClaim(item.id, activeId);
          }}
        >
          <span
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${claimedByMe ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
          >
            {claimedByMe && <Check size={14} />}
          </span>
          <span className="min-w-0">
            <span className="block break-words text-sm font-extrabold text-slate-900">
              {item.name}
            </span>
            {item.en !== '' && (
              <span className="block text-xs italic text-slate-500">{item.en}</span>
            )}
          </span>
        </button>
        <span className="shrink-0 font-mono text-sm font-bold">
          {formatMoney(item.eur, currency)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-8">
        <div className="flex flex-wrap gap-1.5">
          {participants.map((person) => (
            <button
              key={person.id}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.claims[person.id] === true ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-500'}`}
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
          {sharing(claimedBy.length, item.eur, currency)}
        </span>
      </div>
    </article>
  );
}

/** How the row says the item is shared among the people who claimed it. */
function sharing(claimants: number, amount: number, currency: string): string {
  if (claimants === 0) return 'Unclaimed';
  if (claimants === 1) return 'Solo';
  return `${formatMoney(amount / claimants, currency)} each`;
}
