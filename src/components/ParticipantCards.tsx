import type { RoomSnapshot } from '../types/receipt';
import { formatMoney } from '../utils/currency';
import { computeReceiptMath } from '../utils/math';

interface ParticipantCardsProps {
  snapshot: RoomSnapshot;
}

export function ParticipantCards({ snapshot }: ParticipantCardsProps) {
  const math = computeReceiptMath(snapshot);
  return (
    <section className="card p-4">
      <h2 className="mb-3 font-extrabold text-slate-900">Per-person totals</h2>
      <div className="space-y-3">
        {snapshot.participants.map((participant) => {
          const totals = math.perPerson[participant.id];
          const fmt = (amount: number) => formatMoney(amount, math.currency);
          return (
            <article key={participant.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{participant.name}</h3>
                  <p className="text-xs text-slate-500">
                    Items {fmt(totals.itemsSubtotal)} · tips {fmt(totals.cardTipShare + totals.cashTipShare)}
                  </p>
                </div>
                <div className="text-right font-mono">
                  {totals.converted !== null && math.displayCurrency ? (
                    <>
                      <p className="font-extrabold text-indigo-700">{formatMoney(totals.converted, math.displayCurrency)}{math.isEstimatedRate ? ' est.' : ''}</p>
                      <p className="text-xs text-slate-500">{fmt(totals.total)}</p>
                    </>
                  ) : (
                    <p className="font-extrabold text-indigo-700">{fmt(totals.total)}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {math.displayCurrency && math.effectiveRate !== null && (
        <p className="mt-3 text-xs text-slate-500">
          Rate: 1 {math.currency} = {math.effectiveRate.toFixed(4)} {math.displayCurrency} · {math.isEstimatedRate ? `rate of ${snapshot.rateDate || 'unknown date'}` : 'based on bank charge'}
        </p>
      )}
    </section>
  );
}
