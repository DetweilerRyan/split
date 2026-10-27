import type { RoomSnapshot } from '../types/receipt';
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
          return (
            <article key={participant.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{participant.name}</h3>
                  <p className="text-xs text-slate-500">
                    Items €{totals.itemsSubtotalEur.toFixed(2)} · tips €{(totals.cardTipShareEur + totals.cashTipShareEur).toFixed(2)}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-extrabold text-indigo-700">${totals.totalUsd.toFixed(2)}{math.isEstimatedRate ? ' est.' : ''}</p>
                  <p className="text-xs text-slate-500">€{totals.totalEur.toFixed(2)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Rate: 1 € = ${math.effectiveRate.toFixed(4)} · {math.isEstimatedRate ? 'estimated' : 'based on bank charge'}
      </p>
    </section>
  );
}
