/**
 * A text field read from the room's Yjs document, where any peer can write any value: the value
 * if it's a non-empty string, else `fallback`. A number or object a peer wrote reads as
 * `fallback`, not as `"42"` or `"[object Object]"`.
 */
export function storedText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}
