import type { RoomSnapshot } from '../types/receipt';
import { computeReceiptMath } from './math';

export function buildExportText(snapshot: RoomSnapshot): string {
  const math = computeReceiptMath(snapshot);
  const lines = [
    `🧾 ${snapshot.title}`,
    `💱 Rate: 1 € = $${math.effectiveRate.toFixed(4)}${math.isEstimatedRate ? ' (Est.)' : ''}`,
  ];
  if (snapshot.bankUsd > 0) lines.push(`💳 Bank charged: $${snapshot.bankUsd.toFixed(2)}`);
  if (snapshot.cashTipEur > 0) lines.push(`💶 Cash tip: €${snapshot.cashTipEur.toFixed(2)}`);

  snapshot.participants.forEach((participant) => {
    const total = math.perPerson[participant.id];
    lines.push(
      `${participant.name}: $${total.totalUsd.toFixed(2)} (€${total.totalEur.toFixed(2)})`,
    );
    snapshot.items.forEach((item) => {
      if (!item.claims[participant.id]) return;
      const claimCount = snapshot.participants.filter((person) => item.claims[person.id]).length;
      lines.push(`  • ${item.name}: €${(item.eur / claimCount).toFixed(2)}${claimCount > 1 ? ` (1/${claimCount})` : ''}`);
    });
  });

  const grandTotalEur = math.cardTotalEur + snapshot.cashTipEur;
  lines.push(`Total: €${grandTotalEur.toFixed(2)} ($${(grandTotalEur * math.effectiveRate).toFixed(2)})`);
  return lines.join('\n');
}
