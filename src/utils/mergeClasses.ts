import { twMerge } from 'tailwind-merge';

/**
 * Joins class names into one `className`, letting a later Tailwind utility win over an earlier one
 * it conflicts with: `mergeClasses('p-2 mt-1', 'p-4')` is `'mt-1 p-4'`. Empty and missing classes
 * are skipped. A component passes its own classes first and the ones it's given last, so a caller's
 * layout classes win.
 */
export function mergeClasses(...classes: readonly (string | false | null | undefined)[]): string {
  return twMerge(...classes);
}
