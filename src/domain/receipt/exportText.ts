import type { RoomSnapshot } from './roomSnapshot';
import { formatMoney, fromMinor } from '../money/currency';
import { computeReceiptMath, splitItemMinor } from './math';

// @crap-allow CRAP 11, complexity 11. One branch per line or note the summary may leave out; splitting them would scatter its layout across helpers. Split it if it gains another.
export function buildExportText(snapshot: RoomSnapshot): string {
  const math = computeReceiptMath(snapshot);
  function fmt(amount: number) {
    return formatMoney(amount, math.currency);
  }
  const lines = [`🧾 ${snapshot.title}`, `💱 Currency: ${math.currency}`];
  if (math.displayCurrency && math.effectiveRate !== null) {
    lines.push(
      `💱 Rate: 1 ${math.currency} = ${math.effectiveRate.toFixed(4)} ${math.displayCurrency}${math.isEstimatedRate ? ` (${snapshot.rateDate || 'est.'})` : ''}`,
    );
    if (snapshot.bankUsd > 0) {
      lines.push(`💳 Bank charged: ${formatMoney(snapshot.bankUsd, math.displayCurrency)}`);
    }
  }
  if (snapshot.cashTipEur > 0) lines.push(`💶 Cash tip: ${fmt(snapshot.cashTipEur)}`);

  snapshot.participants.forEach((participant) => {
    const total = math.perPerson[participant.id];
    lines.push(
      total.converted !== null && math.displayCurrency
        ? `${participant.name}: ${formatMoney(total.converted, math.displayCurrency)} (${fmt(total.total)})`
        : `${participant.name}: ${fmt(total.total)}`,
    );
    snapshot.items.forEach((item, itemIndex) => {
      const shares = splitItemMinor(item, itemIndex, snapshot.participants, math.currency);
      const share = shares.find(({ id }) => id === participant.id);
      if (!share) return;
      lines.push(
        `  • ${item.name}: ${fmt(fromMinor(share.minor, math.currency))}${shares.length > 1 ? ` (1/${shares.length})` : ''}`,
      );
    });
  });

  lines.push(`Total: ${fmt(math.grandTotal)}`);
  return lines.join('\n');
}
