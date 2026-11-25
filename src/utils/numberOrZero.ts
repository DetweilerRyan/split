/**
 * `value` as a number, or 0 when it isn't one, such as text typed into a field or a value a peer
 * stored. Minus zero reads as 0 too, so no amount shows as "-0.00".
 */
export function numberOrZero(value: unknown): number {
  const number = Number(value);
  return Number.isNaN(number) || number === 0 ? 0 : number;
}
