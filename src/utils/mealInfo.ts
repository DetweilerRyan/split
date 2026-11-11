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

/** Best-guess meal from time of day and how many items were ordered. */
export function guessMeal(purchase: PurchaseTime | null, itemCount: number): string | null {
  if (!purchase?.hasTime) return null;
  const hour = purchase.date.getHours() + purchase.date.getMinutes() / 60;
  let meal: string;
  if (hour >= 5 && hour < 10.5) meal = itemCount <= 3 ? 'Coffee & breakfast' : 'Breakfast';
  else if (hour < 11.5) meal = 'Brunch';
  else if (hour < 15) meal = 'Lunch';
  else if (hour < 17.5) meal = itemCount <= 3 ? 'Coffee & snack' : 'Late lunch';
  else if (hour < 22) meal = 'Dinner';
  else meal = 'Late-night bite';
  if (itemCount >= 12) return `${meal} · big group`;
  if (itemCount >= 7 && /Lunch|Dinner/.test(meal)) return `${meal} · shared meal`;
  return meal;
}
