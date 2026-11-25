import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parsePurchasedAt } from './mealInfo';

/** The first local moment of a year, including years below 100, which `new Date(y, …)` maps to 19xx. */
function startOfYear(year: number) {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, 0, 1);
  return date;
}

/**
 * A moment on a receipt, as the local date and time a person would read off it. Years below 100
 * get their own share of runs, since a uniform date from year 1 would rarely land in them.
 */
const moment = fc
  .oneof(
    fc.date({ min: startOfYear(1900), max: new Date(9999, 11, 31), noInvalidDate: true }),
    fc.date({
      min: startOfYear(1),
      max: new Date(startOfYear(100).getTime() - 1),
      noInvalidDate: true,
    }),
  )
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
  const clock =
    time !== null ? `${time.separator}${pad(m.hour)}:${pad(m.minute)}${time.after}` : '';
  return `${before}${date}${clock}${after}`;
}

/** How many days a month has, worked out from the calendar rather than from the code under test. */
function daysIn(year: number, month: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2) return leap ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
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
        expect(date.getHours()).toBe(w.time !== null ? w.moment.hour : 0);
        expect(date.getMinutes()).toBe(w.time !== null ? w.moment.minute : 0);
      }),
    );
  });

  it('reads nothing from a date or time the calendar does not have', () => {
    const month = fc.integer({ min: 1, max: 12 });
    const day = fc.integer({ min: 1, max: 28 });
    const impossibleDate = fc.oneof(
      // Year 0: the calendar goes from 1 BC to AD 1.
      fc.record({ year: fc.constant(0), month, day }),
      fc.record({
        year: fc.integer({ min: 1, max: 9999 }),
        month: fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 99 })),
        day,
      }),
      moment.chain((m) =>
        fc
          .oneof(fc.constant(0), fc.integer({ min: daysIn(m.year, m.month) + 1, max: 99 }))
          .map((d) => ({ year: m.year, month: m.month, day: d })),
      ),
    );
    const possibleClock = fc.constantFrom('', 'T12:00', ' 08:30', 'T23:59:00Z');
    const onImpossibleDate = fc
      .tuple(impossibleDate, possibleClock)
      .map(([d, clock]) => `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}${clock}`);

    const impossibleClock = fc.oneof(
      fc.record({
        hour: fc.integer({ min: 24, max: 99 }),
        minute: fc.integer({ min: 0, max: 99 }),
      }),
      fc.record({
        hour: fc.integer({ min: 0, max: 99 }),
        minute: fc.integer({ min: 60, max: 99 }),
      }),
    );
    const atImpossibleTime = fc
      .tuple(moment, fc.constantFrom('T', ' '), impossibleClock, afterTheMinutes)
      .map(
        ([m, separator, clock, after]) =>
          `${pad(m.year, 4)}-${pad(m.month)}-${pad(m.day)}${separator}${pad(clock.hour)}:${pad(clock.minute)}${after}`,
      );

    fc.assert(
      fc.property(fc.oneof(onImpossibleDate, atImpossibleTime), (text) => {
        expect(parsePurchasedAt(text)).toBeNull();
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
