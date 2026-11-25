import { z } from 'zod';

/**
 * A number, or text typed into a field or a value a peer stored, as a finite number, or 0 when it
 * isn't one. Only a number or text is read; anything else, such as `true`, an array or an object,
 * reads as 0, since `Number()` would turn some into numbers and throw on others. `NaN` and an
 * infinity read as 0, and minus zero too, so no amount shows as "-0.00".
 */
export const numberOrZeroSchema = z
  .union([z.number(), z.string()])
  .transform(Number)
  .pipe(z.number().transform((number) => (number === 0 ? 0 : number)))
  .catch(0);

/** `value` read through `numberOrZeroSchema`, for text a field gives as the person types. */
export function numberOrZero(value: unknown): number {
  return numberOrZeroSchema.parse(value);
}
