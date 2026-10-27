import type { ReceiptItem } from '../types/receipt';

interface UnclaimedBannerProps {
  items: readonly ReceiptItem[];
  total: number;
  filter: 'all' | 'unclaimed' | 'mine';
  onFilter: (filter: 'all' | 'unclaimed' | 'mine') => void;
}

export function UnclaimedBanner({ items, total, filter, onFilter }: UnclaimedBannerProps) {
  const claimed = items.reduce((sum, item) => {
    return sum + (Object.values(item.claims).some(Boolean) ? item.eur : 0);
  }, 0);
  const percent = total > 0 ? Math.min(100, Math.round((claimed / total) * 100)) : 100;
  const unclaimed = items.filter((item) => !Object.values(item.claims).some(Boolean));
  const formatEur = (amount: number) => `€${amount.toFixed(2)}`;

  return (
    <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-56 flex-1 items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-xs font-bold text-amber-900">
          {unclaimed.length ? `${formatEur(unclaimed.reduce((sum, item) => sum + item.eur, 0))} unclaimed` : 'All claimed'}
        </span>
      </div>
      <div className="flex gap-1 rounded-xl bg-slate-200 p-1">
        {(['all', 'unclaimed', 'mine'] as const).map((value) => (
          <button
            key={value}
            className={`rounded-lg px-3 py-1 text-xs font-bold capitalize ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => onFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}
