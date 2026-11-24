import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from './roomSnapshot';
import { buildExportText } from './exportText';

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
    participants: names.map((name, colorIdx) => ({ id: name, name, colorIdx })),
    items: amounts.map((eur, order) => ({
      id: `item-${order}`,
      name: `Dish ${order + 1}`,
      en: '',
      eur,
      order,
      claims: Object.fromEntries(names.map((name) => [name, claimants[order].includes(name)])),
    })),
  };
}

describe('buildExportText', () => {
  it("shows the extra cent of an item that doesn't divide evenly on the share that pays it", () => {
    // $1.00 three ways is 33 cents each, and the cent left over goes to the first claimant.
    expect(buildExportText(receipt('USD', [1], [['Ana', 'Ben', 'Cy']]))).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: USD',
        'Ana: $0.34',
        '  • Dish 1: $0.34 (1/3)',
        'Ben: $0.33',
        '  • Dish 1: $0.33 (1/3)',
        'Cy: $0.33',
        '  • Dish 1: $0.33 (1/3)',
        'Total: $1.00',
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
        'Ana: ¥67',
        '  • Dish 1: ¥34 (1/3)',
        '  • Dish 2: ¥33 (1/3)',
        'Ben: ¥67',
        '  • Dish 1: ¥33 (1/3)',
        '  • Dish 2: ¥34 (1/3)',
        'Cy: ¥66',
        '  • Dish 1: ¥33 (1/3)',
        '  • Dish 2: ¥33 (1/3)',
        'Total: ¥200',
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
        '💳 Bank charged: $11.00',
        '💶 Cash tip: €2.00',
        'Ana: $13.20 (€12.00)',
        '  • Dish 1: €10.00',
        'Ben: $0.00 (€0.00)',
        'Cy: $0.00 (€0.00)',
        'Total: €12.00',
      ].join('\n'),
    );
  });

  it('counts only the claimants of an item when splitting it', () => {
    // KWD 1.001 two ways is 0.500 each and 0.001 over, which the first claimant, Ben, pays.
    expect(buildExportText(receipt('KWD', [1.001], [['Ben', 'Cy']]))).toBe(
      [
        '🧾 Lunch',
        '💱 Currency: KWD',
        'Ana: KWD\u00a00.000',
        'Ben: KWD\u00a00.501',
        '  • Dish 1: KWD\u00a00.501 (1/2)',
        'Cy: KWD\u00a00.500',
        '  • Dish 1: KWD\u00a00.500 (1/2)',
        'Total: KWD\u00a01.001',
      ].join('\n'),
    );
  });
});
