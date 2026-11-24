import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parsePurchasedAt } from './mealInfo';

/** A moment on a receipt, as the local date and time a person would read off it. */
const moment = fc
  .date({ min: new Date(1900, 0, 1), max: new Date(9999, 11, 31), noInvalidDate: true })
  .map((date) => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }));

function pad(value: number, width = 2) {
  return String(value).padStart(width, '0');
}

/** Everything a receipt or an assistant might write after the minutes, which the date ignores. */
const afterTheMinutes = fc.constantFrom(
  '',
  ':00',
  ':59',
  ':07.123',
  'Z',
  ':30Z',
  '+02:00',
  '-05:30',
  ' PM',
);

/** The ways a purchase time is written: date only or with a time, with either separator. */
const written = fc.record({
  moment,
  time: fc.oneof(
    fc.constant(null),
    fc.record({ separator: fc.constantFrom('T', ' '), after: afterTheMinutes }),
  ),
  before: fc.constantFrom('', ' ', '\t', '\n  '),
  after: fc.constantFrom('', ' ', '\n'),
});

function write({
  moment: m,
  time,
  before,
  after,
}: typeof written extends fc.Arbitrary<infer W> ? W : never) {
  const date = `${pad(m.year, 4)}-${pad(m.month)}-${pad(m.day)}`;
  const clock = time ? `${time.separator}${pad(m.hour)}:${pad(m.minute)}${time.after}` : '';
  return `${before}${date}${clock}${after}`;
}

describe('parsePurchasedAt', () => {
  it('reads back the local date, and the time when one is written', () => {
    fc.assert(
      fc.property(written, (w) => {
        const parsed = parsePurchasedAt(write(w));
        expect(parsed).not.toBeNull();
        const date = parsed?.date as Date;
        expect(parsed?.hasTime).toBe(w.time !== null);
        expect(date.getFullYear()).toBe(w.moment.year);
        expect(date.getMonth() + 1).toBe(w.moment.month);
        expect(date.getDate()).toBe(w.moment.day);
        expect(date.getHours()).toBe(w.time ? w.moment.hour : 0);
        expect(date.getMinutes()).toBe(w.time ? w.moment.minute : 0);
      }),
    );
  });

  it('reads nothing from text that does not start with a full year, month and day', () => {
    const lookAlike = moment.chain((m) =>
      fc.constantFrom(
        `${pad(m.day)}.${pad(m.month)}.${pad(m.year, 4)}`,
        `${pad(m.year, 4)}/${pad(m.month)}/${pad(m.day)}`,
        `${pad(m.year, 4)}-${pad(m.month)}-${m.day % 10}`,
        `${pad(m.year % 100)}-${pad(m.month)}-${pad(m.day)}`,
        `on ${pad(m.year, 4)}-${pad(m.month)}-${pad(m.day)}`,
        `${pad(m.hour)}:${pad(m.minute)}`,
        '',
      ),
    );
    fc.assert(
      fc.property(lookAlike, (text) => {
        expect(parsePurchasedAt(text)).toBeNull();
      }),
    );
  });
});
