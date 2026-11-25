/**
 * `value` as a number, or 0 when it isn't one, such as text typed into a field or a value a peer
 * stored. Only a number or text is read; anything else, such as `true`, an array or an object,
 * reads as 0, since `Number()` would turn some into numbers and throw on others. Minus zero reads
 * as 0 too, so no amount shows as "-0.00".
 */
export function numberOrZero(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const number = Number(value);
  return Number.isNaN(number) || number === 0 ? 0 : number;
}
