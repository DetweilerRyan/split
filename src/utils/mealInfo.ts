export interface PurchaseTime {
  date: Date;
  hasTime: boolean;
}

export function parsePurchasedAt(value: string): PurchaseTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
  return Number.isNaN(date.getTime()) ? null : { date, hasTime: h !== undefined };
}

export function formatPurchaseTime({ date, hasTime }: PurchaseTime) {
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = hasTime ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  return { day, time };
}
