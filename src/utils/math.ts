import type { RoomSnapshot } from '../types/receipt';

export interface PersonTotal {
  participant: RoomSnapshot['participants'][number];
  itemsSubtotalEur: number;
  cardTipShareEur: number;
  cashTipShareEur: number;
  totalEur: number;
  totalUsd: number;
}

export function computeReceiptMath(snapshot: RoomSnapshot) {
  const itemsSubtotalEur = snapshot.items.reduce((sum, item) => sum + item.eur, 0);
  const perPerson: Record<string, PersonTotal> = {};

  snapshot.participants.forEach((participant) => {
    perPerson[participant.id] = {
      participant,
      itemsSubtotalEur: 0,
      cardTipShareEur: 0,
      cashTipShareEur: 0,
      totalEur: 0,
      totalUsd: 0,
    };
  });

  snapshot.items.forEach((item) => {
    const claimants = snapshot.participants.filter((person) => item.claims[person.id]);
    if (claimants.length) {
      const share = item.eur / claimants.length;
      claimants.forEach(({ id }) => {
        perPerson[id].itemsSubtotalEur += share;
      });
    }
  });

  const claimedSubtotal = Object.values(perPerson).reduce(
    (sum, person) => sum + person.itemsSubtotalEur,
    0,
  );
  const cardTotalEur = itemsSubtotalEur + snapshot.cardTipEur;
  const isEstimatedRate = !(snapshot.bankUsd > 0 && cardTotalEur > 0);
  const effectiveRate = isEstimatedRate ? 1.085 : snapshot.bankUsd / cardTotalEur;

  Object.values(perPerson).forEach((person) => {
    const ratio = claimedSubtotal > 0 ? person.itemsSubtotalEur / claimedSubtotal : 0;
    person.cardTipShareEur = snapshot.cardTipEur * ratio;
    person.cashTipShareEur = snapshot.cashTipEur * ratio;
    person.totalEur =
      person.itemsSubtotalEur + person.cardTipShareEur + person.cashTipShareEur;
    person.totalUsd = person.totalEur * effectiveRate;
  });

  return {
    itemsSubtotalEur,
    cardTotalEur,
    effectiveRate,
    isEstimatedRate,
    perPerson,
  };
}
