import { describe, expect, it } from 'vitest';
import { parsePurchasedAt } from './mealInfo';

/** The local date and time a parsed purchase time holds, as a person would read it. */
function readBack(value: string) {
  const parsed = parsePurchasedAt(value);
  if (parsed === null) return null;
  const { date, hasTime } = parsed;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    hasTime,
  };
}

describe('parsePurchasedAt', () => {
  it('reads a date and time as written', () => {
    expect(readBack('2026-11-24T19:45')).toEqual({
      year: 2026,
      month: 11,
      day: 24,
      hour: 19,
      minute: 45,
      hasTime: true,
    });
  });

  it('reads a date with no time as midnight, without a time', () => {
    expect(readBack('2026-11-24')).toEqual({
      year: 2026,
      month: 11,
      day: 24,
      hour: 0,
      minute: 0,
      hasTime: false,
    });
  });

  it.each([
    ['year 50', '0050-03-04 10:20', 50],
    ['year 1', '0001-01-01', 1],
    ['year 99', '0099-12-31T23:59', 99],
  ])('keeps %s as written, not as a year in the 1900s', (_year, value, year) => {
    expect(readBack(value)?.year).toBe(year);
  });

  it('reads nothing from year 0, which the calendar does not have', () => {
    expect(parsePurchasedAt('0000-01-01')).toBeNull();
  });

  it.each([
    ['a thirteenth month', '2026-13-01'],
    ['a forty-fifth day', '2026-01-45'],
    ['both', '2026-13-45'],
    ['the thirtieth of February', '2026-02-30'],
    ['the twenty-ninth of February outside a leap year', '2026-02-29'],
    ['month zero', '2026-00-10'],
    ['day zero', '2026-01-00'],
  ])('reads nothing from an impossible date: %s', (_kind, value) => {
    expect(parsePurchasedAt(value)).toBeNull();
    expect(parsePurchasedAt(`${value}T12:00`)).toBeNull();
  });

  it('reads the twenty-ninth of February in a leap year', () => {
    expect(readBack('2024-02-29')).toMatchObject({ year: 2024, month: 2, day: 29 });
  });

  it.each([
    ['hour 25 and minute 99', '2026-01-01T25:99'],
    ['hour 24', '2026-01-01T24:00'],
    ['minute 60', '2026-01-01 23:60'],
  ])('reads nothing from an impossible time: %s', (_kind, value) => {
    expect(parsePurchasedAt(value)).toBeNull();
  });
});
