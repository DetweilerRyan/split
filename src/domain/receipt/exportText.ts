import type { Participant, RoomSnapshot } from './roomSnapshot';
import { formatMoney, fromMinor } from '../money/currency';
import { computeReceiptMath, type ReceiptMath, splitItemMinor } from './math';

export function buildExportText(snapshot: RoomSnapshot): string {
  const math = computeReceiptMath(snapshot);
  function fmt(amount: number) {
    return formatMoney(amount, math.currency);
  }
  const lines = [`🧾 ${snapshot.title}`, `💱 Currency: ${math.currency}`];
  if (math.displayCurrency !== null && math.effectiveRate !== null) {
    lines.push(
      `💱 Rate: 1 ${math.currency} = ${math.effectiveRate.toFixed(4)} ${math.displayCurrency}${math.isEstimatedRate ? ` (${snapshot.rateDate !== '' ? snapshot.rateDate : 'est.'})` : ''}`,
    );
    if (snapshot.bankUsd > 0) {
      lines.push(`💳 Bank charged: ${formatMoney(snapshot.bankUsd, math.displayCurrency)}`);
    }
  }
  if (snapshot.cashTipEur > 0) lines.push(`💶 Cash tip: ${fmt(snapshot.cashTipEur)}`);

  snapshot.participants.forEach((participant) => {
    lines.push(...personLines(snapshot, math, participant));
  });

  lines.push(`Total: ${fmt(math.grandTotal)}`);
  return lines.join('\n');
}

/** A participant's line in the summary and a line for each item they share, or none without totals. */
function personLines(
  snapshot: RoomSnapshot,
  math: ReceiptMath,
  participant: Participant,
): readonly string[] {
  const total = math.perPerson[participant.id];
  if (total === undefined) return [];
  function fmt(amount: number) {
    return formatMoney(amount, math.currency);
  }
  const lines = [
    total.converted !== null && math.displayCurrency !== null
      ? `${participant.name}: ${formatMoney(total.converted, math.displayCurrency)} (${fmt(total.total)})`
      : `${participant.name}: ${fmt(total.total)}`,
  ];
  snapshot.items.forEach((item, itemIndex) => {
    const shares = splitItemMinor(item, itemIndex, snapshot.participants, math.currency);
    const share = shares.find(({ id }) => id === participant.id);
    if (share === undefined) return;
    lines.push(
      `  • ${item.name}: ${fmt(fromMinor(share.minor, math.currency))}${shares.length > 1 ? ` (1/${shares.length})` : ''}`,
    );
  });
  return lines;
}
