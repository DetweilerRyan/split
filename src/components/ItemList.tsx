import type { Participant, ReceiptItem } from '../types/receipt';
import { ItemRow } from './ItemRow';

interface ItemListProps {
  items: readonly ReceiptItem[];
  participants: readonly Participant[];
  activeId: string | null;
  editing: boolean;
  filter: 'all' | 'unclaimed' | 'mine';
  onClaim: (itemId: string, participantId: string) => void;
  onClaimAll: (itemId: string, participants: readonly Participant[], claimed: boolean) => void;
  onUpdate: (itemId: string, field: 'name' | 'en' | 'eur', value: string | number) => void;
  onDelete: (itemId: string) => void;
}

export function ItemList(props: ItemListProps) {
  const visible = props.items.filter((item) => {
    if (props.filter === 'unclaimed') return !Object.values(item.claims).some(Boolean);
    if (props.filter === 'mine') return props.activeId ? item.claims[props.activeId] : false;
    return true;
  });

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div>
          <h2 className="font-extrabold text-slate-900">Receipt items</h2>
          <p className="text-xs text-slate-500">{props.items.length} line items · tap to claim</p>
        </div>
        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-sm font-bold text-indigo-800">
          €{props.items.reduce((sum, item) => sum + item.eur, 0).toFixed(2)}
        </span>
      </div>
      {visible.length ? visible.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          participants={props.participants}
          activeId={props.activeId}
          editing={props.editing}
          onClaim={props.onClaim}
          onClaimAll={props.onClaimAll}
          onUpdate={props.onUpdate}
          onDelete={props.onDelete}
        />
      )) : <p className="p-8 text-center text-sm text-slate-500">No items match this filter.</p>}
    </section>
  );
}
