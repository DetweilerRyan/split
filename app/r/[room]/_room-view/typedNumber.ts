/**
 * The number typed into a field: what the text reads as, or 0 when it's empty or isn't a number.
 * Minus zero reads as 0 too, so no amount shows as "-0.00".
 */
export function typedNumber(text: string): number {
  const number = Number(text);
  return Number.isNaN(number) || number === 0 ? 0 : number;
}
