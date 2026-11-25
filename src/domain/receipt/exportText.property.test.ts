import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from './roomSnapshot';
import { buildExportText } from './exportText';
import type { Frozen } from '@/utils/frozen';

const names = ['Ana', 'Ben', 'Cy', 'Dee'] as const;

/** Currencies with 0, 2 and 3 decimals, which change how many minor units an amount has. */
const currency = fc.constantFrom(
  { code: 'JPY', exponent: 0 },
  { code: 'USD', exponent: 2 },
  { code: 'EUR', exponent: 2 },
  { code: 'KWD', exponent: 3 },
);

/**
 * A receipt with no tips, so each person's total is only their items. Its items may be claimed by
 * anyone, by no one, or by someone who isn't at the table, and it may be converted to a display
 * currency, which puts the receipt-currency total in brackets after the converted one.
 */
const receipt = fc.record({
  currency,
  participantCount: fc.integer({ min: 1, max: names.length }),
  items: fc.array(
    fc.record({
      minor: fc.integer({ min: 0, max: 1_000_000 }),
      claims: fc.record(
        { Ana: fc.boolean(), Ben: fc.boolean(), Cy: fc.boolean(), Dee: fc.boolean() },
        { requiredKeys: [] },
      ),
    }),
    { maxLength: 6 },
  ),
  conversion: fc.oneof(
    fc.constant({ displayCurrency: '', rate: 0 }),
    fc.record({
      displayCurrency: fc.constantFrom('GBP', 'JPY', 'KWD'),
      rate: fc.double({ min: 0.0001, max: 1_000, noNaN: true }),
    }),
  ),
});

type Receipt = Frozen<typeof receipt extends fc.Arbitrary<infer R> ? R : never>;

function snapshotOf(r: Receipt): RoomSnapshot {
  return {
    title: 'Receipt',
    address: '',
    phone: '',
    website: '',
    purchasedAt: '',
    mealType: '',
    cardTipEur: 0,
    cashTipEur: 0,
    bankUsd: 0,
    currency: r.currency.code,
    displayCurrency: r.conversion.displayCurrency,
    rate: r.conversion.rate,
    rateDate: '',
    connection: { provider: 'WebRTC', status: 'connected' },
    peers: [],
    participants: names
      .slice(0, r.participantCount)
      .map((name, colorIdx) => ({ id: name, name, colorIdx })),
    items: r.items.map((item, order) => ({
      id: `item-${order}`,
      name: `Dish ${order}`,
      en: '',
      eur: item.minor / 10 ** r.currency.exponent,
      order,
      claims: item.claims,
    })),
  };
}

/**
 * An amount the summary prints, in minor units. A currency amount is printed with exactly its
 * currency's decimals, so its digits alone are the amount in minor units. A missing one reads as
 * NaN, which equals no amount.
 */
function minorOf(printed: string | undefined) {
  return Number(printed?.replaceAll(/\D/g, ''));
}

/** A person's line and the item lines under it, as amounts in the receipt currency's minor units. */
type PersonLines = {
  readonly name: string;
  readonly totalMinor: number;
  readonly itemsMinor: readonly number[];
};

function readSummary(text: string) {
  const lines = text.split('\n');
  const people: PersonLines[] = [];
  lines.forEach((line) => {
    const item = /^ {2}• .*: (.*?)(?: \(1\/\d+\))?$/.exec(line);
    if (item !== null) {
      const person = people.pop() as PersonLines;
      people.push({ ...person, itemsMinor: [...person.itemsMinor, minorOf(item[1])] });
      return;
    }
    const person = new RegExp(`^(${names.join('|')}): (?:.* \\((.*)\\)|(.*))$`).exec(line);
    if (person !== null) {
      people.push({
        name: person[1] ?? '',
        totalMinor: minorOf(person[2] ?? person[3]),
        itemsMinor: [],
      });
    }
  });
  const total = /^Total: (.*)$/.exec(lines.at(-1) ?? '') as RegExpExecArray;
  return { people, totalMinor: minorOf(total[1]) };
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

describe('buildExportText', () => {
  it("adds up each person's item lines to their total, and everyone's to the claimed items", () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const summary = readSummary(buildExportText(snapshotOf(r)));
        const atTable = names.slice(0, r.participantCount);
        const claimedMinor = sum(
          r.items
            .filter((item) => atTable.some((name) => item.claims[name] === true))
            .map((item) => item.minor),
        );
        expect(summary.people.map((person) => person.name)).toEqual(atTable);
        summary.people.forEach((person) => {
          expect(sum(person.itemsMinor)).toBe(person.totalMinor);
        });
        expect(sum(summary.people.map((person) => person.totalMinor))).toBe(claimedMinor);
        expect(summary.totalMinor).toBe(sum(r.items.map((item) => item.minor)));
      }),
    );
  });
});
