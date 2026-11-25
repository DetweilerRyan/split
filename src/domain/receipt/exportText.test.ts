import { describe, expect, it } from 'vitest';
import { formatMoney } from '../money/currency';
import { type RoomSnapshot, itemIdSchema, participantIdSchema } from './roomSnapshot';
import { buildExportText } from './exportText';

/** The participant id of the participant named `name`. */
function idOf(name: string) {
  return participantIdSchema.parse(`p-${name.toLowerCase()}`);
}

function receipt(
  currency: string,
  amounts: readonly number[],
  claimants: readonly (readonly string[])[],
): RoomSnapshot {
  const names = ['Ana', 'Ben', 'Cy'];
  return {
    title: 'Lunch',
    address: '',
    phone: '',
    website: '',
    purchasedAt: '',
    mealType: '',
    cardTipEur: 0,
    cashTipEur: 0,
    bankUsd: 0,
    currency,
    displayCurrency: '',
    rate: 0,
    rateDate: '',
    connection: { provider: 'WebRTC', status: 'connected' },
    peers: [],
    participants: names.map((name, colorIdx) => ({ id: idOf(name), name, colorIdx })),
    items: amounts.map((eur, order) => ({
      id: itemIdSchema.parse(`item-${order}`),
      name: `Dish ${order + 1}`,
      en: '',
      eur,
      order,
      claims: Object.fromEntries(
        names.map((name) => [idOf(name), claimants[order]?.includes(name) === true]),
      ),
    })),
  };
}

// The summary formats money in the runtime's default locale, so the expected text does too;
// what these tests check is the amounts, not how they're written.
function usd(amount: number) {
  return formatMoney(amount, 'USD');
}
function eur(amount: number) {
  return formatMoney(amount, 'EUR');
}
function jpy(amount: number) {
  return formatMoney(amount, 'JPY');
}
function kwd(amount: number) {
  return formatMoney(amount, 'KWD');
}

describe('buildExportText', () => {
  it("shows the extra cent of an item that doesn't divide evenly on the share that pays it", () => {
    // $1.00 three ways is 33 cents each, and the cent left over goes to the first claimant.
    expect(buildExportText(receipt('USD', [1], [['Ana', 'Ben', 'Cy']]))).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: USD',
        `Ana: ${usd(0.34)}`,
        `  • Dish 1: ${usd(0.34)} (1/3)`,
        `Ben: ${usd(0.33)}`,
        `  • Dish 1: ${usd(0.33)} (1/3)`,
        `Cy: ${usd(0.33)}`,
        `  • Dish 1: ${usd(0.33)} (1/3)`,
        `Total: ${usd(1)}`,
      ].join('\n'),
    );
  });

  it("gives each next item's leftover unit to the next claimant, so each line matches its total", () => {
    // ¥100 three ways is ¥33 each and ¥1 over: the first item's goes to Ana, the second's to Ben.
    expect(
      buildExportText(
        receipt(
          'JPY',
          [100, 100],
          [
            ['Ana', 'Ben', 'Cy'],
            ['Ana', 'Ben', 'Cy'],
          ],
        ),
      ),
    ).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: JPY',
        `Ana: ${jpy(67)}`,
        `  • Dish 1: ${jpy(34)} (1/3)`,
        `  • Dish 2: ${jpy(33)} (1/3)`,
        `Ben: ${jpy(67)}`,
        `  • Dish 1: ${jpy(33)} (1/3)`,
        `  • Dish 2: ${jpy(34)} (1/3)`,
        `Cy: ${jpy(66)}`,
        `  • Dish 1: ${jpy(33)} (1/3)`,
        `  • Dish 2: ${jpy(33)} (1/3)`,
        `Total: ${jpy(200)}`,
      ].join('\n'),
    );
  });

  it('converts each total at the bank charge, and lists the cash tip in the totals', () => {
    // The card paid €10.00 and the bank charged $11.00, so €1 is $1.10; Ana owes €10.00 and the
    // €2.00 cash tip, which is $13.20.
    const snapshot = {
      ...receipt('EUR', [10], [['Ana']]),
      cashTipEur: 2,
      bankUsd: 11,
      displayCurrency: 'USD',
    };
    expect(buildExportText(snapshot)).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: EUR',
        '💱 Rate: 1 EUR = 1.1000 USD',
        `💳 Bank charged: ${usd(11)}`,
        `💶 Cash tip: ${eur(2)}`,
        `Ana: ${usd(13.2)} (${eur(12)})`,
        `  • Dish 1: ${eur(10)}`,
        `Ben: ${usd(0)} (${eur(0)})`,
        `Cy: ${usd(0)} (${eur(0)})`,
        `Total: ${eur(12)}`,
      ].join('\n'),
    );
  });

  it('counts only the claimants of an item when splitting it', () => {
    // KWD 1.001 two ways is 0.500 each and 0.001 over, which the first claimant, Ben, pays.
    expect(buildExportText(receipt('KWD', [1.001], [['Ben', 'Cy']]))).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: KWD',
        `Ana: ${kwd(0)}`,
        `Ben: ${kwd(0.501)}`,
        `  • Dish 1: ${kwd(0.501)} (1/2)`,
        `Cy: ${kwd(0.5)}`,
        `  • Dish 1: ${kwd(0.5)} (1/2)`,
        `Total: ${kwd(1.001)}`,
      ].join('\n'),
    );
  });
});
