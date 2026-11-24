import type { RoomSnapshot } from './roomSnapshot';
import { formatMoney } from '../money/currency';
import { computeReceiptMath } from './math';

// @crap-allow CRAP 132, complexity 11. Debt from before the CRAP check (#63): no tests yet.
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
    snapshot.items.forEach((item) => {
      if (!item.claims[participant.id]) return;
      const claimCount = snapshot.participants.filter((person) => item.claims[person.id]).length;
      lines.push(
        `  • ${item.name}: ${fmt(item.eur / claimCount)}${claimCount > 1 ? ` (1/${claimCount})` : ''}`,
      );
    });
  });

  lines.push(`Total: ${fmt(math.grandTotal)}`);
  return lines.join('\n');
}
