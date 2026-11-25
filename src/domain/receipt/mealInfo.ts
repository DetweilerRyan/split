import { parse } from 'date-fns/parse';

export type PurchaseTime = {
  readonly date: Date;
  readonly hasTime: boolean;
};

/**
 * Reads the local date, and the time when one is written, from the start of a purchase time such
 * as `2026-11-24T19:45`. Anything after the minutes, such as seconds or an offset, is ignored. A
 * date or time the calendar doesn't have, such as `2026-13-45` or `T25:99`, reads as `null`.
 */
export function parsePurchasedAt(value: string): PurchaseTime | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value.trim());
  const [, day, time] = match ?? [];
  if (day === undefined) return null;
  // Every field is in the format, so the reference date fills none of them.
  const reference = new Date(0);
  const date =
    time === undefined
      ? parse(day, 'yyyy-MM-dd', reference)
      : parse(`${day} ${time}`, 'yyyy-MM-dd HH:mm', reference);
  return Number.isNaN(date.getTime()) ? null : { date, hasTime: time !== undefined };
}

export function formatPurchaseTime({ date, hasTime }: PurchaseTime) {
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = hasTime
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';
  return { day, time };
}
