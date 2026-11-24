import { formatMoney } from '@/domain/money/currency';
import type { ReceiptMath } from '@/domain/receipt/math';
import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';

interface ReceiptSummaryProps {
  readonly snapshot: RoomSnapshot;
  /** `computeReceiptMath(snapshot)`. */
  readonly math: ReceiptMath;
  readonly onCopySummary: () => void;
}

/** The receipt's totals, and the exchange rate while it's shown in another currency. */
export function ReceiptSummary({ snapshot, math, onCopySummary }: ReceiptSummaryProps) {
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-900">{snapshot.title}</h2>
          <p className="text-xs text-slate-500">Live receipt split</p>
        </div>
        <button className="button-secondary" onClick={onCopySummary}>
          Copy summary
        </button>
      </div>
      <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Currency</dt>
          <dd className="font-mono">{math.currency}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Items subtotal</dt>
          <dd className="font-mono font-bold">{formatMoney(math.itemsSubtotal, math.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Card total</dt>
          <dd className="font-mono">{formatMoney(math.cardTotal, math.currency)}</dd>
        </div>
        {math.displayCurrency && math.effectiveRate !== null && (
          <>
            {snapshot.bankUsd > 0 && (
              <div className="flex justify-between">
                <dt>Bank charge</dt>
                <dd className="font-mono">{formatMoney(snapshot.bankUsd, math.displayCurrency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold">
              <dt>
                Exchange rate
                {math.isEstimatedRate && snapshot.rateDate ? ` (${snapshot.rateDate})` : ''}
              </dt>
              <dd className="font-mono">
                {math.effectiveRate.toFixed(4)} {math.displayCurrency} / {math.currency}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
